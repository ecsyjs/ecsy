export class ObjectPool<T> {
  constructor(baseObject: { new(...args: any[]): T }, initialSize?: number)
  acquire(): T
  release(item: T): void
  expand(count: number): void
  totalSize(): number
  totalFree(): number
  totalUsed(): number
}
