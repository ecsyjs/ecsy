export class DummyObjectPool {
  isDummyObjectPool = true;
  count = 0;
  used = 0;

  constructor(
    private T: any
  ) {}

  aquire() {
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
