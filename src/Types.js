export const copyValue = src => src;

export const cloneValue = src => src;

export const copyArray = (src, dest) => {
  const srcArray = src;
  const destArray = dest;

  destArray.length = 0;

  for (let i = 0; i < srcArray.length; i++) {
    destArray.push(srcArray[i]);
  }

  return destArray;
};

export const cloneArray = src => src.slice();

export const copyJSON = src => JSON.parse(JSON.stringify(src));

export const cloneJSON = src => JSON.parse(JSON.stringify(src));

export const copyCopyable = (src, dest) => dest.copy(src);

export const cloneClonable = src => src.clone();

export function createType(typeDefinition) {
  var mandatoryProperties = ["name", "default", "copy", "clone"];

  var undefinedProperties = mandatoryProperties.filter(p => {
    return !typeDefinition.hasOwnProperty(p);
  });

  if (undefinedProperties.length > 0) {
    throw new Error(
      `createType expects a type definition with the following properties: ${undefinedProperties.join(
        ", "
      )}`
    );
  }

  typeDefinition.isType = true;

  return typeDefinition;
}

/**
 * Standard types
 */
export const Types = {
  Number: createType({
    name: "Number",
    default: 0,
    copy: copyValue,
    clone: cloneValue
  }),

  Boolean: createType({
    name: "Boolean",
    default: false,
    copy: copyValue,
    clone: cloneValue
  }),

  String: createType({
    name: "String",
    default: "",
    copy: copyValue,
    clone: cloneValue
  }),

  Array: createType({
    name: "Array",
    default: [],
    copy: copyArray,
    clone: cloneArray
  }),

  Ref: createType({
    name: "Ref",
    default: undefined,
    copy: copyValue,
    clone: cloneValue
  }),

  JSON: createType({
    name: "JSON",
    default: null,
    copy: copyJSON,
    clone: cloneJSON
  })
};
