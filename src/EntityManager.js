import { ObjectPool } from "./ObjectPool.js";
import QueryManager from "./QueryManager.js";
import EventDispatcher from "./EventDispatcher.js";
import { SystemStateComponent } from "./SystemStateComponent.js";

class EntityPool extends ObjectPool {
  constructor(entityManager, entityClass, initialSize) {
    super(entityClass, undefined);
    this.entityManager = entityManager;

    if (typeof initialSize !== "undefined") {
      this.expand(initialSize);
    }
  }

  expand(count) {
    for (var n = 0; n < count; n++) {
      var clone = new this.T(this.entityManager);
      clone._pool = this;
      this.freeList.push(clone);
    }
    this.count += count;
  }
}

/**
 * @private
 * @class EntityManager
 */
export class EntityManager {
  constructor(world) {
    this.world = world;
    this.componentsManager = world.componentsManager;

    // All the entities in this instance
    this._entities = [];
    this._nextEntityId = 0;

    this._entitiesByNames = {};

    this._queryManager = new QueryManager(this);
    this.eventDispatcher = new EventDispatcher();
    this._entityPool = new EntityPool(
      this,
      this.world.options.entityClass,
      this.world.options.entityPoolSize
    );

    // Deferred deletion
    this.entitiesWithComponentsToRemove = [];
    this.entitiesToRemove = [];
    this.deferredRemovalEnabled = true;
  }

  getEntityByName(name) {
    return this._entitiesByNames[name];
  }

  /**
   * Create a new entity
   */
  createEntity(name) {
    var entity = this._entityPool.acquire();
    entity.alive = true;
    entity.name = name || "";
    if (name) {
      if (this._entitiesByNames[name]) {
        console.warn(`Entity name '${name}' already exist`);
      } else {
        this._entitiesByNames[name] = entity;
      }
    }

    this._entities.push(entity);
    this.eventDispatcher.dispatchEvent(ENTITY_CREATED, entity);
    return entity;
  }

  // COMPONENTS

  /**
   * Add a component to an entity
   * @param {Entity} entity Entity where the component will be added
   * @param {Component} Component Component to be added to the entity
   * @param {Object} values Optional values to replace the default attributes
   */
  entityAddComponent(entity, Component, values) {
    // @todo Probably define Component._typeId with a default value and avoid using typeof
    if (
      typeof Component._typeId === "undefined" &&
      !this.world.componentsManager._ComponentsMap[Component._typeId]
    ) {
      throw new Error(
        `Attempted to add unregistered component "${Component.getName()}"`
      );
    }

    if (~entity._ComponentTypes.indexOf(Component)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Component type already exists on entity.",
          entity,
          Component.getName()
        );
      }
      return;
    }

    entity._ComponentTypes.push(Component);

    if (Component.__proto__ === SystemStateComponent) {
      entity.numStateComponents++;
    }

    var componentPool = this.world.componentsManager.getComponentsPool(
      Component
    );

    var component = componentPool
      ? componentPool.acquire()
      : new Component(values);

    if (componentPool && values) {
      component.copy(values);
    }

    entity._components[Component._typeId] = component;

    this._queryManager.onEntityComponentAdded(entity, Component);
    this.world.componentsManager.componentAddedToEntity(Component);

    this.eventDispatcher.dispatchEvent(COMPONENT_ADDED, entity, Component);
  }

  /**
   * Remove a component from an entity
   * @param {Entity} entity Entity which will get removed the component
   * @param {*} Component Component to remove from the entity
   * @param {Bool} immediately If you want to remove the component immediately instead of deferred (Default is false)
   */
  entityRemoveComponent(entity, Component, immediately) {
    var index = entity._ComponentTypes.indexOf(Component);
    if (!~index) return;

    this.eventDispatcher.dispatchEvent(COMPONENT_REMOVE, entity, Component);

    if (immediately) {
      this._entityRemoveComponentSync(entity, Component, index);
    } else {
      if (entity._ComponentTypesToRemove.length === 0)
        this.entitiesWithComponentsToRemove.push(entity);

      entity._ComponentTypes.splice(index, 1);
      entity._ComponentTypesToRemove.push(Component);

      entity._componentsToRemove[Component._typeId] =
        entity._components[Component._typeId];
      delete entity._components[Component._typeId];
    }

    // Check each indexed query to see if we need to remove it
    this._queryManager.onEntityComponentRemoved(entity, Component);

    if (Component.__proto__ === SystemStateComponent) {
      entity.numStateComponents--;

      // Check if the entity was a ghost waiting for the last system state component to be removed
      if (entity.numStateComponents === 0 && !entity.alive) {
        entity.remove();
      }
    }
  }

  _entityRemoveComponentSync(entity, Component, index) {
    // Remove T listing on entity and property ref, then free the component.
    entity._ComponentTypes.splice(index, 1);
    var component = entity._components[Component._typeId];
    delete entity._components[Component._typeId];
    component.dispose();
    this.world.componentsManager.componentRemovedFromEntity(Component);
  }

  /**
   * Remove all the components from an entity
   * @param {Entity} entity Entity from which the components will be removed
   */
  entityRemoveAllComponents(entity, immediately) {
    let Components = entity._ComponentTypes;

    for (let j = Components.length - 1; j >= 0; j--) {
      if (Components[j].__proto__ !== SystemStateComponent)
        this.entityRemoveComponent(entity, Components[j], immediately);
    }
  }

  /**
   * Remove the entity from this manager. It will clear also its components
   * @param {Entity} entity Entity to remove from the manager
   * @param {Bool} immediately If you want to remove the component immediately instead of deferred (Default is false)
   */
  removeEntity(entity, immediately) {
    var index = this._entities.indexOf(entity);

    if (!~index) throw new Error("Tried to remove entity not in list");

    entity.alive = false;
    this.entityRemoveAllComponents(entity, immediately);

    if (entity.numStateComponents === 0) {
      // Remove from entity list
      this.eventDispatcher.dispatchEvent(ENTITY_REMOVED, entity);
      this._queryManager.onEntityRemoved(entity);
      if (immediately === true) {
        this._releaseEntity(entity, index);
      } else {
        this.entitiesToRemove.push(entity);
      }
    }
  }

  _releaseEntity(entity, index) {
    this._entities.splice(index, 1);

    if (this._entitiesByNames[entity.name]) {
      delete this._entitiesByNames[entity.name];
    }
    entity._pool.release(entity);
  }

  /**
   * Remove all entities from this manager
   */
  removeAllEntities() {
    for (var i = this._entities.length - 1; i >= 0; i--) {
      this.removeEntity(this._entities[i]);
    }
  }

  processDeferredRemoval() {
    if (!this.deferredRemovalEnabled) {
      return;
    }

    for (let i = 0; i < this.entitiesToRemove.length; i++) {
      let entity = this.entitiesToRemove[i];
      let index = this._entities.indexOf(entity);
      this._releaseEntity(entity, index);
    }
    this.entitiesToRemove.length = 0;

    for (let i = 0; i < this.entitiesWithComponentsToRemove.length; i++) {
      let entity = this.entitiesWithComponentsToRemove[i];
      while (entity._ComponentTypesToRemove.length > 0) {
        let Component = entity._ComponentTypesToRemove.pop();

        var component = entity._componentsToRemove[Component._typeId];
        delete entity._componentsToRemove[Component._typeId];
        component.dispose();
        this.world.componentsManager.componentRemovedFromEntity(Component);

        //this._entityRemoveComponentSync(entity, Component, index);
      }
    }

    this.entitiesWithComponentsToRemove.length = 0;
  }

  /**
   * Get a query based on a list of components
   * @param {Array(Component)} Components List of components that will form the query
   */
  queryComponents(Components) {
    return this._queryManager.getQuery(Components);
  }

  // EXTRAS

  /**
   * Return number of entities
   */
  count() {
    return this._entities.length;
  }

  /**
   * Return some stats
   */
  stats() {
    var stats = {
      numEntities: this._entities.length,
      numQueries: Object.keys(this._queryManager._queries).length,
      queries: this._queryManager.stats(),
      numComponentPool: Object.keys(this.componentsManager._componentPool)
        .length,
      componentPool: {},
      eventDispatcher: this.eventDispatcher.stats,
    };

    for (var ecsyComponentId in this.componentsManager._componentPool) {
      var pool = this.componentsManager._componentPool[ecsyComponentId];
      stats.componentPool[pool.T.getName()] = {
        used: pool.totalUsed(),
        size: pool.count,
      };
    }

    return stats;
  }
}

const ENTITY_CREATED = "EntityManager#ENTITY_CREATE";
const ENTITY_REMOVED = "EntityManager#ENTITY_REMOVED";
const COMPONENT_ADDED = "EntityManager#COMPONENT_ADDED";
const COMPONENT_REMOVE = "EntityManager#COMPONENT_REMOVE";
