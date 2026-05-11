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
    super({ position, imageSrc, scale, framesMax });
    this.velocity = velocity; // kecepatan gerak
    this.width = 50;
    this.height = 150;
    this.health = 100;
    this.isAttacking = false;
    this.color = color;
    this.dead = false;
    this.offset = offset;
    this.facing = "right";

    this.sprites = sprites;
    for (const sprite in this.sprites) {
      sprites[sprite].image = new Image();
      sprites[sprite].image.src = sprites[sprite].imageSrc;
    }

    this.attackBox = {
      position: { x: this.position.x, y: this.position.y },
      width: 100,
      height: 50,
    };
  }

  update(ctx, canvasHeight) {
    super.update(ctx);

    // gerakan attack box mengikuti posisi fighter
    this.attackBox.position.x = this.position.x;
    this.attackBox.position.y = this.position.y;

    // update posisi fighter berdasarkan kecepatan
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // BATAS TEMBOK  KIRI
    if (this.position.x < 0) {
      this.position.x = 0;
    }

    // BATAS TEMBOK  KANAN
    if (this.position.x + this.width > CONFIG.canvasWidth) {
      this.position.x = CONFIG.canvasWidth - this.width;
    }

    // buat jika benturan dengan lantai
    if (
      this.position.y + this.height + this.velocity.y >=
      canvasHeight - CONFIG.groundMargin
    ) {
      this.velocity.y = 0;
      //   this.position.y = canvasHeight -  - this.height;
    } else {
      this.velocity.y += CONFIG.gravity;
    }
  }

  attack() {
    this.switchSprite("attack");
    this.isAttacking = true;
    setTimeout(() => {
      this.isAttacking = false;
    }, 100);
  }

  switchSprite(sprite) {
    if (
      this.image === this.sprites.attack.image &&
      this.frameCurrent < this.sprites.attack.framesMax - 1
    )
      return;

    if (this.image !== this.sprites[sprite].image) {
      this.image = this.sprites[sprite].image;
      this.framesMax = this.sprites[sprite].framesMax;
      this.frameCurrent = 0;
    }
  }

  // Logika untuk mengurangi health saat terkena serangan
  takeHit() {
    if (this.dead) return; // Jika sudah mati maka berenti
    this.health -= 20;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;

      if (this.sprites.death) {
        this.switchSprite("death");
      }
    }
  }
}
