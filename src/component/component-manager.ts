import { Component, ComponentConstructor } from '../component.interface';
import { ObjectPool } from '../object-pool';
import { Pool } from '../pool.interface';
import { DummyObjectPool } from './dummy-object-pool';

export class ComponentManager {
  componentConstructors = new Set<ComponentConstructor>();
  componentPool = new Map<ComponentConstructor, Pool<Component>>();

  registerComponent(componentConstructor: ComponentConstructor): void {
    if (this.componentConstructors.has(componentConstructor)) {
      console.warn(`Component type: '${componentConstructor.name}' already registered.`);

      return;
    }

    this.componentConstructors.add(componentConstructor);
  }

  componentAddedToEntity(componentConstructor: ComponentConstructor): void {
    if (!this.componentConstructors.has(componentConstructor)) {
      this.registerComponent(componentConstructor);
    }
  }

  getComponentsPool(componentConstructor: ComponentConstructor): Pool<Component> {

    if (!this.componentPool.has(componentConstructor)) {

      if (componentConstructor.prototype.reset) {

        this.componentPool.set(componentConstructor, new ObjectPool(componentConstructor));

      } else {

        console.warn(
          `Component '${componentConstructor.name}' won't benefit from pooling because 'reset' method was not implemeneted.`
        );
        this.componentPool.set(componentConstructor, new DummyObjectPool(componentConstructor));

      }
    }

    return this.componentPool.get(componentConstructor);
  }
}
