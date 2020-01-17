import { EntityManager } from './entity-manager';
import { Query } from './query';
import { wrapImmutableComponent } from './wrap-immutable-component';
import { ComponentConstructor, Component } from '../component.interface';

// tslint:disable:no-bitwise

// @todo Take this out from there or use ENV
const DEBUG = false;

let nextId = 0;

export class Entity {
  // Unique ID for this entity
  id = nextId++;

  // List of components types the entity has
  ComponentTypes: ComponentConstructor<Component>[] = [];

  // Instance of the components
  components: { [key: string]: Component; } = {};

  componentsToRemove: { [key: string]: Component; } = {};

  // Queries where the entity is added
  queries: Query[] = [];

  // Used for deferred removal
  ComponentTypesToRemove: ComponentConstructor<Component>[] = [];

  alive = false;

  constructor(
    public entityManager: EntityManager,
  ) {}

  // COMPONENTS

  getComponent<T extends Component>(componentConstructor: ComponentConstructor<T>, includeRemoved?: boolean): T {
    let component = this.components[componentConstructor.name];

    if (!component && includeRemoved === true) {
      component = this.componentsToRemove[componentConstructor.name];
    }

    return DEBUG ? wrapImmutableComponent(component) : component;
  }

  getRemovedComponent<T extends Component>(componentConstructor: ComponentConstructor<T>): T {
    return this.componentsToRemove[componentConstructor.name];
  }

  getComponents<T extends Component>(): { [key: string]: T; } {
    return this.components;
  }

  getComponentsToRemove<T extends Component>(): { [key: string]: T; } {
    return this.componentsToRemove;
  }

  getComponentTypes(): ComponentConstructor<Component>[] {
    return this.ComponentTypes;
  }

  getMutableComponent<T extends Component>(componentConstructor: ComponentConstructor<T>): T {
    const component = this.components[componentConstructor.name];

    for (const query of this.queries) {
      // @todo accelerate this check. Maybe having query._Components as an object
      if (query.reactive && query.Components.indexOf(componentConstructor) !== -1) {
        query.eventDispatcher.dispatchEvent(
          Query.prototype.COMPONENT_CHANGED,
          this,
          component
        );
      }
    }

    return component;
  }

  addComponent(componentConstructor: ComponentConstructor<Component>, values?: any): this {
    this.entityManager.entityAddComponent(this, componentConstructor, values);

    return this;
  }

  removeComponent(componentConstructor: ComponentConstructor<Component>, forceRemove?: boolean): this {
    this.entityManager.entityRemoveComponent(this, componentConstructor, forceRemove);

    return this;
  }

  hasComponent(componentConstructor: ComponentConstructor<Component>, includeRemoved?: boolean): boolean {
    return (
      !!~this.ComponentTypes.indexOf(componentConstructor) ||
      (includeRemoved === true && this.hasRemovedComponent(componentConstructor))
    );
  }

  hasRemovedComponent(componentConstructor: ComponentConstructor<Component>): boolean {
    return !!~this.ComponentTypesToRemove.indexOf(componentConstructor);
  }

  hasAllComponents(componentConstructors: ComponentConstructor<Component>[]): boolean {
    for (const component of componentConstructors) {
      if (!this.hasComponent(component)) { return false; }
    }

    return true;
  }

  hasAnyComponents(componentConstructors: ComponentConstructor<Component>[]): boolean {
    for (const component of componentConstructors) {
      if (this.hasComponent(component)) { return true; }
    }

    return false;
  }

  removeAllComponents(forceRemove?: boolean) {
    return this.entityManager.entityRemoveAllComponents(this, forceRemove);
  }

  // EXTRAS

  // Initialize the entity. To be used when returning an entity to the pool
  reset() {
    this.id = nextId++;
    this.entityManager = null;
    this.ComponentTypes.length = 0;
    this.queries.length = 0;
    this.components = {};
  }

  remove(forceRemove?: boolean) {
    return this.entityManager.removeEntity(this, forceRemove);
  }
}
