export default class DummyObjectPool {
  constructor(T) {
    this.isDummyObjectPool = true;
    this.count = 0;
    this.used = 0;
    this.T = T;
  }

  acquire() {
    this.used++;
    this.count++;
    return new this.T();
  }

  release() {
    this.used--;
  }

  totalSize() {
    return this.count;
  }

  totalFree() {
    return Infinity;
  }

  totalUsed() {
    return this.used;
  }
}
