import { Resettable } from './resettable.interface';
export interface Pool<T extends Resettable> {
    count: number;
    aquire(): T;
    release(item: T): void;
    totalSize(): number;
    totalFree(): number;
    totalUsed(): number;
}
