import { inferType } from "./Types";

export function createComponent(schema, name) {
  //var Component = new Function(`return function ${name}() {}`)();
  for (let key in schema) {
    let type = schema[key].type;
    if (!type) {
      schema[key].type = inferType(schema[key].default);
    }
  }

  var Component = function() {
    for (let key in schema) {
      var attr = schema[key];
      let type = attr.type;
      if (type && type.isType) {
        this[key] = type.create(attr.default);
      } else {
        this[key] = attr.default;
      }
    }
  };

  if (typeof name !== "undefined") {
    Object.defineProperty(Component, "name", { value: name });
  }

  Component.prototype.schema = schema;

  var knownTypes = true;
  for (let key in schema) {
    var attr = schema[key];
    if (!attr.type) {
      attr.type = inferType(attr.default);
    }

    var type = attr.type;
    if (!type) {
      console.warn(
        `Unknown type definition for attribute '${key}' with type '${schema[
          key
        ].type}'`
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
        let type = schema[key].type;
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
        let type = attr.type;
        if (type.reset) type.reset(this, key, attr.default);
      }
    };

    Component.prototype.clear = function() {
      for (let key in schema) {
        let type = schema[key].type;
        if (type.reset) type.clear(this, key);
      }
    };

    for (let key in schema) {
      let attr = schema[key];
      let type = attr.type;
      Component.prototype[key] = attr.default;

      if (type.reset) {
        type.reset(Component.prototype, key, attr.default);
      }
    }
  }

  return Component;
}
