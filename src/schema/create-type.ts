
export interface TypeDefinition<T> {
  baseType?: T;
  isType?: boolean;
  isSimpleType?: boolean;
  create(defaultValue): void;
  reset(src, key, defaultValue): void;
  clear(src, key): void;
  copy?(src, dst, key): void;
}

export function createType<T>(typeDefinition: TypeDefinition<T>): TypeDefinition<T> {
  const mandatoryFunctions = [
    'create',
    'reset',
    'clear'
    /*"copy"*/
  ];

  const undefinedFunctions = mandatoryFunctions.filter(f => {
    return !typeDefinition[f];
  });

  if (undefinedFunctions.length > 0) {
    throw new Error(
      `createType expect type definition to implements the following functions: ${undefinedFunctions.join(
        ', '
      )}`
    );
  }

  typeDefinition.isType = true;

  return typeDefinition;
}
