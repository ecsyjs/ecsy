import { Pool } from '../pool.interface';
import { Resettable } from '../resettable.interface';
export declare class ObjectPool<T extends Resettable> implements Pool<T> {
    count: number;
    private freeList;
    private createElement;
    constructor(objectConstructor: new (...args: any[]) => T, initialSize?: number);
    aquire(): T;
    release(item: T): void;
    private expand;
    totalSize(): number;
    totalFree(): number;
    totalUsed(): number;
}
