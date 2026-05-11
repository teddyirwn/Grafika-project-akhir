import "../style/style.css";
import "../modifikasi/t.mo";
import { CONFIG } from "../data/config";
import { Fighter } from "../class/Fighter";

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");

canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;

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

console.log(player1.imageSrc);
console.log(player2.imageSrc);
function animate() {
  window.requestAnimationFrame(animate);

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  player1.update(ctx, canvas.height);
  player2.update(ctx, canvas.height);

  player1.velocity.x = 0;
  if (keys.d.pressed) {
    player1.velocity.x = 5;
    player1.switchSprite("run");
  } else if (keys.a.pressed) {
    player1.velocity.x = -5;
    player1.switchSprite("run");
  } else {
    player1.switchSprite("idle");
  }

  // Logika Lompat
  if (player1.velocity.y < 0) {
    player1.switchSprite("jump");
  }
}
const keys = {
  a: { pressed: false },
  d: { pressed: false },
};

// player 1 console
if (player1) {
  window.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "d":
        keys.d.pressed = true;
        break;
      case "a":
        keys.a.pressed = true;
        break;
      case "w":
        player1.velocity.y = -20;
        break; // Lompat
      case " ":
        player1.attack();
        break; // Spasi untuk serang
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
    }
  });
}

animate();
