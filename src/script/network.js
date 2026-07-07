import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
const socket = io(SERVER_URL);

window.localRole = window.localRole || null;
window.isBotMode = window.isBotMode || false;
window.players = [];
window.roomCode = null;

export let p1NetworkTarget = { x: 100, y: 0 };
export let p2NetworkTarget = { x: 800, y: 0 };

// Simpan referensi listener agar bisa di-remove dengan tepat
let _roomPlayersListener = null;
let _gameStartedListener = null;

export function setupRoomChannel(
  code,
  username,
  onSyncCallback,
  onStartCallback,
) {
  window.roomCode = code;

  // Hapus listener lama dengan referensi yang tepat sebelum pasang yang baru
  if (_roomPlayersListener) {
    socket.off("room_players", _roomPlayersListener);
  }
  if (_gameStartedListener) {
    socket.off("game_started", _gameStartedListener);
  }

  // Buat listener baru dengan referensi tersimpan
  _roomPlayersListener = (serverPlayers) => {
    window.players = serverPlayers;
    console.log("[CLIENT] Received updated player list:", serverPlayers);
    if (onSyncCallback) onSyncCallback(serverPlayers);
  };

  _gameStartedListener = () => {
    console.log("[CLIENT] Game started by host!");
    if (onStartCallback) onStartCallback();
  };

  socket.on("room_players", _roomPlayersListener);
  socket.on("game_started", _gameStartedListener);

  // Listen for opponent disconnect — staying player wins automatically
  socket.off("opponent_disconnected").on("opponent_disconnected", (payload) => {
    console.log(`[DISCONNECT] Opponent ${payload.username} left the game`);
    if (window.onOpponentDisconnected) window.onOpponentDisconnected(payload);
  });

  // Send join event AFTER listeners are registered
  socket.emit("join_room", { code, username, role: window.localRole });

  // Handle room full
  socket.off("room_full").on("room_full", ({ code: fullCode }) => {
    if (fullCode !== code) return;
    alert(`Room ${fullCode} sudah penuh (2 player). Coba room lain.`);
    // Kembali ke menu
    const joinScene = document.getElementById("join-scene");
    const menuScene = document.getElementById("menu-scene");
    if (joinScene) joinScene.style.display = "none";
    if (menuScene) menuScene.style.display = "flex";
    window.roomCode = null;
    window.localRole = null;
  });
}

export function setupNetworkReceiver(
  player1,
  player2,
  player1Health,
  player2Health,
  onWinnerCheck,
) {
  // Track apakah lawan sedang attack di frame sebelumnya
  // untuk cegah attack() dipanggil berulang setiap frame
  let p1WasAttacking = false;
  let p2WasAttacking = false;

  socket.off("p1_sync").on("p1_sync", (payload) => {
    if (window.localRole === "p2") {
      p1NetworkTarget = payload.position;
      player1.facing = payload.facing;
      player1.dead = payload.dead;

      // Trigger attack hanya saat transisi false -> true
      if (payload.isAttacking && !p1WasAttacking) {
        player1.attack();
      }
      p1WasAttacking = payload.isAttacking;

      // Sinkronisasi sprite berdasarkan velocity dan state
      if (!player1.dead && !player1.isAttacking) {
        if (payload.velocity && Math.abs(payload.velocity.x) > 0.5) {
          player1.switchSprite("run");
        } else if (payload.velocity && payload.velocity.y < -1) {
          player1.switchSprite("jump");
        } else {
          player1.switchSprite("idle");
        }
      }
    }
  });

  socket.off("p2_sync").on("p2_sync", (payload) => {
    if (window.localRole === "p1") {
      p2NetworkTarget = payload.position;
      player2.facing = payload.facing;
      player2.dead = payload.dead;

      // Trigger attack hanya saat transisi false -> true
      if (payload.isAttacking && !p2WasAttacking) {
        player2.attack();
      }
      p2WasAttacking = payload.isAttacking;

      // Sinkronisasi sprite berdasarkan velocity dan state
      if (!player2.dead && !player2.isAttacking) {
        if (payload.velocity && Math.abs(payload.velocity.x) > 0.5) {
          player2.switchSprite("run");
        } else if (payload.velocity && payload.velocity.y < -1) {
          player2.switchSprite("jump");
        } else {
          player2.switchSprite("idle");
        }
      }
    }
  });

  // Receive hit event from opponent
  socket.off("player_hit").on("player_hit", (payload) => {
    if (payload.victim === "p2" && window.localRole === "p2") {
      player2.takeHit();
      if (player2Health) player2Health.style.width = player2.health + "%";
      emitHealthSync("p2", player2.health, player2.dead);
      if (player2.health <= 0 && onWinnerCheck) onWinnerCheck();
    }
    if (payload.victim === "p1" && window.localRole === "p1") {
      player1.takeHit();
      if (player1Health) player1Health.style.width = player1.health + "%";
      emitHealthSync("p1", player1.health, player1.dead);
      if (player1.health <= 0 && onWinnerCheck) onWinnerCheck();
    }
  });

  // Receive health sync from attacker
  socket.off("health_sync").on("health_sync", (payload) => {
    if (payload.role === "p1" && window.localRole === "p2") {
      player1.health = payload.health;
      player1.dead = payload.dead;
      if (player1Health) player1Health.style.width = payload.health + "%";
    }
    if (payload.role === "p2" && window.localRole === "p1") {
      player2.health = payload.health;
      player2.dead = payload.dead;
      if (player2Health) player2Health.style.width = payload.health + "%";
      if (player2.health <= 0 && onWinnerCheck) onWinnerCheck();
    }
    if (payload.role === "p1" && window.localRole === "p1") {
      if (player1.health <= 0 && onWinnerCheck) onWinnerCheck();
    }
  });
}

export function emitHit(victim) {
  if (!window.roomCode) return;
  socket.emit("sync_movement", {
    code: window.roomCode,
    eventName: "player_hit",
    payload: { victim },
  });
}

export function emitHealthSync(role, health, dead) {
  if (!window.roomCode) return;
  socket.emit("sync_movement", {
    code: window.roomCode,
    eventName: "health_sync",
    payload: { role, health, dead },
  });
}

export function emitNetworkState(player1, player2) {
  if (window.isBotMode || !window.roomCode || !window.localRole) return;

  const payload =
    window.localRole === "p1"
      ? {
          position: { x: player1.position.x, y: player1.position.y },
          velocity: player1.velocity,
          facing: player1.facing,
          health: player1.health,
          dead: player1.dead,
          isAttacking: player1.isAttacking,
        }
      : {
          position: { x: player2.position.x, y: player2.position.y },
          velocity: player2.velocity,
          facing: player2.facing,
          health: player2.health,
          dead: player2.dead,
          isAttacking: player2.isAttacking,
        };

  socket.emit("sync_movement", {
    code: window.roomCode,
    eventName: `${window.localRole}_sync`,
    payload,
  });
}

export function sendStartGameSignal() {
  if (window.roomCode) {
    socket.emit("start_game", { code: window.roomCode });
  }
}

export function sendRoundSignal(round) {
  if (window.roomCode) {
    socket.emit("start_round", { code: window.roomCode, round });
  }
}

export function listenRoundStarted(callback) {
  socket.off("round_started").on("round_started", (payload) => {
    console.log(`[CLIENT] Round ${payload.round} started by host`);
    if (callback) callback(payload.round);
  });
}
