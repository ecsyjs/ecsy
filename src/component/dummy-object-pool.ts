import { Pool } from '../pool.interface';
import { Resettable } from '../resettable.interface';

export class DummyObjectPool<T extends Resettable> implements Pool<T> {
  count = 0;
  private used = 0;

  constructor(
    private objectConstructor: new (...args: any[]) => T
  ) {}

  aquire(): T {
    this.used++;
    this.count++;

    return new this.objectConstructor();
  }

  release(): void {
    this.used--;
  }

  totalSize(): number {
    return this.count;
  }

  totalFree(): number {
    return Infinity;
  }

  totalUsed(): number {
    return this.used;
  }
}
