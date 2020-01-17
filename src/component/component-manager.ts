import { ComponentConstructor, Component } from '../component.interface';
import { ObjectPool } from '../object-pool';
import { componentPropertyName } from '../utils';
import { DummyObjectPool } from './dummy-object-pool.js';

export class ComponentManager {
  Components: { [key: string]: ComponentConstructor<Component>; } = {};
  componentPool: { [key: string]: ObjectPool<Component, ComponentConstructor<Component>> | DummyObjectPool; } = {};
  numComponents: { [key: string]: number } = {};

  registerComponent(componentConstructor: ComponentConstructor<Component>): void {
    if (this.Components[componentConstructor.name]) {
      console.warn(`Component type: '${componentConstructor.name}' already registered.`);
      return;
    }

    this.Components[componentConstructor.name] = componentConstructor;
    this.numComponents[componentConstructor.name] = 0;
  }

  componentAddedToEntity(componentConstructor: ComponentConstructor<Component>): void {
    if (!this.Components[componentConstructor.name]) {
      this.registerComponent(componentConstructor);
    }

    this.numComponents[componentConstructor.name]++;
  }

  componentRemovedFromEntity(componentConstructor: ComponentConstructor<Component>): void {
    this.numComponents[componentConstructor.name]--;
  }

  getComponentsPool<T extends Component>(componentConstructor: ComponentConstructor<T>)
    : ObjectPool<T, ComponentConstructor<T>> | DummyObjectPool {

    const componentName = componentPropertyName(componentConstructor);

    if (!this.componentPool[componentName]) {
      if (componentConstructor.prototype.reset) {
        this.componentPool[componentName] = new ObjectPool(componentConstructor);
      } else {
        console.warn(
          `Component '${componentConstructor.name}' won't benefit from pooling because 'reset' method was not implemeneted.`
        );
        this.componentPool[componentName] = new DummyObjectPool(componentConstructor);
      }
    }

    return this.componentPool[componentName];
  }
}
