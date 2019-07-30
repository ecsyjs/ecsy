var typeDefinition = {};

export function registerType(TypeDefinition, override) {
  if (TypeDefinition.name in typeDefinition && !override) {
    console.warn(
      `Trying to define an existing type '${
        TypeDefinition.name
      }' without 'override = true'`
    );
    return;
  }

  // @todo Check the definition

  typeDefinition[TypeDefinition.name] = TypeDefinition;
}

/**
 * Try to infer the type of the value
 * @param {*} value
 * @return {String} Type of the attribute
 */
export function inferType(value) {
  if (Array.isArray(value)) {
    return Array;
  }

  return typeof value;
}
