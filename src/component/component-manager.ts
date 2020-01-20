import { Component, ComponentConstructor } from '../component.interface';
import { ObjectPool } from '../object-pool';
import { Pool } from '../pool.interface';
import { componentPropertyName } from '../utils';
import { DummyObjectPool } from './dummy-object-pool';

export class ComponentManager {
  componentConstructors = new Map<string, ComponentConstructor>();
  componentPool = new Map<string, Pool<Component>>();

  registerComponent(componentConstructor: ComponentConstructor): void {
    if (this.componentConstructors.has(componentConstructor.name)) {
      console.warn(`Component type: '${componentConstructor.name}' already registered.`);

      return;
    }

    this.componentConstructors.set(componentConstructor.name, componentConstructor);
  }

  componentAddedToEntity(componentConstructor: ComponentConstructor): void {
    if (!this.componentConstructors.has(componentConstructor.name)) {
      this.registerComponent(componentConstructor);
    }
  }

  getComponentsPool(componentConstructor: ComponentConstructor): Pool<Component> {

    const componentName = componentPropertyName(componentConstructor);

    if (!this.componentPool.has(componentName)) {

      if (componentConstructor.prototype.reset) {

        this.componentPool.set(componentName, new ObjectPool(componentConstructor));

      } else {

        console.warn(
          `Component '${componentConstructor.name}' won't benefit from pooling because 'reset' method was not implemeneted.`
        );
        this.componentPool.set(componentName, new DummyObjectPool(componentConstructor));

      }
    }
    
    return this.componentPool.get(componentName);
  }
}
