import { TypeDefinition } from './create-type';
import { standardTypes } from './standard-types';

/**
 * Try to infer the type of the value
 * @return Type of the attribute
 */
export function inferType(value: unknown): TypeDefinition<NumberConstructor | BooleanConstructor | BooleanConstructor | ArrayConstructor> {
  if (Array.isArray(value)) {
    return standardTypes.array;
  } else if (standardTypes[typeof value]) {
    return standardTypes[typeof value];
  } else {
    return null;
  }
}
