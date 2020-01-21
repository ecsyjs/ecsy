export class Vector2 {

  constructor(
    public x = 0,
    public y = 0,
  ) {}

  set(x, y) {
    this.x = x;
    this.y = y;
  }

  copy(src: Vector2) {
    this.x = src.x;
    this.y = src.y;
  }
}
