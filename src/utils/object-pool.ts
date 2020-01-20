import { Pool } from '../pool.interface';
import { Resettable } from '../resettable.interface';

export class ObjectPool<T extends Resettable> implements Pool<T> {
  count = 0;
  private freeList: T[] = [];

  private createElement: () => T;

  // @todo Add initial size
  constructor(
    objectConstructor: new (...args) => T,
    initialSize?: number,
  ) {

    let extraArgs = null;

    if (arguments.length > 1) {
      extraArgs = Array.prototype.slice.call(arguments);
      extraArgs.shift();
    }

    this.createElement = extraArgs
      ? () => new objectConstructor(...extraArgs)
      : () => new objectConstructor();

    if (typeof initialSize !== 'undefined') {
      this.expand(initialSize);
    }
  }

  aquire(): T {
    // Grow the list by 20%ish if we're out
    if (this.freeList.length <= 0) {
      this.expand(Math.round(this.count * 0.2) + 1);
    }

    const item = this.freeList.pop();

    return item;
  }

  release(item: T): void {
    if (item.reset) {
      item.reset();
    }
    this.freeList.push(item);
  }

  private expand(count: number): void {
    for (let n = 0; n < count; n++) {
      this.freeList.push(this.createElement());
    }
    this.count += count;
  }

  totalSize(): number {
    return this.count;
  }

  totalFree(): number {
    return this.freeList.length;
  }

  totalUsed(): number {
    return this.count - this.freeList.length;
  }
}
