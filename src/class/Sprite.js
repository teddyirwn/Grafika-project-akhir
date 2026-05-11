export class Sprite {
  constructor({ position, imageSrc, scale = 1, framesMax = 1 }) {
    this.position = position;
    this.imageSrc = imageSrc;
    this.scale = scale;
    this.framesMax = framesMax;
    this.image = new Image();
    this.image.src = imageSrc;
    this.frameCurrent = 0;
    this.framesElapsed = 0;
    this.framesHold = 5;
  }

  // funsi menampilkan gambar di canvas

  draw(ctx) {
    ctx.drawImage(
      this.image,
      this.frameCurrent * (this.image.width / this.framesMax),
      0,
      this.image.width / this.framesMax,
      this.image.height,
      this.position.x,
      this.position.y,
      (this.image.width / this.framesMax) * this.scale,
      this.image.height * this.scale,
    );
  }

  // fungsi untuk menggerak frame gambar  / animasikan

  update(ctx) {
    this.draw(ctx);
    this.framesElapsed++;

    if (this.framesElapsed % this.framesHold === 0) {
      if (this.frameCurrent < this.framesMax - 1) {
        this.frameCurrent++;
      } else {
        this.frameCurrent = 0;
      }
    }
  }
}
