export enum Types {
  Number = 'number',
  Boolean = 'boolean',
  String = 'string',
  Array = 'array',
}


const standardTypes = {
  number: Types.Number,
  boolean: Types.Boolean,
  string: Types.String
};

/**
 * Try to infer the type of the value
 * @return Type of the attribute
 */
export function inferType(value: unknown): string {
  if (Array.isArray(value)) {
    return Types.Array;
  }

  if (standardTypes[typeof value]) {
    return standardTypes[typeof value];
  } else {
    return null;
  }
}
