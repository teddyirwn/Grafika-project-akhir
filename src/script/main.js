import "../style/style.css";
import "./auth.js";
import { CONFIG } from "../data/config";
import { Fighter } from "../class/Fighter";
import { Sprite } from "../class/Sprite";
import {
  setupNetworkReceiver,
  emitNetworkState,
  emitHit,
  emitHealthSync,
  sendRoundSignal,
  listenRoundStarted,
} from "./network.js";
import * as Network from "./network.js";
import { supabase } from "../lib/supabase.js";

const canvas = document.getElementById("arena");
let ctx = canvas ? canvas.getContext("2d") : null;

const battleScene = document.getElementById("battle-scene");
const player1Health = document.getElementById("player1-health");
const player2Health = document.getElementById("player2-health");

const menuMusic = new Audio("/asset/audio/bgm/bgm_menu.wav");
const backgroundMusic = new Audio("/asset/audio/bgm/bgm_fight.wav");
const jumpSound = new Audio("/asset/audio/sfx/movement/sfx_jump.wav");
const landSound = new Audio("/asset/audio/sfx/movement/sfx_landing.wav");
const walkSound = new Audio("/asset/audio/sfx/movement/sfx_walking_grass.wav");
const skill1Sound1 = new Audio(
  "/asset/audio/sfx/combat/weapon/sfx_player1_skill1.wav",
);
const skill1Sound2 = new Audio(
  "/asset/audio/sfx/combat/weapon/sfx_player2_skill1.wav",
);

menuMusic.volume = 0.2;
menuMusic.loop = true;
backgroundMusic.volume = 0.2;
backgroundMusic.loop = true;
walkSound.loop = true;

let player1InAir = false;
let player2InAir = false;
let lastKeyP1 = "";
let lastKeyP2 = "";
let gameActive = false; // Pengaman status permainan aktif
let animationStarted = false; // Pengaman agar animate() hanya dipanggil sekali

// Round & Timer system
let currentRound = 1;
let p1RoundWins = 0;
let p2RoundWins = 0;
let roundTimer = 60;
let timerInterval = null;
let roundEnding = false; // Guard agar winnerCheck tidak dipanggil duplikat

// Player names
let player1Name = "Player 1";
let player2Name = "Player 2";

if (canvas) {
  canvas.width = CONFIG.canvasWidth;
  canvas.height = CONFIG.canvasHeight;
}

const background = new Sprite({
  position: { x: 0, y: 0 },
  imageSrc: "/asset/backgrounds/game_background_2/game_background_2.png",
});

const player1 = new Fighter({
  position: { x: 100, y: 0 },
  velocity: { x: 0, y: 0 },
  offset: { x: 100, y: 40 },
  color: "blue",
  imageSrc: "/asset/characters/Samurai/Idle.png",
  framesMax: 6,
  scale: 2.5,
  sprites: {
    idle: { imageSrc: "/asset/characters/Samurai/Idle.png", framesMax: 6 },
    run: { imageSrc: "/asset/characters/Samurai/Run.png", framesMax: 8 },
    jump: { imageSrc: "/asset/characters/Samurai/Jump.png", framesMax: 12 },
    attack: {
      imageSrc: "/asset/characters/Samurai/Attack_1.png",
      framesMax: 6,
    },
    death: { imageSrc: "/asset/characters/Samurai/Dead.png", framesMax: 3 },
  },
});

const player2 = new Fighter({
  position: { x: 800, y: 0 },
  velocity: { x: 0, y: 0 },
  offset: { x: 100, y: 40 },
  color: "red",
  imageSrc: "/asset/characters/Shinobi/Idle.png",
  framesMax: 6,
  scale: 2.5,
  sprites: {
    idle: { imageSrc: "/asset/characters/Shinobi/Idle.png", framesMax: 6 },
    run: { imageSrc: "/asset/characters/Shinobi/Run.png", framesMax: 8 },
    jump: { imageSrc: "/asset/characters/Shinobi/Jump.png", framesMax: 12 },
    attack: {
      imageSrc: "/asset/characters/Shinobi/Attack_1.png",
      framesMax: 5,
    },
    death: { imageSrc: "/asset/characters/Shinobi/Dead.png", framesMax: 4 },
  },
});

// MEMASTIKAN VALUE DARAH MENYALA AWAL
player1.health = 100;
player2.health = 100;
player1.facing = "right";
player2.facing = "left";

const keys = { a: { pressed: false }, d: { pressed: false } };

function animate() {
  if (!ctx || !gameActive) {
    window.requestAnimationFrame(animate);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // === INPUT & VELOCITY — harus diproses SEBELUM update() ===

  if (!player1.dead && window.localRole === "p1") {
    player1.velocity.x = 0;
    if (keys.d.pressed && lastKeyP1 === "d") {
      player1.velocity.x = 4;
      player1.facing = "right";
      player1.switchSprite("run");
    } else if (keys.a.pressed && lastKeyP1 === "a") {
      player1.velocity.x = -4;
      player1.facing = "left";
      player1.switchSprite("run");
    } else {
      player1.switchSprite("idle");
    }
  }

  if (!player2.dead) {
    if (window.isBotMode) {
      player2.velocity.x = 0;
      const jarakX = player1.position.x - player2.position.x;
      if (Math.abs(jarakX) > 80) {
        if (jarakX > 0) {
          player2.velocity.x = 2.5;
          player2.facing = "right";
          player2.switchSprite("run");
        } else {
          player2.velocity.x = -2.5;
          player2.facing = "left";
          player2.switchSprite("run");
        }
      } else {
        player2.switchSprite("idle");
        if (!player2.isAttacking && Math.random() < 0.05) {
          player2.attack();
          if (skill1Sound2) {
            skill1Sound2.currentTime = 0;
            skill1Sound2.play();
          }
        }
      }
    } else if (window.localRole === "p2") {
      player2.velocity.x = 0;
      if (keys.d.pressed && lastKeyP2 === "d") {
        player2.velocity.x = 4;
        player2.facing = "right";
        player2.switchSprite("run");
      } else if (keys.a.pressed && lastKeyP2 === "a") {
        player2.velocity.x = -4;
        player2.facing = "left";
        player2.switchSprite("run");
      } else {
        player2.switchSprite("idle");
      }
    }
  }

  // Jump sprite override — harus setelah set velocity.x tapi sebelum update()
  if (player1.velocity.y < 0) player1.switchSprite("jump");
  if (player2.velocity.y < 0) player2.switchSprite("jump");

  // === NETWORK INTERPOLASI untuk lawan di multiplayer ===
  if (!window.isBotMode && window.roomCode) {
    if (window.localRole === "p2") {
      player1.position.x +=
        (Network.p1NetworkTarget.x - player1.position.x) * 0.3;
      player1.position.y +=
        (Network.p1NetworkTarget.y - player1.position.y) * 0.3;
    }
    if (window.localRole === "p1") {
      player2.position.x +=
        (Network.p2NetworkTarget.x - player2.position.x) * 0.3;
      player2.position.y +=
        (Network.p2NetworkTarget.y - player2.position.y) * 0.3;
    }
  }

  // === RENDER ===
  background.update(ctx);
  player1.update(ctx, canvas.height);
  player2.update(ctx, canvas.height);

  // === HIT DETECTION ===
  // Hanya attacker yang menghitung hit-nya sendiri, lalu broadcast ke lawan
  if (player1.isAttacking && player1.frameCurrent === 3) {
    if (Serangan({ attacker: player1, victim: player2 })) {
      if (window.isBotMode || window.localRole === "p1") {
        // Di mode bot atau multiplayer P1 — P1 hitung hit ke P2
        player2.takeHit();
        if (player2Health) player2Health.style.width = player2.health + "%";
        if (!window.isBotMode) {
          // Kirim event hit ke P2 dan sync health ke P2
          emitHit("p2");
          emitHealthSync("p2", player2.health, player2.dead);
        }
      }
    }
    player1.isAttacking = false;
  }

  if (player2.isAttacking && player2.frameCurrent === 2) {
    if (Serangan({ attacker: player2, victim: player1 })) {
      if (window.isBotMode || window.localRole === "p2") {
        // Di mode bot atau multiplayer P2 — P2 hitung hit ke P1
        player1.takeHit();
        if (player1Health) player1Health.style.width = player1.health + "%";
        if (!window.isBotMode) {
          // Kirim event hit ke P1 dan sync health ke P1
          emitHit("p1");
          emitHealthSync("p1", player1.health, player1.dead);
        }
      }
    }
    player2.isAttacking = false;
  }

  // === CEK WINNER ===
  if (gameActive && (player1.health <= 0 || player2.health <= 0)) {
    winnerCheck({ player1, player2 });
  }

  // === SUARA JALAN ===
  if (player1.velocity.y !== 0) player1InAir = true;
  if (player1InAir && player1.velocity.y === 0) {
    landSound.currentTime = 0;
    landSound.play();
    player1InAir = false;
  }
  if (player2.velocity.y !== 0) player2InAir = true;
  if (player2InAir && player2.velocity.y === 0) {
    landSound.currentTime = 0;
    landSound.play();
    player2InAir = false;
  }

  if (
    (keys.a.pressed || keys.d.pressed) &&
    (player1.velocity.y === 0 || player2.velocity.y === 0)
  ) {
    if (walkSound.paused) walkSound.play();
  } else {
    walkSound.pause();
  }

  emitNetworkState(player1, player2);
  window.requestAnimationFrame(animate);
}

function startGame() {
  // Simpan status battle ke sessionStorage agar tahan refresh
  sessionStorage.setItem("inBattle", "true");
  sessionStorage.setItem(
    "battleMode",
    window.isBotMode ? "bot" : "multiplayer",
  );
  sessionStorage.setItem("battleRole", window.localRole || "p1");

  // Hide game over screen dari ronde sebelumnya
  const gameOverScreen = document.querySelector("#game-over-screen");
  if (gameOverScreen) gameOverScreen.style.display = "none";

  // Reset guard round ending
  roundEnding = false;

  player1.health = 100;
  player2.health = 100;
  if (player1Health) player1Health.style.width = "100%";
  if (player2Health) player2Health.style.width = "100%";

  // Reset posisi player ke posisi awal
  player1.position.x = 100;
  player1.position.y = 0;
  player2.position.x = 800;
  player2.position.y = 0;

  // Reset state mati dan sprite ke idle agar ronde baru bersih
  player1.dead = false;
  player1.frameCurrent = 0;
  player1.image = player1.sprites.idle.image;
  player1.framesMax = player1.sprites.idle.framesMax;

  player2.dead = false;
  player2.frameCurrent = 0;
  player2.image = player2.sprites.idle.image;
  player2.framesMax = player2.sprites.idle.framesMax;

  // Handle opponent disconnect — staying player wins automatically
  window.onOpponentDisconnected = (payload) => {
    if (!gameActive) return;
    const disconnectedRole = payload.role;
    const winnerRole = disconnectedRole === "p1" ? "p2" : "p1";
    const winnerName = winnerRole === "p1" ? player1Name : player2Name;
    const loserName = disconnectedRole === "p1" ? player1Name : player2Name;

    if (winnerRole === "p1") p1RoundWins = 2;
    else p2RoundWins = 2;

    if (!roundEnding) {
      roundEnding = true;
      gameActive = false;
      stopTimer();
      walkSound.pause();
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
      updateRoundWinsDisplay();

      const screen = document.querySelector("#game-over-screen");
      const text = document.querySelector("#winner-text");
      const roundLabelEl = document.querySelector("#round-over-label");
      const nextRoundText = document.querySelector("#next-round-text");
      const restartBtn = document.querySelector("#restart-btn");
      if (!screen || !text) return;

      if (roundLabelEl) roundLabelEl.innerText = "MATCH OVER";
      text.innerHTML = `${winnerName} WINS THE MATCH!`;
      if (nextRoundText)
        nextRoundText.innerText = `${loserName} disconnected.  🏆 +10 pts for ${winnerName}  |  -5 pts for ${loserName}`;
      if (restartBtn) restartBtn.innerText = "BACK TO MENU";

      awardPoints(winnerRole, disconnectedRole);
      sessionStorage.removeItem("inBattle");
      sessionStorage.removeItem("battleMode");
      sessionStorage.removeItem("battleRole");
      screen.style.display = "block";
    }
  };

  if (!window.isBotMode)
    setupNetworkReceiver(player1, player2, player1Health, player2Health, () =>
      winnerCheck({ player1, player2 }),
    );

  // Listen for next round signal from host (P2 side)
  if (!window.isBotMode) {
    listenRoundStarted((round) => {
      if (round > currentRound || (round === 1 && currentRound === 1)) return; // host already called startGame
      currentRound = round;
      startGame();
    });
  }

  // Update nama player di header
  const p1NameEl = document.getElementById("display-p1-name");
  const p2NameEl = document.getElementById("display-p2-name");
  if (window.player1Username) player1Name = window.player1Username;
  if (window.player2Username) player2Name = window.player2Username;
  if (p1NameEl) p1NameEl.innerText = player1Name;
  if (p2NameEl) p2NameEl.innerText = player2Name;

  // Update round label
  const roundLabelEl = document.getElementById("round-label");
  if (roundLabelEl) roundLabelEl.innerText = `ROUND ${currentRound}`;
  updateRoundWinsDisplay();
  startTimer();

  gameActive = true; // Nyalakan game loop
  backgroundMusic.play().catch(() => {});

  // Pastikan animate() hanya didaftarkan satu kali
  if (!animationStarted) {
    animationStarted = true;
    animate();
  }
}
window.startGame = startGame;

// Restart / Next Round / Back to Menu button handler
const restartBtn = document.getElementById("restart-btn");
restartBtn?.addEventListener("click", () => {
  if (p1RoundWins >= 2 || p2RoundWins >= 2) {
    // Match selesai — reset semua dan kembali ke menu
    currentRound = 1;
    p1RoundWins = 0;
    p2RoundWins = 0;
    sessionStorage.removeItem("inBattle");
    sessionStorage.removeItem("battleMode");
    sessionStorage.removeItem("battleRole");
    const battleSceneEl = document.getElementById("battle-scene");
    const menuSceneEl = document.getElementById("menu-scene");
    if (battleSceneEl) battleSceneEl.style.display = "none";
    if (menuSceneEl) menuSceneEl.style.display = "flex";
  } else {
    // Lanjut ke ronde berikutnya
    currentRound++;
    // Di multiplayer, hanya host (P1) yang broadcast signal ronde baru
    if (!window.isBotMode && window.roomCode && window.localRole === "p1") {
      sendRoundSignal(currentRound);
    }
    startGame();
  }
});

// Cegah refresh keluar dari game — tampilkan konfirmasi browser native
window.addEventListener("beforeunload", (e) => {
  if (gameActive) {
    e.preventDefault();
    e.returnValue = ""; // Trigger dialog konfirmasi browser
  }
});

window.onload = () => {
  document.body.addEventListener(
    "click",
    () => {
      menuMusic.play();
    },
    { once: true },
  );
};

window.addEventListener("keydown", (event) => {
  if (!window.localRole || !gameActive) return;
  if (event.key === "d") {
    keys.d.pressed = true;
    if (window.localRole === "p1") lastKeyP1 = "d";
    if (window.localRole === "p2") lastKeyP2 = "d";
  }
  if (event.key === "a") {
    keys.a.pressed = true;
    if (window.localRole === "p1") lastKeyP1 = "a";
    if (window.localRole === "p2") lastKeyP2 = "a";
  }
  if (window.localRole === "p1") {
    if (event.key === "w" && player1.velocity.y === 0) {
      player1.velocity.y = -12;
      jumpSound.currentTime = 0;
      jumpSound.play();
    }
    if (event.key === "c" && !player1.isAttacking) {
      player1.attack();
      skill1Sound1.currentTime = 0;
      skill1Sound1.play();
    }
  }
  if (window.localRole === "p2" && !window.isBotMode) {
    if (event.key === "w" && player2.velocity.y === 0) {
      player2.velocity.y = -12;
      jumpSound.currentTime = 0;
      jumpSound.play();
    }
    if (event.key === "c" && !player2.isAttacking) {
      player2.attack();
      skill1Sound2.currentTime = 0;
      skill1Sound2.play();
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "d") keys.d.pressed = false;
  if (event.key === "a") keys.a.pressed = false;
});

// ============================================
// MOBILE CONTROLS
// ============================================

const isMobile = () =>
  /Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent) ||
  window.matchMedia("(pointer: coarse)").matches;

// Show/hide mobile controls based on game state and device
function updateMobileControls() {
  const mobileControls = document.getElementById("mobile-controls");
  if (!mobileControls) return;
  mobileControls.style.display = isMobile() && gameActive ? "block" : "none";
}

// Auto lock orientation to landscape on mobile
function lockLandscape() {
  if (!isMobile()) return;
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock("landscape").catch(() => {});
  }
  // Request fullscreen to hide browser bar
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

function unlockOrientation() {
  if (screen.orientation && screen.orientation.unlock) {
    screen.orientation.unlock();
  }
}

// Override startGame to show mobile controls and lock orientation
// Langsung patch startGame function tanpa override window.startGame
const _origStartGame = startGame;
function startGameWithMobile() {
  _origStartGame();
  if (isMobile()) {
    lockLandscape();
    setTimeout(updateMobileControls, 100);
  }
}
window.startGame = startGameWithMobile;

// Also show controls when game becomes active (covers round 2+)
setInterval(() => {
  const mobileControls = document.getElementById("mobile-controls");
  if (!mobileControls) return;
  if (isMobile() && gameActive && mobileControls.style.display === "none") {
    mobileControls.style.display = "block";
  } else if (!gameActive && mobileControls.style.display !== "none") {
    mobileControls.style.display = "none";
  }
}, 300);

// ---- VIRTUAL JOYSTICK (swipe up = jump, left/right = move) ----
const joystickBase = document.getElementById("joystick-base");
const joystickKnob = document.getElementById("joystick-knob");

let joystickActive = false;
let joystickStartX = 0;
let joystickStartY = 0;
let joystickTouchId = null;
const JOYSTICK_RADIUS = 40;
const JOYSTICK_DEAD_ZONE = 10;
const JUMP_THRESHOLD = 30;

function getLocalPlayer() {
  return window.localRole === "p2" && !window.isBotMode ? player2 : player1;
}

function setJoystickKnobPos(dx, dy) {
  const cx = Math.max(-JOYSTICK_RADIUS, Math.min(JOYSTICK_RADIUS, dx));
  const cy = Math.max(-JOYSTICK_RADIUS, Math.min(JOYSTICK_RADIUS, dy));
  joystickKnob.style.transform = "translate(calc(-50% + " + cx + "px), calc(-50% + " + cy + "px))";
}

function resetJoystick() {
  joystickKnob.style.transform = "translate(-50%, -50%)";
  keys.a.pressed = false;
  keys.d.pressed = false;
  lastKeyP1 = "";
  lastKeyP2 = "";
  joystickActive = false;
  joystickTouchId = null;
}

joystickBase?.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (!gameActive) return;
  const touch = e.changedTouches[0];
  joystickActive = true;
  joystickTouchId = touch.identifier;
  joystickStartX = touch.clientX;
  joystickStartY = touch.clientY;
}, { passive: false });

joystickBase?.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (!joystickActive) return;
  for (const touch of e.changedTouches) {
    if (touch.identifier !== joystickTouchId) continue;
    const dx = touch.clientX - joystickStartX;
    const dy = touch.clientY - joystickStartY;
    setJoystickKnobPos(dx, dy);
    if (Math.abs(dx) > JOYSTICK_DEAD_ZONE) {
      if (dx < 0) { keys.a.pressed = true; keys.d.pressed = false; lastKeyP1 = "a"; lastKeyP2 = "a"; }
      else { keys.d.pressed = true; keys.a.pressed = false; lastKeyP1 = "d"; lastKeyP2 = "d"; }
    } else { keys.a.pressed = false; keys.d.pressed = false; lastKeyP1 = ""; lastKeyP2 = ""; }
    break;
  }
}, { passive: false });

joystickBase?.addEventListener("touchend", (e) => {
  e.preventDefault();
  for (const touch of e.changedTouches) {
    if (touch.identifier !== joystickTouchId) continue;
    const dy = touch.clientY - joystickStartY;
    if (dy < -JUMP_THRESHOLD) {
      const p = getLocalPlayer();
      if (p && p.velocity.y === 0) { p.velocity.y = -12; jumpSound.currentTime = 0; jumpSound.play().catch(() => {}); }
    }
    resetJoystick();
    break;
  }
}, { passive: false });

// ---- ATTACK BUTTON ----
const btnAttack = document.getElementById("btn-attack");
btnAttack?.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (!gameActive) return;
  const p = getLocalPlayer();
  if (p && !p.isAttacking) {
    p.attack();
    const snd = window.localRole === "p2" && !window.isBotMode ? skill1Sound2 : skill1Sound1;
    snd.currentTime = 0;
    snd.play().catch(() => {});
  }
}, { passive: false });

function Serangan({ attacker, victim }) {
  return (
    attacker.attackBox.position.x < victim.position.x + victim.width &&
    attacker.attackBox.position.x + attacker.attackBox.width >
      victim.position.x &&
    attacker.attackBox.position.y < victim.position.y + victim.height &&
    attacker.attackBox.position.y + attacker.attackBox.height >
      victim.position.y
  );
}

function updateTimerDisplay() {
  const timerEl = document.getElementById("timer-display");
  if (!timerEl) return;
  timerEl.innerText = roundTimer;
  if (roundTimer <= 10) timerEl.classList.add("danger");
  else timerEl.classList.remove("danger");
}

function updateRoundWinsDisplay() {
  const p1El = document.getElementById("p1-round-wins");
  const p2El = document.getElementById("p2-round-wins");
  if (p1El)
    p1El.innerText =
      (p1RoundWins >= 1 ? "⬤ " : "○ ") + (p1RoundWins >= 2 ? "⬤" : "○");
  if (p2El)
    p2El.innerText =
      (p2RoundWins >= 1 ? "⬤ " : "○ ") + (p2RoundWins >= 2 ? "⬤" : "○");
}

function startTimer() {
  roundTimer = 60;
  updateTimerDisplay();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!gameActive) return;
    roundTimer--;
    updateTimerDisplay();
    if (roundTimer <= 0) {
      clearInterval(timerInterval);
      // Waktu habis — pemenang dari health tertinggi
      if (player1.health > player2.health) p1RoundWins++;
      else if (player2.health > player1.health) p2RoundWins++;
      showRoundResult();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

async function awardPoints(winnerRole, loserRole) {
  try {
    // Helper: get user ID by username or current user
    async function getUserId(role) {
      if (window.isBotMode) {
        if (role === "p1") {
          // Bot mode: P1 is the logged-in user
          const {
            data: { user },
          } = await supabase.auth.getUser();
          console.log("[POINTS] Bot mode user:", user?.id, user?.email);
          return user?.id;
        }
        return null; // Bot has no account
      }
      const username = role === "p1" ? player1Name : player2Name;
      console.log("[POINTS] Looking up user ID for username:", username);
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .single();
      if (error) console.error("[POINTS] getUserId error:", error.message);
      console.log("[POINTS] Found user ID:", data?.id);
      return data?.id;
    }

    const winnerId = await getUserId(winnerRole);
    console.log("[POINTS] Winner ID:", winnerId, "role:", winnerRole);
    if (winnerId) {
      const { error } = await supabase.rpc("increment_points", {
        user_id: winnerId,
        points_to_add: 10,
      });
      if (error)
        console.error("[POINTS] Failed to add points:", error.message, error);
      else console.log("[POINTS] +10 points awarded to", winnerId);
    } else {
      console.warn("[POINTS] Winner ID not found, points not awarded");
    }

    if (loserRole) {
      const loserId = await getUserId(loserRole);
      console.log("[POINTS] Loser ID:", loserId, "role:", loserRole);
      if (loserId) {
        const { error } = await supabase.rpc("increment_points", {
          user_id: loserId,
          points_to_add: -5,
        });
        if (error)
          console.error(
            "[POINTS] Failed to deduct points:",
            error.message,
            error,
          );
        else console.log("[POINTS] -5 points deducted from", loserId);
      }
    }
  } catch (e) {
    console.error("[POINTS] Unexpected error:", e);
  }
}

function showRoundResult() {
  gameActive = false;
  stopTimer();
  walkSound.pause();
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;

  updateRoundWinsDisplay();

  const screen = document.querySelector("#game-over-screen");
  const text = document.querySelector("#winner-text");
  const roundLabelEl = document.querySelector("#round-over-label");
  const nextRoundText = document.querySelector("#next-round-text");
  const restartBtn = document.querySelector("#restart-btn");
  if (!screen || !text) return;

  if (roundLabelEl) roundLabelEl.innerText = `ROUND ${currentRound}`;

  // Tentukan pemenang ronde
  const p1Won = player1.health > player2.health || player2.health <= 0;
  const p2Won = player2.health > player1.health || player1.health <= 0;
  const roundWinnerName =
    p1Won && !p2Won ? player1Name : p2Won && !p1Won ? player2Name : null;
  text.innerHTML = roundWinnerName
    ? `${roundWinnerName} WINS ROUND ${currentRound}!`
    : `ROUND ${currentRound} DRAW!`;

  // Check if match is over
  if (p1RoundWins >= 2 || p2RoundWins >= 2) {
    const matchWinnerRole = p1RoundWins >= 2 ? "p1" : "p2";
    const matchLoserRole = matchWinnerRole === "p1" ? "p2" : "p1";
    const matchWinnerName =
      matchWinnerRole === "p1" ? player1Name : player2Name;
    const matchLoserName = matchLoserRole === "p1" ? player1Name : player2Name;
    text.innerHTML = `${matchWinnerName} WINS THE MATCH!`;
    if (nextRoundText)
      nextRoundText.innerText = `🏆 +10 pts for ${matchWinnerName}  |  -5 pts for ${matchLoserName}`;
    if (restartBtn) restartBtn.innerText = "BACK TO MENU";
    awardPoints(matchWinnerRole, matchLoserRole);
    sessionStorage.removeItem("inBattle");
    sessionStorage.removeItem("battleMode");
    sessionStorage.removeItem("battleRole");
  } else {
    if (nextRoundText)
      nextRoundText.innerText = `Next: Round ${currentRound + 1} of 3`;
    if (restartBtn) restartBtn.innerText = "NEXT ROUND";
  }

  screen.style.display = "block";
}

function winnerCheck({ player1, player2 }) {
  if (roundEnding) return; // Sudah diproses, abaikan panggilan duplikat
  roundEnding = true;
  // Hitung round wins
  if (player1.health <= 0 && player2.health > 0) p2RoundWins++;
  else if (player2.health <= 0 && player1.health > 0) p1RoundWins++;
  showRoundResult();
}
