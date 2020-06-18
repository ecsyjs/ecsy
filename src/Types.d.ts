import { Component } from "./Component";

export type TypeCopyFunction<T> = (src: T, dest: T) => T;
export type TypeCloneFunction<T> = (value: T) => T;

export interface PropTypeDefinition<T> {
  name: string
  default: T
  copy: TypeCopyFunction<T>
  clone: TypeCloneFunction<T>
}

export interface PropType<T> extends PropTypeDefinition<T> {
  isType: true
}

export interface PropTypes {
  Number: PropType<number>;
  Boolean: PropType<boolean>;
  String: PropType<string>;
  Array: PropType<Array<any>>;
  Object: PropType<any>;
  JSON: PropType<any>;
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
export function createType<T>(typeDefinition: PropTypeDefinition<T>): PropType<T>
