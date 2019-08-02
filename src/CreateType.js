export function createType(typeDefinition) {
  var mandatoryFunctions = [
    "create",
    "reset",
    "clear"
    /*"copy"*/
  ];

  var undefinedFunctions = mandatoryFunctions.filter(f => {
    return !typeDefinition[f];
  });

  if (undefinedFunctions.length > 0) {
    console.error(
      `createType expect type definition to implements the following functions: ${undefinedFunctions.join(
        ", "
      )}`
    );
    return null;
  }

  typeDefinition.isType = true;
  return typeDefinition;
}
