import "../style/style.css";
import { CONFIG } from "../data/config";
import { Fighter } from "../class/Fighter";
import { Sprite } from "../class/Sprite";

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");

// --- INISIALISASI DOM (SCENE MANAGER) ---
const startScene = document.getElementById("start-scene");
const battleScene = document.getElementById("battle-scene");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");

// --- INISIALISASI HEALTH BAR ---
const player1Health = document.getElementById("player1-health");
const player2Health = document.getElementById("player2-health");

// --- INISIALISASI AUDIO ---
const menuMusic = new Audio("/asset/audio/bgm/bgm_menu.wav");
const backgroundMusic = new Audio("/asset/audio/bgm/bgm_fight.wav");
const jumpSound = new Audio("/asset/audio/sfx/movement/sfx_jump.wav");
const landSound = new Audio("/asset/audio/sfx/movement/sfx_landing.wav");
const walkSound = new Audio("/asset/audio/sfx/movement/sfx_walking_grass.wav");

const skill1Sound1 = new Audio(
  "/asset/audio/sfx/combat/weapon/sfx_player1_skill1.wav",
);
const skill2Sound1 = new Audio(
  "/asset/audio/sfx/combat/weapon/sfx_player1_skill2.wav",
);
const skill1Sound2 = new Audio(
  "/asset/audio/sfx/combat/weapon/sfx_player2_skill1.wav",
);
const skill2Sound2 = new Audio(
  "/asset/audio/sfx/combat/weapon/sfx_player2_skill2.wav",
);

// Pengaturan Audio
menuMusic.volume = 0.2;
menuMusic.loop = true;
backgroundMusic.volume = 0.2;
backgroundMusic.loop = true;
walkSound.loop = true; // Supaya jalan terus saat tombol ditahan

let player1InAir = false;
let player2InAir = false;

canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;

let lastKeyP1 = "";
let lastKeyP2 = "";

// --- OBJECTS ---
const background = new Sprite({
  position: { x: 0, y: 0 },
  imageSrc: "/asset/backgrounds/game_background_2/game_background_2.png",
});

const player1 = new Fighter({
  position: { x: 80, y: 0 },
  velocity: { x: 0, y: 0 },
  offset: { x: 100, y: 0 },
  color: "blue",
  imageSrc: "/asset/characters/Samurai/Idle.png",
  framesMax: 6,
  scale: 2.9,
  sprites: {
    idle: { imageSrc: "/asset/characters/Samurai/Idle.png", framesMax: 6 },
    run: { imageSrc: "/asset/characters/Samurai/Run.png", framesMax: 8 },
    jump: { imageSrc: "/asset/characters/Samurai/Jump.png", framesMax: 12 },
    attack: {
      imageSrc: "/asset/characters/Samurai/Attack_1.png",
      framesMax: 6,
    },
    death: {
      imageSrc: "/asset/characters/Samurai/Dead.png",
      framesMax: 3,
    },
  },
});

const player2 = new Fighter({
  position: { x: 1230, y: 0 },
  velocity: { x: 0, y: 0 },
  offset: { x: 100, y: 0 },
  color: "blue",
  imageSrc: "/asset/characters/Shinobi/Idle.png",
  framesMax: 6,
  scale: 2.9,
  sprites: {
    idle: { imageSrc: "/asset/characters/Shinobi/Idle.png", framesMax: 6 },
    run: { imageSrc: "/asset/characters/Shinobi/Run.png", framesMax: 8 },
    jump: { imageSrc: "/asset/characters/Shinobi/Jump.png", framesMax: 12 },
    attack: {
      imageSrc: "/asset/characters/Shinobi/Attack_1.png",
      framesMax: 5,
    },
    death: {
      imageSrc: "/asset/characters/Shinobi/Dead.png",
      framesMax: 4,
    },
  },
});

// Atur arah awal supaya kedua pemain saling berhadapan saat spawn
if (player1.position.x < player2.position.x) {
  player1.facing = "right";
  player2.facing = "left";
} else {
  player1.facing = "left";
  player2.facing = "right";
}

const keys = {
  a: { pressed: false },
  d: { pressed: false },
  l: { pressed: false },
  j: { pressed: false },
};

// --- LOGIKA ANIMASI ---
function animate() {
  window.requestAnimationFrame(animate);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  background.update(ctx);
  player1.update(ctx, canvas.height);
  player2.update(ctx, canvas.height);

  // logika untuk mengecek pemenang
  if (player1.health <= 0 || player2.health <= 0) {
    winnerCheck({ player1: player1, player2: player2 });
  }

  // logic Untuk mengecek benturan serangan
  // PLAYER 1 MENYERANG PLAYER 2
  if (
    Serangan({
      attacker: player1,
      victim: player2,
    }) &&
    player1.isAttacking
  ) {
    player2.takeHit();
    player1.isAttacking = false;
    player2Health.style.width = player2.health + "%";
  }

  // PLAYER 2 MENYERANG PLAYER 1
  if (
    Serangan({
      attacker: player2,
      victim: player1,
    }) &&
    player2.isAttacking
  ) {
    player1.takeHit();
    player2.isAttacking = false;
    player1Health.style.width = player1.health + "%";
  }
  // LOGIKA GERAK PLAYER 1
  if (!player1.dead) {
    player1.velocity.x = 0;
    if (keys.d.pressed && lastKeyP1 === "d") {
      player1.velocity.x = 3;
      player1.facing = "right";
      player1.switchSprite("run");
    } else if (keys.a.pressed && lastKeyP1 === "a") {
      player1.velocity.x = -3;
      player1.facing = "left";
      player1.switchSprite("run");
    } else {
      player1.switchSprite("idle");
    }
  }

  // LOGIKA GERAK PLAYER 2
  if (!player2.dead) {
    player2.velocity.x = 0;
    if (keys.l.pressed && lastKeyP2 === "l") {
      player2.velocity.x = 3;
      player2.facing = "right";
      player2.switchSprite("run");
    } else if (keys.j.pressed && lastKeyP2 === "j") {
      player2.velocity.x = -3;
      player2.facing = "left";
      player2.switchSprite("run");
    } else {
      player2.switchSprite("idle");
    }
  }

  // Logika Animasi Lompat
  if (player1.velocity.y < 0) player1.switchSprite("jump");
  if (player2.velocity.y < 0) player2.switchSprite("jump");

  // Logika Suara Landing Player 1
  if (player1.velocity.y !== 0) player1InAir = true;
  if (player1InAir && player1.velocity.y === 0) {
    landSound.currentTime = 0;
    landSound.play();
    player1InAir = false;
  }

  // Logika Suara Landing Player 2
  if (player2.velocity.y !== 0) player2InAir = true;
  if (player2InAir && player2.velocity.y === 0) {
    landSound.currentTime = 0;
    landSound.play();
    player2InAir = false;
  }

  // Logika Walk Sound (Hanya bunyi jika di tanah dan menekan tombol jalan)
  if (
    (keys.a.pressed || keys.d.pressed || keys.j.pressed || keys.l.pressed) &&
    (player1.velocity.y === 0 || player2.velocity.y === 0)
  ) {
    if (walkSound.paused) walkSound.play();
  } else {
    walkSound.pause();
  }
}

// --- EVENT LISTENERS ---
startBtn.addEventListener("click", () => {
  // Update Nama
  const p1Name = document.getElementById("p1-name-input").value || "Samurai";
  const p2Name = document.getElementById("p2-name-input").value || "Shinobi";
  document.getElementById("display-p1-name").innerText = p1Name;
  document.getElementById("display-p2-name").innerText = p2Name;

  // Transisi Scene
  startScene.style.display = "none";
  battleScene.style.display = "flex";

  // Jalankan BGM & Game
  backgroundMusic.play();
  animate();
});

restartBtn.addEventListener("click", () => {
  keys.a.pressed = false;
  keys.d.pressed = false;
  keys.j.pressed = false;
  keys.l.pressed = false;
  lastKeyP1 = "";
  lastKeyP2 = "";
  resetGame();
});

window.addEventListener("keydown", (event) => {
  console.log("KEY:", event.key);

  switch (event.key) {
    // Player 1
    case "d":
      keys.d.pressed = true;
      lastKeyP1 = "d";
      break;
    case "a":
      keys.a.pressed = true;
      lastKeyP1 = "a";
      break;
    case "w":
      if (player1.velocity.y === 0) {
        player1.velocity.y = -10;
        jumpSound.currentTime = 0;
        jumpSound.play();
      }
      break;
    case "c":
      player1.attack();
      skill1Sound1.currentTime = 0;
      skill1Sound1.play();
      break;

    // Player 2
    case "l":
      keys.l.pressed = true;
      lastKeyP2 = "l";
      break;
    case "j":
      keys.j.pressed = true;
      lastKeyP2 = "j";
      break;
    case "i":
      if (player2.velocity.y === 0) {
        player2.velocity.y = -10;
        jumpSound.currentTime = 0;
        jumpSound.play();
      }
      break;
    case "n":
      player2.attack();
      skill1Sound2.currentTime = 0;
      skill1Sound2.play();
      break;
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.key) {
    case "d":
      keys.d.pressed = false;
      break;
    case "a":
      keys.a.pressed = false;
      break;
    case "l":
      keys.l.pressed = false;
      break;
    case "j":
      keys.j.pressed = false;
      break;
  }
});

// fungsi untuk mengecek benturan serangan
function Serangan({ attacker, victim }) {
  const victimWidth = (victim.image.width / victim.framesMax) * victim.scale;
  const victimHeight = victim.image.height * victim.scale;

  return (
    attacker.attackBox.position.x < victim.position.x + victimWidth &&
    attacker.attackBox.position.x + attacker.attackBox.width >
      victim.position.x &&
    attacker.attackBox.position.y < victim.position.y + victimHeight &&
    attacker.attackBox.position.y + attacker.attackBox.height >
      victim.position.y
  );
}

// fungsi untuk mengecek pemenang
function resetGame() {
  player1.position = { x: 80, y: 0 };
  player2.position = { x: 1230, y: 0 };
  player1.velocity = { x: 0, y: 0 };
  player2.velocity = { x: 0, y: 0 };
  player1.health = 100;
  player2.health = 100;
  player1.dead = false;
  player2.dead = false;
  player1.isAttacking = false;
  player2.isAttacking = false;
  player1.facing = "right";
  player2.facing = "left";
  player1.switchSprite("idle");
  player2.switchSprite("idle");
  player1Health.style.width = "100%";
  player2Health.style.width = "100%";
  document.querySelector("#game-over-screen").style.display = "none";
}

function winnerCheck({ player1, player2 }) {
  const screen = document.querySelector("#game-over-screen");
  const text = document.querySelector("#winner-text");
  const p1Name = document.getElementById("display-p1-name").innerText;
  const p2Name = document.getElementById("display-p2-name").innerText;

  screen.style.display = "block";

  if (player1.health === player2.health) {
    text.innerHTML = "TIE (SERI)";
  } else if (player1.health > player2.health) {
    text.innerHTML = p1Name + " WINS!";
  } else {
    text.innerHTML = p2Name + " WINS!";
  }
}
