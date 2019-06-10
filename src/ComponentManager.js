import ObjectPool from "./ObjectPool.js";
import { componentPropertyName } from "./Utils.js";

/**
 * @class ComponentManager
 */
export class ComponentManager {
  constructor() {
    this.Components = {};
    this.SingletonComponents = {};
    this._componentPool = {};
    this.numComponents = {};
  }

  /**
   * Register a component
   * @param {Component} Component Component to register
   */
  registerComponent(Component) {
    this.Components[Component.name] = Component;
    this.numComponents[Component.name] = 0;
  }

  /**
   * Register a singleton component
   * @param {Component} Component Component to register as singleton
   */
  registerSingletonComponent(Component) {
    this.SingletonComponents[Component.name] = Component;
  }

  componentAddedToEntity(Component) {
    if (!this.numComponents[Component.name]) {
      this.numComponents[Component.name] = 1;
    } else {
      this.numComponents[Component.name]++;
    }
  }

  componentRemovedFromEntity(Component) {
    this.numComponents[Component.name]--;
  }

  /**
   * Get components pool
   * @param {Component} Component Type of component type for the pool
   */
  getComponentsPool(Component) {
    var componentName = componentPropertyName(Component);

    if (!this._componentPool[componentName]) {
      this._componentPool[componentName] = new ObjectPool(Component);
    }

    return this._componentPool[componentName];
  }
}
