/**
 * Try to infer the type of the value
 * @param {*} value
 * @return {String} Type of the attribute
 */
export function inferType(value) {
  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

var typeDefinition = {};

/**
 * Define a new data type
 * @param {String} name Name of the new type to define
 * @param {Object} definition Definition of the type
 * @param {Boolean} override If true it will override the type if exists
 */
export function defineType(name, definition, override) {
  if (name in typeDefinition && !override) {
    console.warn(
      `Trying to define an existing type '${name}' without 'override = true'`
    );
    return;
  }

  // @todo Check the definition

  typeDefinition[name] = definition;
}

// Define the simple data types on javascript
defineType("number", {
  isSimpleType: true,
  default: 0,
  reset: (src, key, defaultValue) => {
    src[key] = defaultValue;
  },
  clear: (src, key) => {
    src[key] = 0;
  }
});

defineType("string", {
  isSimpleType: true,
  default: "",
  reset: (src, key) => {
    src[key] = "";
  }
});

defineType("boolean", {
  isSimpleType: true,
  default: false,
  reset: (src, key) => {
    src[key] = false;
  }
});

defineType("array", {
  clear: (src, key) => {
    src[key].length = 0;
  },
  reset: (src, key, value) => {
    if (typeof value !== "undefined") {
      src[key] = value.slice();
    } else src[key].length = 0;
  },
  copy: (dst, src, key) => {
    dst[key] = src[key].slice();
  }
});

//
export function createComponent(schema, name) {
  if (typeof name === "undefined") name = "Component";

  var Component = new Function(`return function ${name}() {}`)();

  Component.prototype.schema = schema;

  var knownTypes = true;
  for (let key in schema) {
    var attr = schema[key];
    if (!attr.type) {
      attr.type = inferType(attr.default);
    }

    var type = typeDefinition[attr.type];
    if (!type) {
      console.warn(
        `Unknown type definition for attribute '${key}' with type '${schema[
          key
        ].type.toString()}'`
      );
      knownTypes = false;
    }
  }

  if (!knownTypes) {
    console.warn(
      `This component can't use pooling because some data types are not registered. Please use 'defineType' to register them`
    );

    for (var key in schema) {
      let attr = schema[key];
      Component.prototype[key] = attr.default;
    }
  } else {
    Component.prototype.copy = function(src) {
      for (let key in schema) {
        let type = typeDefinition[schema[key].type];
        if (type.isSimpleType) {
          this[key] = src[key];
        } else {
          type.copy(this, src, key);
        }
      }
    };

    Component.prototype.reset = function() {
      for (let key in schema) {
        let attr = schema[key];
        let type = typeDefinition[attr.type];
        if (type.reset) type.reset(this, key, attr.default);
      }
    };

    Component.prototype.clear = function() {
      for (let key in schema) {
        let type = typeDefinition[schema[key].type];
        if (type.reset) type.clear(this, key);
      }
    };

    for (let key in schema) {
      let attr = schema[key];
      let type = typeDefinition[attr.type];
      if (type.reset) type.reset(Component.prototype, key, attr.default);
    }
  }

  return Component;
}
