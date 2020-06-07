import { Component } from "./Component";

export type TypeCopyFunction<T> = (src: Component<any>, dest: Component<any>, key: string) => T;
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

export interface Types {
  Number: PropType<number>;
  Boolean: PropType<boolean>;
  String: PropType<string>;
  Array: PropType<Array<any>>;
  Object: PropType<any>;
  JSON: PropType<any>;
}

export function copyValue<T>(src: Component<any>, dest: Component<any>, key: string): T;
export function cloneValue<T>(value: T): T;

export function copyArray<T>(src: Component<any>, dest: Component<any>, key: string): Array<T>;
export function cloneArray<T>(value: Array<T>): Array<T>;

export function copyJSON(src: Component<any>, dest: Component<any>, key: string): any;
export function cloneJSON(value: any): any;

export function copyCopyable<T>(src: Component<any>, dest: Component<any>, key: string): T;
export function cloneClonable<T>(value: T): T;

/**
 * Use createType to create custom type definitions.
 * @param typeDefinition An object with create, reset and clear functions for the custom type.
 */
export function createType<T>(typeDefinition: PropTypeDefinition<T>): PropType<T>
