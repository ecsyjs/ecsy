export class Component {
  constructor(props) {
    const schema = this.constructor.schema;

    for (const key in schema) {
      const schemaProp = schema[key];

      if (props && props.hasOwnProperty(key)) {
        this[key] = props[key];
      } else if (schemaProp.hasOwnProperty("default")) {
        this[key] = schemaProp.type.clone(schemaProp.default);
      } else {
        const type = schemaProp.type;
        this[key] = type.clone(type.default);
      }
    }

    this._pool = null;
  }

  copy(source) {
    const schema = this.constructor.schema;

    for (const key in source) {
      if (schema.hasOwnProperty(key)) {
        const prop = schema[key];
        prop.type.copy(source, this, key);
      }
    }

    return this;
  }

  clone() {
    return new this.constructor().copy(this);
  }

  dispose() {
    if (this._pool) {
      this._pool.release(this);
    }
  }
}

Component.schema = {};
Component.isComponent = true;
