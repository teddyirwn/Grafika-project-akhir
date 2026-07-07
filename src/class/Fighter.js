import { CONFIG } from "../data/config";
import { Sprite } from "./Sprite";

export class Fighter extends Sprite {
  constructor({
    position,
    velocity,
    color = "red",
    imageSrc,
    scale = 1,
    framesMax = 1,
    offset = { x: 0, y: 0 },
    sprites,
  }) {
    super({ position, imageSrc, scale, framesMax, offset });
    this.velocity = velocity;
    this.width = 60;
    this.height = 120;
    this.health = 100;
    this.isAttacking = false;
    this.color = color;

    this.sprites = sprites;
    for (const sprite in this.sprites) {
      this.sprites[sprite].image = new Image();
      this.sprites[sprite].image.src = this.sprites[sprite].imageSrc;
    }

    this.attackBox = {
      position: { x: this.position.x, y: this.position.y },
      width: 140,
      height: 80,
    };
  }

  update(ctx, canvasHeight) {
    super.update(ctx);

    if (this.facing === "right") {
      this.attackBox.position.x = this.position.x + this.width;
    } else {
      this.attackBox.position.x = this.position.x - this.attackBox.width;
    }
    this.attackBox.position.y = this.position.y + 20;

    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    if (this.position.x < 0) this.position.x = 0;
    if (this.position.x + this.width > CONFIG.canvasWidth) {
      this.position.x = CONFIG.canvasWidth - this.width;
    }

    const groundLevel = canvasHeight - CONFIG.groundMargin - this.height;
    if (this.position.y >= groundLevel) {
      this.velocity.y = 0;
      this.position.y = groundLevel;
    } else {
      this.velocity.y += CONFIG.gravity;
    }
  }

  attack() {
    if (this.dead) return;
    this.switchSprite("attack");
    this.isAttacking = true;
  }

  switchSprite(sprite) {
    if (this.dead) {
      if (this.sprites.death && this.image !== this.sprites.death.image) {
        this.image = this.sprites.death.image;
        this.framesMax = this.sprites.death.framesMax;
        this.frameCurrent = 0;
      }
      return;
    }

    if (!this.sprites[sprite]) return;

    if (
      this.sprites.attack &&
      this.image === this.sprites.attack.image &&
      this.frameCurrent < this.sprites.attack.framesMax - 1
    ) {
      return;
    }

    if (this.image !== this.sprites[sprite].image) {
      this.image = this.sprites[sprite].image;
      this.framesMax = this.sprites[sprite].framesMax;
      this.frameCurrent = 0;
    }
  }

  takeHit() {
    if (this.dead) return;
    this.health -= 20;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.switchSprite("death");
    }
  }
}
