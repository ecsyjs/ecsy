export class Vector3 {
  constructor(x, y, z) {
    this.set(x, y, z);
  }

  copy(src) {
    this.x = src.x;
    this.y = src.y;
    this.z = src.z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  toArray() {
    return [this.x, this.y, this.z];
  }
}
