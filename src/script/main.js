import "../style/style.css";
import "../modifikasi/t.mo";
import { CONFIG } from "../data/config";
import { Fighter } from "../class/Fighter";

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");

canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;

let lastKeyP1 = "";
let lastKeyP2 = "";

// player 1
const player1 = new Fighter({
  position: { x: 100, y: 0 },
  velocity: { x: 0, y: 0 },
  color: "blue",
  imageSrc: "/asset/characters/Samurai/Idle.png",
  framesMax: 6,
  scale: 1.8,
  sprites: {
    idle: { imageSrc: "/asset/characters/Samurai/Idle.png", framesMax: 6 },
    run: { imageSrc: "/asset/characters/Samurai/Run.png", framesMax: 8 },
    jump: { imageSrc: "/asset/characters/Samurai/Jump.png", framesMax: 12 },
    attack: {
      imageSrc: "/asset/characters/Samurai/Attack_1.png",
      framesMax: 6,
    },
  },
});

const player2 = new Fighter({
  position: { x: 300, y: 0 },
  velocity: { x: 0, y: 0 },
  color: "blue",
  imageSrc: "/asset/characters/Shinobi/Idle.png",
  framesMax: 6,
  scale: 1.8,
  sprites: {
    idle: { imageSrc: "/asset/characters/Shinobi/Idle.png", framesMax: 6 },
    run: { imageSrc: "/asset/characters/Shinobi/Run.png", framesMax: 8 },
    jump: { imageSrc: "/asset/characters/Shinobi/Jump.png", framesMax: 12 },
    attack: {
      imageSrc: "/asset/characters/Shinobi/Attack_1.png",
      framesMax: 6,
    },
  },
});

function animate() {
  window.requestAnimationFrame(animate);

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  player1.update(ctx, canvas.height);
  player2.update(ctx, canvas.height);

  // LOGIKA GERAK PLAYER 1
  player1.velocity.x = 0;
  if (keys.d.pressed && lastKeyP1 === "d") {
    player1.velocity.x = 5;
    player1.facing = "right";
    player1.switchSprite("run");
  } else if (keys.a.pressed && lastKeyP1 === "a") {
    player1.velocity.x = -5;
    player1.facing = "left";
    player1.switchSprite("run");
  } else {
    player1.switchSprite("idle");
  }

  // LOGIKA GERAK PLAYER 2
  player2.velocity.x = 0;
  if (keys.ArrowRight.pressed && lastKeyP2 === "ArrowRight") {
    player2.velocity.x = 5;
    player2.facing = "right"; // Biasanya player 2 hadap kanan dulu
    player2.switchSprite("run");
  } else if (keys.ArrowLeft.pressed && lastKeyP2 === "ArrowLeft") {
    player2.velocity.x = -5;
    player2.facing = "left";
    player2.switchSprite("run");
  } else {
    player2.switchSprite("idle");
  }

  // Logika Animasi Lompat (Jika sedang naik/turun)
  if (player1.velocity.y < 0) player1.switchSprite("jump");
  if (player2.velocity.y < 0) player2.switchSprite("jump");
}
const keys = {
  a: { pressed: false },
  d: { pressed: false },
  ArrowRight: { pressed: false },
  ArrowLeft: { pressed: false },
};

window.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "d":
      keys.d.pressed = true;
      lastKeyP1 = "d";
      break;
    case "a":
      keys.a.pressed = true;
      lastKeyP1 = "a";
      break;
    case "w":
      if (player1.velocity.y === 0) player1.velocity.y = -20;
      break;
    case " ":
      player1.attack();
      break;

    // Kontrol untuk player 2
    case "ArrowRight":
      keys.ArrowRight.pressed = true;
      lastKeyP2 = "ArrowRight";
      break;
    case "ArrowLeft":
      keys.ArrowLeft.pressed = true;
      lastKeyP2 = "ArrowLeft";
      break;
    case "ArrowUp":
      if (player2.velocity.y === 0) player2.velocity.y = -20;
      break;
    case "Enter":
      player2.attack();
      break;
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.key) {
    case "d":
      keys.d.pressed = false;
      lastKeyP1 = "";
      break;
    case "a":
      keys.a.pressed = false;
      break;

    case "ArrowRight":
      keys.ArrowRight.pressed = false;
      break;
    case "ArrowLeft":
      keys.ArrowLeft.pressed = false;
      break;
  }
});

animate();
