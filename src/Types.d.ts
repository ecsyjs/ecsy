export type TypeCopyFunction<T> = (src: T, dest: T) => T;
export type TypeCloneFunction<T> = (value: T) => T;

export interface PropTypeDefinition<T, D> {
  name: string
  default: D
  copy: TypeCopyFunction<T>
  clone: TypeCloneFunction<T>
}

export interface PropType<T, D> extends PropTypeDefinition<T, D> {
  isType: true
}

export interface PropTypes {
  Number: PropType<number, number>;
  Boolean: PropType<boolean, boolean>;
  String: PropType<string, string>;
  Array: PropType<Array<any>, Array<any>>;
  Ref: PropType<any, undefined>;
  JSON: PropType<any, null>;
}

export const Types: PropTypes;

export function copyValue<T>(src: T, dest: T): T;
export function cloneValue<T>(value: T): T;

export function copyArray<T>(src: T, dest: T): Array<T>;
export function cloneArray<T>(value: Array<T>): Array<T>;

export function copyJSON(src: any, dest: any): any;
export function cloneJSON(value: any): any;

export function copyCopyable<T>(src: T, dest: T): T;
export function cloneClonable<T>(value: T): T;

/**
 * Use createType to create custom type definitions.
 * @param typeDefinition An object with create, reset and clear functions for the custom type.
 */
export function createType<T, D>(typeDefinition: PropTypeDefinition<T, D>): PropType<T, D>
