export class AbstractComponent {
  copy() {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`'.copy()' method unimplemented`);
    }
    return this;
  }

  clone() {
    return new this.constructor().copy(this);
  }

  setProperties() {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`'.setProperties()' method unimplemented`);
    }
    return this;
  }

  reset() {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`'.reset()' method unimplemented`);
    }
  }

  dispose() {
    if (this._pool) {
      this._pool.release(this);
    }
  }

  getName() {
    return this.constructor.getName();
  }
}
AbstractComponent.getName = function() {
  return this.displayName || this.name;
};
AbstractComponent.isComponent = true;

export class Component extends AbstractComponent {
  constructor(props) {
    super();
    this.setProperties(props);
    this._pool = null;
  }

  copy(source) {
    const schema = this.constructor.schema;

    for (const key in schema) {
      const prop = schema[key];

      if (source.hasOwnProperty(key)) {
        this[key] = prop.type.copy(source[key], this[key]);
      }
    }

    // @DEBUG
    if (process.env.NODE_ENV !== "production") {
      this.checkUndefinedAttributes(source);
    }

    return this;
  }

  setProperties(props) {
    const schema = this.constructor.schema;

    for (const key in schema) {
      if (props && props.hasOwnProperty(key)) {
        this[key] = props[key];
      } else {
        const schemaProp = schema[key];
        if (schemaProp.hasOwnProperty("default")) {
          this[key] = schemaProp.type.clone(schemaProp.default);
        } else {
          const type = schemaProp.type;
          this[key] = type.clone(type.default);
        }
      }
    }

    if (process.env.NODE_ENV !== "production" && props !== undefined) {
      this.checkUndefinedAttributes(props);
    }

    return this;
  }

  reset() {
    const schema = this.constructor.schema;

    for (const key in schema) {
      const schemaProp = schema[key];

      if (schemaProp.hasOwnProperty("default")) {
        this[key] = schemaProp.type.copy(schemaProp.default, this[key]);
      } else {
        const type = schemaProp.type;
        this[key] = type.copy(type.default, this[key]);
      }
    }
  }

  getName() {
    return this.constructor.getName();
  }

  checkUndefinedAttributes(src) {
    const schema = this.constructor.schema;

    // Check that the attributes defined in source are also defined in the schema
    Object.keys(src).forEach((srcKey) => {
      if (!schema.hasOwnProperty(srcKey)) {
        console.warn(
          `Trying to set attribute '${srcKey}' not defined in the '${this.constructor.name}' schema. Please fix the schema, the attribute value won't be set`
        );
      }
    });
  }
}

Component.schema = {};
Component.isSchemaComponent = true;
