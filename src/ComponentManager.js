import { ObjectPool } from "./ObjectPool.js";

export class ComponentManager {
  constructor() {
    this.Components = [];
    this._ComponentsMap = {};

    this._componentPool = {};
    this.numComponents = {};
    this.nextComponentId = 0;
  }

  registerComponent(Component, objectPool) {
    if (this.Components.indexOf(Component) !== -1) {
      console.warn(
        `Component type: '${Component.getName()}' already registered.`
      );
      return;
    }

    const schema = Component.schema;

    if (!schema) {
      throw new Error(
        `Component "${Component.getName()}" has no schema property.`
      );
    }

    for (const propName in schema) {
      const prop = schema[propName];

      if (!prop.type) {
        throw new Error(
          `Invalid schema for component "${Component.getName()}". Missing type for "${propName}" property.`
        );
      }
    }

    Component._ecsyId = this.nextComponentId++;
    this.Components.push(Component);
    this._ComponentsMap[Component._ecsyId] = Component;
    this.numComponents[Component._ecsyId] = 0;

    if (objectPool === undefined) {
      objectPool = new ObjectPool(Component);
    } else if (objectPool === false) {
      objectPool = undefined;
    }

    this._componentPool[Component._ecsyId] = objectPool;
  }

  componentAddedToEntity(Component) {
    this.numComponents[Component._ecsyId]++;
  }

  componentRemovedFromEntity(Component) {
    this.numComponents[Component._ecsyId]--;
  }

  getComponentsPool(Component) {
    return this._componentPool[Component._ecsyId];
  }
}
