import { Component, ComponentConstructor } from '../component.interface';
import { Resettable } from '../resettable.interface';
import { EntityManager } from './entity-manager';
import { Query, QueryEvents } from './query';
import { wrapImmutableComponent } from './wrap-immutable-component';

// tslint:disable:no-bitwise

// @todo Take this out from there or use ENV
const DEBUG = false;

let nextId = 0;

export class Entity implements Resettable {
  // Unique ID for this entity
  id = nextId++;

  // List of components types the entity has
  componentTypes = new Set<ComponentConstructor>();

  // Instance of the components
  components = new Map<string, Component>();

  componentsToRemove = new Map<string, Component>();

  // Queries where the entity is added
  queries: Query[] = [];

  // Used for deferred removal
  componentTypesToRemove = new Set<ComponentConstructor>();

  alive = false;

  constructor(
    public entityManager: EntityManager,
  ) {}

  // COMPONENTS

  getComponent(componentConstructor: ComponentConstructor, includeRemoved?: boolean): Component {
    let component = this.components.get(componentConstructor.name);

    if (!component && includeRemoved === true) {
      component = this.componentsToRemove.get(componentConstructor.name);
    }

    return DEBUG ? wrapImmutableComponent(component) : component;
  }

  getMutableComponent(componentConstructor: ComponentConstructor): Component {
    const component = this.components.get(componentConstructor.name);

    for (const query of this.queries) {

      // @todo accelerate this check. Maybe having query._Components as an object
      if (query.reactive && query.componentConstructors.indexOf(componentConstructor) !== -1) {
        query.eventDispatcher.dispatchEvent(
          QueryEvents.COMPONENT_CHANGED,
          this,
          component
        );
      }
    }

    return component;
  }

  /**
   * Once a component is removed from an entity, it is possible to access its contents
   */
  getRemovedComponent(componentConstructor: ComponentConstructor): Component {
    return this.componentsToRemove.get(componentConstructor.name);
  }

  getComponents(): Map<string, Component> {
    return this.components;
  }

  getComponentsToRemove(): Map<string, Component> {
    return this.componentsToRemove;
  }

  getComponentTypes(): Set<ComponentConstructor> {
    return this.componentTypes;
  }


  addComponent(componentConstructor: ComponentConstructor, values?: { [key: string]: any }): this {
    this.entityManager.entityAddComponent(this, componentConstructor, values);

    return this;
  }

  /**
   * This will mark the component to be removed and will populate all the queues from the
   * systems that are listening to that event, but the component itself won't be disposed
   * until the end of the frame, we call it deferred removal. This is done so systems that
   * need to react to it can still access the data of the components.
   */
  removeComponent(componentConstructor: ComponentConstructor, forceRemove?: boolean): this {
    this.entityManager.entityRemoveComponent(this, componentConstructor, forceRemove);

    return this;
  }

  hasComponent(componentConstructor: ComponentConstructor, includeRemoved?: boolean): boolean {
    return (
      this.componentTypes.has(componentConstructor) ||
      (includeRemoved === true && this.hasRemovedComponent(componentConstructor))
    );
  }

  hasRemovedComponent(componentConstructor: ComponentConstructor): boolean {
    return this.componentTypesToRemove.has(componentConstructor);
  }

  hasAllComponents(componentConstructors: ComponentConstructor[]): boolean {
    for (const component of componentConstructors) {
      if (!this.hasComponent(component)) { return false; }
    }

    return true;
  }

  hasAnyComponents(componentConstructors: ComponentConstructor[]): boolean {
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
    this.componentTypes.clear();
    this.queries.length = 0;
    this.components.clear();
  }

  remove(forceRemove?: boolean) {
    return this.entityManager.removeEntity(this, forceRemove);
  }
}
