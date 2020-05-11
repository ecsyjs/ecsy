import { Component } from "./Component";

export interface TypeDefinition<T> {
  baseType?: T
  isType?: boolean
  create(defaultValue: T): any
  reset(src: Component, key: string, defaultValue: T): any
  clear(src: Component, key: string): any
  copy?: (src: Component, dst: Component, key: string) => any
}

/**
 * Use createType to create custom type definitions.
 * @param typeDefinition An object with create, reset and clear functions for the custom type.
 */
export function createType(typeDefinition: TypeDefinition): TypeDefinition
