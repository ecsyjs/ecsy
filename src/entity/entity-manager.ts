import { ComponentManager } from '../component';
import { ComponentConstructor } from '../component.interface';
import { ObjectPool } from '../object-pool';
import { componentPropertyName, getName } from '../utils';
import { Entity } from './entity';
import { EventDispatcher } from './event-dispatcher';
import { Query } from './query';
import { QueryManager } from './query-manager';
import { SystemStateComponent } from './system-state-component';

// tslint:disable:no-bitwise

export enum EntityManagerEvents {
  ENTITY_CREATED,
  ENTITY_REMOVED,
  COMPONENT_ADDED,
  COMPONENT_REMOVE,
}

/**
 * EntityManager
 */
export class EntityManager {

  // All the entities in this instance
  entities: Entity[] = [];

  queryManager = new QueryManager(this);
  eventDispatcher = new EventDispatcher<EntityManagerEvents>();
  private entityPool = new ObjectPool<Entity>(Entity);

  // Deferred deletion
  entitiesWithComponentsToRemove = new Set<Entity>();
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
    this.eventDispatcher.dispatchEvent(EntityManagerEvents.ENTITY_CREATED, entity);

    return entity;
  }

  // COMPONENTS

  /**
   * Add a component to an entity
   * @param entity Entity where the component will be added
   * @param componentConstructor Component to be added to the entity
   * @param values Optional values to replace the default attributes
   */
  entityAddComponent(entity: Entity, componentConstructor: ComponentConstructor, values?: { [key: string]: any }): void {

    if (entity.componentTypes.has(componentConstructor)) { return; }

    entity.componentTypes.add(componentConstructor);

    if ((componentConstructor as any).__proto__ === SystemStateComponent) {
      this.numStateComponents++;
    }

    const componentPool = this.componentManager.getComponentsPool(
      componentConstructor
    );

    const componentFromPool = componentPool.aquire();

    entity.components.set(componentConstructor.name, componentFromPool);

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

    this.eventDispatcher.dispatchEvent(EntityManagerEvents.COMPONENT_ADDED, entity, componentConstructor);
  }

  /**
   * Remove a component from an entity
   * @param entity Entity which will get removed the component
   * @param componentConstructor Component to remove from the entity
   * @param immediately If you want to remove the component immediately instead of deferred (Default is false)
   */
  entityRemoveComponent(entity: Entity, componentConstructor: ComponentConstructor, immediately?: boolean): void {
    if (!entity.componentTypes.has(componentConstructor)) {

      return;
    }

    this.eventDispatcher.dispatchEvent(EntityManagerEvents.COMPONENT_REMOVE, entity, componentConstructor);

    if (immediately) {

      this.entityRemoveComponentSync(entity, componentConstructor);

    } else {

      if (entity.componentTypesToRemove.size === 0) {
        this.entitiesWithComponentsToRemove.add(entity);
      }

      entity.componentTypes.delete(componentConstructor);
      entity.componentTypesToRemove.add(componentConstructor);

      const componentName = getName(componentConstructor);
      entity.componentsToRemove.set(componentName, entity.components.get(componentName));

      entity.components.delete(componentName);

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

  entityRemoveComponentSync(entity: Entity, componentConstructor: ComponentConstructor): void {
    // Remove T listing on entity and property ref, then free the component.
    entity.componentTypes.delete(componentConstructor);
    const propName = componentPropertyName(componentConstructor);
    const componentName = getName(componentConstructor);
    const componentEntity = entity.components.get(componentName);
    entity.components.delete(componentName);

    this.componentManager.componentPool.get(propName).release(componentEntity);
  }

  /**
   * Remove all the components from an entity
   * @param entity Entity from which the components will be removed
   */
  entityRemoveAllComponents(entity: Entity, immediately?: boolean): void {
    for (const componentType of entity.componentTypes) {
      if ((componentType as any).__proto__ !== SystemStateComponent) {
        this.entityRemoveComponent(entity, componentType, immediately);
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
      this.eventDispatcher.dispatchEvent(EntityManagerEvents.ENTITY_REMOVED, entity);
      this.queryManager.onEntityRemoved(entity);
      if (immediately === true) {
        this.releaseEntity(entity, index);
      } else {
        this.entitiesToRemove.push(entity);
      }
    }

    this.entityRemoveAllComponents(entity, immediately);
  }

  private releaseEntity(entity: Entity, index): void {
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
      this.releaseEntity(entity, index);
    }

    this.entitiesToRemove.length = 0;

    for (const entity of this.entitiesWithComponentsToRemove) {
      for (const componentTypeToRemove of entity.componentTypesToRemove) {

        const propName = componentPropertyName(componentTypeToRemove);
        const componentName = getName(componentTypeToRemove);

        const component = entity.componentsToRemove.get(componentName);
        entity.componentsToRemove.delete(componentName);

        this.componentManager.componentPool.get(propName).release(component);
      }

      entity.componentTypesToRemove.clear();
    }

    this.entitiesWithComponentsToRemove.clear();
  }

  /**
   * Get a query based on a list of components
   * @param componentConstructor List of components that will form the query
   */
  queryComponents(componentConstructor: ComponentConstructor[]): Query {
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

        const pool = this.componentManager.componentPool.get(cname);
        stats.componentPool[cname] = {
          used: pool.totalUsed(),
          size: pool.count
        };

      }
    }

    return stats;
  }
}

