import { ComponentManager } from '../component';
import { ComponentConstructor, Component } from '../component.interface';
import { ObjectPool } from '../object-pool';
import { componentPropertyName, getName } from '../utils';
import { Entity } from './entity';
import { EventDispatcher } from './event-dispatcher';
import { Query } from './query';
import { QueryManager } from './query-manager';
import { SystemStateComponent } from './system-state-component';

// tslint:disable:no-bitwise

/**
 * EntityManager
 */
export class EntityManager {

  // All the entities in this instance
  entities: Entity[] = [];

  queryManager = new QueryManager(this);
  eventDispatcher = new EventDispatcher();
  private entityPool = new ObjectPool<Entity, typeof Entity>(Entity);

  // Deferred deletion
  entitiesWithComponentsToRemove: Entity[] = [];
  entitiesToRemove: Entity[] = [];
  deferredRemovalEnabled = true;

  numStateComponents = 0;

  constructor(
    private componentManager: ComponentManager,
  ) {}

  /**
   * Create a new entity
   */
  createEntity(): Entity {
    const entity = this.entityPool.aquire();

    entity.alive = true;
    entity.entityManager = this;
    this.entities.push(entity);
    this.eventDispatcher.dispatchEvent(ENTITY_CREATED, entity);

    return entity;
  }

  // COMPONENTS

  /**
   * Add a component to an entity
   * @param entity Entity where the component will be added
   * @param componentConstructor Component to be added to the entity
   * @param values Optional values to replace the default attributes
   */
  entityAddComponent(entity: Entity, componentConstructor: ComponentConstructor<Component>, values: any): void {

    if (~entity.ComponentTypes.indexOf(componentConstructor)) { return; }

    entity.ComponentTypes.push(componentConstructor);

    if ((componentConstructor as any).__proto__ === SystemStateComponent) {
      this.numStateComponents++;
    }

    const componentPool = this.componentManager.getComponentsPool(
      componentConstructor
    );

    const componentFromPool = componentPool.aquire();

    entity.components[componentConstructor.name] = componentFromPool;

    if (values) {
      if (componentFromPool.copy) {
        componentFromPool.copy(values);
      } else {
        for (const name in values) {
          if (values.hasOwnProperty(name)) {
            componentFromPool[name] = values[name];
          }
        }
      }
    }

    this.queryManager.onEntityComponentAdded(entity, componentConstructor);
    this.componentManager.componentAddedToEntity(componentConstructor);

    this.eventDispatcher.dispatchEvent(COMPONENT_ADDED, entity, componentConstructor);
  }

  /**
   * Remove a component from an entity
   * @param entity Entity which will get removed the component
   * @param componentConstructor Component to remove from the entity
   * @param immediately If you want to remove the component immediately instead of deferred (Default is false)
   */
  entityRemoveComponent(entity: Entity, componentConstructor: ComponentConstructor<Component>, immediately?: boolean): void {
    const index = entity.ComponentTypes.indexOf(componentConstructor);
    if (!~index) { return; }

    this.eventDispatcher.dispatchEvent(COMPONENT_REMOVE, entity, componentConstructor);

    if (immediately) {
      this._entityRemoveComponentSync(entity, componentConstructor, index);
    } else {
      if (entity.ComponentTypesToRemove.length === 0) {
        this.entitiesWithComponentsToRemove.push(entity);
      }

      entity.ComponentTypes.splice(index, 1);
      entity.ComponentTypesToRemove.push(componentConstructor);

      const componentName = getName(componentConstructor);
      entity.componentsToRemove[componentName] = entity.components[componentName];

      delete entity.components[componentName];
    }

    // Check each indexed query to see if we need to remove it
    this.queryManager.onEntityComponentRemoved(entity, componentConstructor);

    if ((componentConstructor as any).__proto__ === SystemStateComponent) {
      this.numStateComponents--;

      // Check if the entity was a ghost waiting for the last system state component to be removed
      if (this.numStateComponents === 0 && !entity.alive) {
        entity.remove();
      }
    }
  }

  _entityRemoveComponentSync(entity: Entity, componentConstructor: ComponentConstructor<Component>, index: number): void {
    // Remove T listing on entity and property ref, then free the component.
    entity.ComponentTypes.splice(index, 1);
    const propName = componentPropertyName(componentConstructor);
    const componentName = getName(componentConstructor);
    const componentEntity = entity.components[componentName];
    delete entity.components[componentName];
    this.componentManager.componentPool[propName].release(componentEntity);
    this.componentManager.componentRemovedFromEntity(componentConstructor);
  }

  /**
   * Remove all the components from an entity
   * @param entity Entity from which the components will be removed
   */
  entityRemoveAllComponents(entity: Entity, immediately?: boolean): void {
    const Components = entity.ComponentTypes;

    for (let j = Components.length - 1; j >= 0; j--) {
      if ((Components[j] as any).__proto__ !== SystemStateComponent) {
        this.entityRemoveComponent(entity, Components[j], immediately);
      }
    }
  }

  /**
   * Remove the entity from this manager. It will clear also its components
   * @param entity Entity to remove from the manager
   * @param immediately If you want to remove the component immediately instead of deferred (Default is false)
   */
  removeEntity(entity: Entity, immediately?: boolean): void {
    const index = this.entities.indexOf(entity);

    if (!~index) { throw new Error('Tried to remove entity not in list'); }

    entity.alive = false;

    if (this.numStateComponents === 0) {
      // Remove from entity list
      this.eventDispatcher.dispatchEvent(ENTITY_REMOVED, entity);
      this.queryManager.onEntityRemoved(entity);
      if (immediately === true) {
        this._releaseEntity(entity, index);
      } else {
        this.entitiesToRemove.push(entity);
      }
    }

    this.entityRemoveAllComponents(entity, immediately);
  }

  _releaseEntity(entity: Entity, index): void {
    this.entities.splice(index, 1);

    // Prevent any access and free
    entity.entityManager = null;
    this.entityPool.release(entity);
  }

  /**
   * Remove all entities from this manager
   */
  removeAllEntities(): void {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      this.removeEntity(this.entities[i]);
    }
  }

  processDeferredRemoval(): void {
    if (!this.deferredRemovalEnabled) {
      return;
    }

    for (const entity of this.entitiesToRemove) {
      const index = this.entities.indexOf(entity);
      this._releaseEntity(entity, index);
    }

    this.entitiesToRemove.length = 0;

    for (const entity of this.entitiesWithComponentsToRemove) {
      while (entity.ComponentTypesToRemove.length > 0) {
        const componentToREmove = entity.ComponentTypesToRemove.pop();

        const propName = componentPropertyName(componentToREmove);
        const componentName = getName(componentToREmove);

        const component = entity.componentsToRemove[componentName];
        delete entity.componentsToRemove[componentName];
        this.componentManager.componentPool[propName].release(component);
        this.componentManager.componentRemovedFromEntity(componentToREmove);

        // this._entityRemoveComponentSync(entity, Component, index);
      }
    }

    this.entitiesWithComponentsToRemove.length = 0;
  }

  /**
   * Get a query based on a list of components
   * @param componentConstructor List of components that will form the query
   */
  queryComponents(componentConstructor: ComponentConstructor<Component>[]): Query {
    return this.queryManager.getQuery(componentConstructor);
  }

  // EXTRAS

  /**
   * Return number of entities
   */
  count(): number {
    return this.entities.length;
  }

  /**
   * Return some stats
   */
  stats() {
    const stats = {
      numEntities: this.entities.length,
      numQueries: Object.keys(this.queryManager.queries).length,
      queries: this.queryManager.stats(),
      numComponentPool: Object.keys(this.componentManager.componentPool)
        .length,
      componentPool: {},
      eventDispatcher: this.eventDispatcher.stats
    };

    for (const cname in this.componentManager.componentPool) {
      if (this.componentManager.componentPool.hasOwnProperty(cname)) {

        const pool = this.componentManager.componentPool[cname];
        stats.componentPool[cname] = {
          used: pool.totalUsed(),
          size: pool.count
        };

      }
    }

    return stats;
  }
}

const ENTITY_CREATED = 'EntityManager#ENTITY_CREATE';
const ENTITY_REMOVED = 'EntityManager#ENTITY_REMOVED';
const COMPONENT_ADDED = 'EntityManager#COMPONENT_ADDED';
const COMPONENT_REMOVE = 'EntityManager#COMPONENT_REMOVE';
