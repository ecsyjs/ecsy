import { Types } from "./StandardTypes";

var standardTypes = {
  number: Types.Number,
  boolean: Types.Boolean,
  string: Types.String
};

/**
 * Try to infer the type of the value
 * @param {*} value
 * @return {String} Type of the attribute
 * @private
 */
export function inferType(value) {
  if (Array.isArray(value)) {
    return Types.Array;
  }

  if (standardTypes[typeof value]) {
    return standardTypes[typeof value];
  } else {
    return null;
  }
}
