export interface Types {
  Number:object;
  Boolean:object;
  String:object;
}

/**
 * Use createType to create custom type definitions.
 * @param typeDefinition An object with create, reset and clear functions for the custom type.
 */
export function createType(typeDefinition: object):object
