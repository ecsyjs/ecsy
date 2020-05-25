export class Vector3 {
  constructor(x, y, z) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  toArray() {
    return [this.x, this.y, this.z];
  }

  copy(src) {
    this.x = src.x;
    this.y = src.y;
    this.z = src.z;
    return this;
  }

  clone() {
    return new Vector3().copy(this);
  }

  equals(other) {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }
}
