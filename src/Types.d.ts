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

export type NumberPropType = PropType<number, number>;
export type BooleanPropType = PropType<boolean, boolean>;
export type StringPropType = PropType<string, string>;
export type ArrayPropType<T> = PropType<Array<T>, []>;
export type RefPropType<T> = PropType<T, undefined>;
export type JSONPropType = PropType<any, null>;

export const Types: {
  Number: NumberPropType,
  Boolean: BooleanPropType,
  String: StringPropType,
  Array: ArrayPropType<any>,
  Ref: RefPropType<any>,
  JSON: JSONPropType
};

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
