import { Pool } from '../pool.interface';
import { Resettable } from '../resettable.interface';
export declare class DummyObjectPool<T extends Resettable> implements Pool<T> {
    private objectConstructor;
    count: number;
    private used;
    constructor(objectConstructor: new (...args: any[]) => T);
    aquire(): T;
    release(): void;
    totalSize(): number;
    totalFree(): number;
    totalUsed(): number;
}
