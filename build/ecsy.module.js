/**
 * @class SystemManager
 */
class SystemManager {
  constructor(world) {
    this.systems = [];
    this.world = world;
  }

  /**
   * Register a system
   * @param {System} System System to register
   */
  registerSystem(System, attributes) {
    var system = new System(this.world, attributes);
    system.order = this.systems.length;
    this.systems.push(system);
    this.sortSystems();
    return this;
  }

  sortSystems() {
    this.systems.sort((a, b) => {
      return a.priority - b.priority || a.order - b.order;
    });
  }

  /**
   * Remove a system
   * @param {System} System System to remove
   */
  removeSystem(System) {
    var index = this.systems.indexOf(System);
    if (!~index) return;

    this.systems.splice(index, 1);
  }

  /**
   * Update all the systems. Called per frame.
   * @param {Number} delta Delta time since the last frame
   * @param {Number} time Elapsed time
   */
  execute(delta, time) {
    this.systems.forEach(system => {
      if (system.enabled && system.initialized) {
        if (system.execute) {
          let startTime = performance.now();
          system.execute(delta, time);
          system.executeTime = performance.now() - startTime;
        }
        system.clearEvents();
      }
    });
  }

  /**
   * Return stats
   */
  stats() {
    var stats = {
      numSystems: this.systems.length,
      systems: {}
    };

    for (var i = 0; i < this.systems.length; i++) {
      var system = this.systems[i];
      var systemStats = (stats.systems[system.constructor.name] = {
        queries: {}
      });
      for (var name in system.ctx) {
        systemStats.queries[name] = system.ctx[name].stats();
      }
    }

    return stats;
  }
}

/**
 * @class EventDispatcher
 */
class EventDispatcher {
  constructor() {
    this._listeners = {};
    this.stats = {
      fired: 0,
      handled: 0
    };
  }

  /**
   * Add an event listener
   * @param {String} eventName Name of the event to listen
   * @param {Function} listener Callback to trigger when the event is fired
   */
  addEventListener(eventName, listener) {
    let listeners = this._listeners;
    if (listeners[eventName] === undefined) {
      listeners[eventName] = [];
    }

    if (listeners[eventName].indexOf(listener) === -1) {
      listeners[eventName].push(listener);
    }
  }

  /**
   * Check if an event listener is already added to the list of listeners
   * @param {String} eventName Name of the event to check
   * @param {Function} listener Callback for the specified event
   */
  hasEventListener(eventName, listener) {
    return (
      this._listeners[eventName] !== undefined &&
      this._listeners[eventName].indexOf(listener) !== -1
    );
  }

  /**
   * Remove an event listener
   * @param {String} eventName Name of the event to remove
   * @param {Function} listener Callback for the specified event
   */
  removeEventListener(eventName, listener) {
    var listenerArray = this._listeners[eventName];
    if (listenerArray !== undefined) {
      var index = listenerArray.indexOf(listener);
      if (index !== -1) {
        listenerArray.splice(index, 1);
      }
    }
  }

  /**
   * Dispatch an event
   * @param {String} eventName Name of the event to dispatch
   * @param {Entity} entity (Optional) Entity to emit
   * @param {Component} component
   */
  dispatchEvent(eventName, entity, component) {
    this.stats.fired++;

    var listenerArray = this._listeners[eventName];
    if (listenerArray !== undefined) {
      var array = listenerArray.slice(0);

      for (var i = 0; i < array.length; i++) {
        array[i].call(this, entity, component);
      }
    }
  }

  /**
   * Reset stats counters
   */
  resetCounters() {
    this.stats.fired = this.stats.handled = 0;
  }
}

/**
 * Return the name of a component
 * @param {Component} Component
 */
function getName(Component) {
  return Component.name;
}

/**
 * Return a valid property name for the Component
 * @param {Component} Component
 */
function componentPropertyName(Component) {
  var name = getName(Component);
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Get a key from a list of components
 * @param {Array(Component)} Components Array of components to generate the key
 */
function queryKey(Components) {
  var names = [];
  for (var n = 0; n < Components.length; n++) {
    var T = Components[n];
    if (typeof T === "object") {
      var operator = T.operator === "not" ? "!" : T.operator;
      names.push(operator + getName(T.Component));
    } else {
      names.push(getName(T));
    }
  }

  return names
    .map(function(x) {
      return x.toLowerCase();
    })
    .sort()
    .join("-");
}

/**
 * @class Query
 */
class Query {
  /**
   * @param {Array(Component)} Components List of types of components to query
   */
  constructor(Components, manager) {
    this.Components = [];
    this.NotComponents = [];

    Components.forEach(component => {
      if (typeof component === "object") {
        this.NotComponents.push(component.Component);
      } else {
        this.Components.push(component);
      }
    });

    if (this.Components.length === 0) {
      throw new Error("Can't create a query without components");
    }

    this.entities = [];
    this.eventDispatcher = new EventDispatcher();

    // This query is being used by a reactive system
    this.reactive = false;

    this.key = queryKey(Components);

    // Fill the query with the existing entities
    for (var i = 0; i < manager._entities.length; i++) {
      var entity = manager._entities[i];
      if (this.match(entity)) {
        // @todo ??? this.addEntity(entity); => preventing the event to be generated
        entity.queries.push(this);
        this.entities.push(entity);
      }
    }
  }

  /**
   * Add entity to this query
   * @param {Entity} entity
   */
  addEntity(entity) {
    entity.queries.push(this);
    this.entities.push(entity);

    this.eventDispatcher.dispatchEvent(Query.prototype.ENTITY_ADDED, entity);
  }

  /**
   * Remove entity from this query
   * @param {Entity} entity
   */
  removeEntity(entity) {
    var index = this.entities.indexOf(entity);
    if (~index) {
      this.entities.splice(index, 1);

      index = entity.queries.indexOf(this);
      entity.queries.splice(index, 1);

      this.eventDispatcher.dispatchEvent(
        Query.prototype.ENTITY_REMOVED,
        entity
      );
    }
  }

  match(entity, includeRemoved = false) {
    return (
      entity.hasAllComponents(this.Components, includeRemoved) &&
      !entity.hasAnyComponents(this.NotComponents, includeRemoved)
    );
  }

  /**
   * Return stats for this query
   */
  stats() {
    return {
      numComponents: this.Components.length,
      numEntities: this.entities.length
    };
  }
}

Query.prototype.ENTITY_ADDED = "Query#ENTITY_ADDED";
Query.prototype.ENTITY_REMOVED = "Query#ENTITY_REMOVED";
Query.prototype.COMPONENT_CHANGED = "Query#COMPONENT_CHANGED";

// @todo reset it by world?
var nextId = 0;

/**
 * @class Entity
 */
class Entity {
  /**
   * @constructor
   * @class Entity
   * @param {World} world
   */
  constructor(world) {
    this._world = world || null;

    // Unique ID for this entity
    this.id = nextId++;

    // List of components types the entity has
    this._ComponentTypes = [];

    // Instance of the components
    this._components = {};

    // List of tags this entity has
    this._tags = [];

    // Queries where the entity is added
    this.queries = [];

    // Used for deferred removal
    this.componentsToRemove = [];
  }

  // COMPONENTS

  /**
   * Return an immutable reference of a component
   * Note: A proxy will be used on debug mode, and it will just affect
   *       the first level attributes on the object, it won't work recursively.
   * @param {Component} Type of component to get
   * @return {Component} Immutable component reference
   */
  getComponent(Component) {
    var component = this._components[Component.name];
    return component;
  }

  getComponents() {
    return this._components;
  }

  getComponentTypes() {
    return this._ComponentTypes;
  }

  /**
   * Return a mutable reference of a component.
   * @param {Component} Type of component to get
   * @return {Component} Mutable component reference
   */
  getMutableComponent(Component) {
    var component = this._components[Component.name];
    for (var i = 0; i < this.queries.length; i++) {
      var query = this.queries[i];
      if (query.reactive) {
        query.eventDispatcher.dispatchEvent(
          Query.prototype.COMPONENT_CHANGED,
          this,
          component
        );
      }
    }
    return component;
  }

  /**
   * Add a component to the entity
   * @param {Component} Component to add to this entity
   * @param {Object} Optional values to replace the default attributes on the component
   */
  addComponent(Component, values) {
    this._world.entityAddComponent(this, Component, values);
    return this;
  }

  /**
   * Remove a component from the entity
   * @param {Component} Component to remove from the entity
   */
  removeComponent(Component, forceRemove) {
    this._world.entityRemoveComponent(this, Component, forceRemove);
    return this;
  }

  /**
   * Check if the entity has a component
   * @param {Component} Component to check
   * @param {Bool} include Components queued for removal (Default is false)
   */
  hasComponent(Component, includeRemoved = false) {
    return (
      !!~this._ComponentTypes.indexOf(Component) &&
      (includeRemoved || !~this.componentsToRemove.indexOf(Component))
    );
  }

  /**
   * Check if the entity has all components in a list
   * @param {Array(Component)} Components to check
   * @param {Bool} include Components queued for removal (Default is false)
   */
  hasAllComponents(Components, includeRemoved = false) {
    for (var i = 0; i < Components.length; i++) {
      if (!this.hasComponent(Components[i], includeRemoved)) return false;
    }
    return true;
  }

  /**
   * Check if the entity has any components in a list
   * @param {Array(Component)} Components to check
   * @param {Bool} include Components queued for removal (Default is false)
   */
  hasAnyComponents(Components, includeRemoved = false) {
    for (var i = 0; i < Components.length; i++) {
      if (this.hasComponent(Components[i], includeRemoved)) return true;
    }
    return false;
  }

  /**
   * Remove all the components from the entity
   */
  removeAllComponents(forceRemove) {
    return this._world.entityRemoveAllComponents(this, forceRemove);
  }

  // TAGS

  /**
   * Check if the entity has a tag
   * @param {String} tag Tag to check
   */
  hasTag(tag) {
    return !!~this._tags.indexOf(tag);
  }

  /**
   * Add a tag to this entity
   * @param {String} tag Tag to add to this entity
   */
  addTag(tag) {
    this._world.entityAddTag(this, tag);
    return this;
  }

  /**
   * Remove a tag from the entity
   * @param {String} tag Tag to remove from the entity
   */
  removeTag(tag) {
    this._world.entityRemoveTag(this, tag);
    return this;
  }

  // EXTRAS

  /**
   * Initialize the entity. To be used when returning an entity to the pool
   */
  reset() {
    this.id = nextId++;
    this._world = null;
    this._ComponentTypes.length = 0;
    this.queries.length = 0;
    this._components = {};
    this._tags.length = 0;
  }

  /**
   * Remove the entity from the world
   */
  remove(forceRemove) {
    return this._world.removeEntity(this, forceRemove);
  }
}

/**
 * @class ObjectPool
 */
class ObjectPool {
  // @todo Add initial size
  constructor(T, initialSize) {
    this.freeList = [];
    this.count = 0;
    this.T = T;

    var extraArgs = null;
    if (arguments.length > 1) {
      extraArgs = Array.prototype.slice.call(arguments);
      extraArgs.shift();
    }

    this.createElement = extraArgs
      ? () => {
          return new T(...extraArgs);
        }
      : () => {
          return new T();
        };

    if (typeof initialSize !== "undefined") {
      this.expand(initialSize);
    }
  }

  aquire() {
    // Grow the list by 20%ish if we're out
    if (this.freeList.length <= 0) {
      this.expand(Math.round(this.count * 0.2) + 1);
    }

    var item = this.freeList.pop();

    return item;
  }

  release(item) {
    item.reset();
    this.freeList.push(item);
  }

  expand(count) {
    for (var n = 0; n < count; n++) {
      this.freeList.push(this.createElement());
    }
    this.count += count;
  }

  totalSize() {
    return this.count;
  }

  totalFree() {
    return this.freeList.length;
  }

  totalUsed() {
    return this.count - this.freeList.length;
  }
}

/**
 * @class QueryManager
 */
class QueryManager {
  constructor(world) {
    this._world = world;

    // Queries indexed by a unique identifier for the components it has
    this._queries = {};
  }

  onEntityRemoved(entity) {
    for (var queryName in this._queries) {
      var query = this._queries[queryName];
      if (entity.queries.indexOf(query) !== -1) {
        query.removeEntity(entity);
      }
    }
  }

  /**
   * Callback when a component is added to an entity
   * @param {Entity} entity Entity that just got the new component
   * @param {Component} Component Component added to the entity
   */
  onEntityComponentAdded(entity, Component) {
    // @todo Use bitmask for checking components?

    // Check each indexed query to see if we need to add this entity to the list
    for (var queryName in this._queries) {
      var query = this._queries[queryName];

      if (
        !!~query.NotComponents.indexOf(Component) &&
        ~query.entities.indexOf(entity)
      ) {
        query.removeEntity(entity);
        continue;
      }

      // Add the entity only if:
      // Component is in the query
      // and Entity has ALL the components of the query
      // and Entity is not already in the query
      if (
        !~query.Components.indexOf(Component) ||
        !query.match(entity) ||
        ~query.entities.indexOf(entity)
      )
        continue;

      query.addEntity(entity);
    }
  }

  /**
   * Callback when a component is removed from an entity
   * @param {Entity} entity Entity to remove the component from
   * @param {Component} Component Component to remove from the entity
   */
  onEntityComponentRemoved(entity, Component) {
    for (var queryName in this._queries) {
      var query = this._queries[queryName];

      if (
        !!~query.NotComponents.indexOf(Component) &&
        !~query.entities.indexOf(entity) &&
        query.match(entity)
      ) {
        // console.log("Query now matches", queryName, entity);
        query.addEntity(entity);
        continue;
      }

      if (
        !!~query.Components.indexOf(Component) &&
        !!~query.entities.indexOf(entity) &&
        !query.match(entity)
      ) {
        // console.log("Query no longer matches", queryName, entity);
        query.removeEntity(entity);
        continue;
      }
    }
  }

  /**
   * Get a query for the specified components
   * @param {Component} Components Components that the query should have
   */
  getQuery(Components) {
    var key = queryKey(Components);
    var query = this._queries[key];
    if (!query) {
      this._queries[key] = query = new Query(Components, this._world);
    }
    return query;
  }

  /**
   * Return some stats from this class
   */
  stats() {
    var stats = {};
    for (var queryName in this._queries) {
      stats[queryName] = this._queries[queryName].stats();
    }
    return stats;
  }
}

/**
 * @class EntityManager
 */
class EntityManager {
  constructor(world) {
    this.world = world;
    this.componentsManager = world.componentsManager;

    // All the entities in this instance
    this._entities = [];

    // Map between tag and entities
    this._tags = {};

    this._queryManager = new QueryManager(this);
    this.eventDispatcher = new EventDispatcher();
    this._entityPool = new ObjectPool(Entity);

    // Deferred deletion
    this.entitiesWithComponentsToRemove = [];
    this.entitiesToRemove = [];
  }

  /**
   * Create a new entity
   */
  createEntity() {
    var entity = this._entityPool.aquire();
    entity._world = this;
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
    if (~entity._ComponentTypes.indexOf(Component)) return;

    entity._ComponentTypes.push(Component);

    var componentPool = this.world.componentsManager.getComponentsPool(
      Component
    );
    var component = componentPool.aquire();

    entity._components[Component.name] = component;

    if (values) {
      if (component.copy) {
        component.copy(values);
      } else {
        for (var name in values) {
          component[name] = values[name];
        }
      }
    }

    this._queryManager.onEntityComponentAdded(entity, Component);
    this.world.componentsManager.componentAddedToEntity(Component);

    this.eventDispatcher.dispatchEvent(COMPONENT_ADDED, entity, Component);
  }

  /**
   * Remove a component from an entity
   * @param {Entity} entity Entity which will get removed the component
   * @param {*} Component Component to remove from the entity
   * @param {Bool} forceRemove If you want to remove the component immediately instead of deferred (Default is false)
   */
  entityRemoveComponent(entity, Component, forceRemove) {
    var index = entity._ComponentTypes.indexOf(Component);
    if (!~index) return;

    this.eventDispatcher.dispatchEvent(COMPONENT_REMOVE, entity, Component);

    if (forceRemove) {
      this._entityRemoveComponentSync(entity, Component, index);
    } else {
      if (entity.componentsToRemove.length === 0)
        this.entitiesWithComponentsToRemove.push(entity);
      entity.componentsToRemove.push(Component);
    }

    // Check each indexed query to see if we need to remove it
    this._queryManager.onEntityComponentRemoved(entity, Component);
  }

  _entityRemoveComponentSync(entity, Component, index) {
    // Remove T listing on entity and property ref, then free the component.
    entity._ComponentTypes.splice(index, 1);
    var propName = componentPropertyName(Component);
    var componentName = getName(Component);
    var component = entity._components[componentName];
    delete entity._components[componentName];
    this.componentsManager._componentPool[propName].release(component);
    this.world.componentsManager.componentRemovedFromEntity(Component);
  }

  /**
   * Remove all the components from an entity
   * @param {Entity} entity Entity from which the components will be removed
   */
  entityRemoveAllComponents(entity, forceRemove) {
    let Components = entity._ComponentTypes;

    for (let j = Components.length - 1; j >= 0; j--) {
      this.entityRemoveComponent(entity, Components[j], forceRemove);
    }
  }

  /**
   * Remove the entity from this manager. It will clear also its components and tags
   * @param {Entity} entity Entity to remove from the manager
   * @param {Bool} forceRemove If you want to remove the component immediately instead of deferred (Default is false)
   */
  removeEntity(entity, forceRemove) {
    var index = this._entities.indexOf(entity);

    if (!~index) throw new Error("Tried to remove entity not in list");

    // Remove from entity list
    this.eventDispatcher.dispatchEvent(ENTITY_REMOVED, entity);
    this._queryManager.onEntityRemoved(entity);

    if (forceRemove === true) {
      this._removeEntitySync(entity, index);
    } else {
      this.entitiesToRemove.push(entity);
    }
  }

  _removeEntitySync(entity, index) {
    this._entities.splice(index, 1);

    this.entityRemoveAllComponents(entity, true);

    // Remove entity from any tag groups and clear the on-entity ref
    entity._tags.length = 0;
    for (var tag in this._tags) {
      var entities = this._tags[tag];
      var n = entities.indexOf(entity);
      if (~n) entities.splice(n, 1);
    }

    // Prevent any access and free
    entity._world = null;
    this._entityPool.release(entity);
  }

  /**
   * Remove all entities from this manager
   */
  removeAllEntities() {
    for (var i = this._entities.length - 1; i >= 0; i--) {
      this._entities[i].remove();
    }
  }

  processDeferredRemoval() {
    for (let i = 0; i < this.entitiesToRemove.length; i++) {
      let entity = this.entitiesToRemove[i];
      let index = this._entities.indexOf(entity);
      this._removeEntitySync(entity, index);
    }
    this.entitiesToRemove.length = 0;

    for (let i = 0; i < this.entitiesWithComponentsToRemove.length; i++) {
      let entity = this.entitiesWithComponentsToRemove[i];
      while (entity.componentsToRemove.length > 0) {
        let Component = entity.componentsToRemove.pop();
        let index = entity._ComponentTypes.indexOf(Component);
        this._entityRemoveComponentSync(entity, Component, index);
      }
    }

    this.entitiesWithComponentsToRemove.length = 0;
  }

  // TAGS

  /**
   * Remove all the entities that has the specified tag
   * @param {String} tag Tag to filter the entities to be removed
   */
  removeEntitiesByTag(tag) {
    var entities = this._tags[tag];

    if (!entities) return;

    for (var x = entities.length - 1; x >= 0; x--) {
      var entity = entities[x];
      entity.remove();
    }
  }

  /**
   * Add tag to an entity
   * @param {Entity} entity Entity which will get the tag
   * @param {String} tag Tag to add to the entity
   */
  entityAddTag(entity, tag) {
    var entities = this._tags[tag];

    if (!entities) entities = this._tags[tag] = [];

    // Don't add if already there
    if (~entities.indexOf(entity)) return;

    // Add to our tag index AND the list on the entity
    entities.push(entity);
    entity._tags.push(tag);
  }

  /**
   * Remove a tag from an entity
   * @param {Entity} entity Entity that will get removed the tag
   * @param {String} tag Tag to remove
   */
  entityRemoveTag(entity, tag) {
    var entities = this._tags[tag];
    if (!entities) return;

    var index = entities.indexOf(entity);
    if (!~index) return;

    // Remove from our index AND the list on the entity
    entities.splice(index, 1);
    entity._tags.splice(entity._tags.indexOf(tag), 1);
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
      eventDispatcher: this.eventDispatcher.stats
    };

    for (var cname in this.componentsManager._componentPool) {
      var pool = this.componentsManager._componentPool[cname];
      stats.componentPool[cname] = {
        used: pool.totalUsed(),
        size: pool.count
      };
    }

    return stats;
  }
}

const ENTITY_CREATED = "EntityManager#ENTITY_CREATE";
const ENTITY_REMOVED = "EntityManager#ENTITY_REMOVED";
const COMPONENT_ADDED = "EntityManager#COMPONENT_ADDED";
const COMPONENT_REMOVE = "EntityManager#COMPONENT_REMOVE";

/**
 * @class DummyObjectPool
 */
class DummyObjectPool {
  constructor(T) {
    this.count = 0;
    this.used = 0;
    this.T = T;
  }

  aquire() {
    this.used++;
    this.count++;
    return new this.T();
  }

  release() {
    this.used--;
  }

  totalSize() {
    return this.count;
  }

  totalFree() {
    return Infinity;
  }

  totalUsed() {
    return this.used;
  }
}

class TagComponent {}

/**
 * @class ComponentManager
 */
class ComponentManager {
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
      if (
        Component.prototype.reset ||
        Component.prototype instanceof TagComponent
      ) {
        this._componentPool[componentName] = new ObjectPool(Component);
      } else {
        console.warn(
          `Component '${
            Component.name
          }' won't benefit from pooling because 'reset' method was not implemeneted.`
        );
        this._componentPool[componentName] = new DummyObjectPool(Component);
      }
    }

    return this._componentPool[componentName];
  }
}

/**
 * @class World
 */
class World {
  constructor() {
    this.componentsManager = new ComponentManager(this);
    this.entityManager = new EntityManager(this);
    this.systemManager = new SystemManager(this);

    this.enabled = true;

    // Storage for singleton components
    this.components = {};

    this.eventQueues = {};
    this.eventDispatcher = new EventDispatcher();

    if (typeof CustomEvent !== "undefined") {
      var event = new CustomEvent("ecsy-world-created", { detail: this });
      window.dispatchEvent(event);
    }
  }

  emitEvent(eventName, data) {
    this.eventDispatcher.dispatchEvent(eventName, data);
  }

  addEventListener(eventName, callback) {
    this.eventDispatcher.addEventListener(eventName, callback);
  }

  removeEventListener(eventName, callback) {
    this.eventDispatcher.removeEventListener(eventName, callback);
  }

  /**
   * Register a singleton component
   * @param {Component} Component Singleton component
   */
  registerSingletonComponent(Component) {
    this.componentsManager.registerSingletonComponent(Component);
    this.components[componentPropertyName(Component)] = new Component();
    return this;
  }

  /**
   * Register a component
   * @param {Component} Component
   */
  registerComponent(Component) {
    this.componentsManager.registerComponent(Component);
    return this;
  }

  /**
   * Register a system
   * @param {System} System
   */
  registerSystem(System, attributes) {
    this.systemManager.registerSystem(System, attributes);
    return this;
  }

  /**
   * Update the systems per frame
   * @param {Number} delta Delta time since the last call
   * @param {Number} time Elapsed time
   */
  execute(delta, time) {
    if (this.enabled) {
      this.systemManager.execute(delta, time);
      this.entityManager.processDeferredRemoval();
    }
  }

  stop() {
    this.enabled = false;
  }

  play() {
    this.enabled = true;
  }

  /**
   * Create a new entity
   */
  createEntity() {
    return this.entityManager.createEntity();
  }

  /**
   * Get some stats
   */
  stats() {
    var stats = {
      entities: this.entityManager.stats(),
      system: this.systemManager.stats()
    };

    console.log(JSON.stringify(stats, null, 2));
  }
}

/**
 * @class System
 */

class System {
  toJSON() {
    var json = {
      name: this.constructor.name,
      enabled: this.enabled,
      executeTime: this.executeTime,
      priority: this.priority,
      queries: {},
      events: {}
    };

    if (this.config) {
      var queries = this.config.queries;
      for (let queryName in queries) {
        let query = queries[queryName];
        json.queries[queryName] = {
          key: this._queries[queryName].key
        };
        if (query.events) {
          let events = (json.queries[queryName]["events"] = {});
          for (let eventName in query.events) {
            let event = query.events[eventName];
            events[eventName] = {
              eventName: event.event,
              numEntities: this.events[queryName][eventName].length
            };
            if (event.components) {
              events[eventName].components = event.components.map(c => c.name);
            }
          }
        }
      }

      let events = this.config.events;
      for (let eventName in events) {
        json.events[eventName] = {
          eventName: events[eventName]
        };
      }
    }

    return json;
  }

  constructor(world, attributes) {
    this.world = world;
    this.enabled = true;

    // @todo Better naming :)
    this._queries = {};
    this.queries = {};

    this._events = {};
    this.events = {};

    this.priority = 0;

    // Used for stats
    this.executeTime = 0;

    if (attributes && attributes.priority) {
      this.priority = attributes.priority;
    }

    this.initialized = true;

    this.config = this.init ? this.init() : null;

    if (!this.config) return;
    if (this.config.queries) {
      for (var name in this.config.queries) {
        var queryConfig = this.config.queries[name];
        var Components = queryConfig.components;
        if (!Components || Components.length === 0) {
          throw new Error("'components' attribute can't be empty in a query");
        }
        var query = this.world.entityManager.queryComponents(Components);
        this._queries[name] = query;
        this.queries[name] = query.entities;

        if (queryConfig.events) {
          this.events[name] = {};
          let events = this.events[name];
          for (let eventName in queryConfig.events) {
            let event = queryConfig.events[eventName];
            events[eventName] = [];

            const eventMapping = {
              EntityAdded: Query.prototype.ENTITY_ADDED,
              EntityRemoved: Query.prototype.ENTITY_REMOVED,
              EntityChanged: Query.prototype.COMPONENT_CHANGED // Query.prototype.ENTITY_CHANGED
            };

            if (eventMapping[event.event]) {
              query.eventDispatcher.addEventListener(
                eventMapping[event.event],
                entity => {
                  // @fixme A lot of overhead?
                  if (events[eventName].indexOf(entity) === -1)
                    events[eventName].push(entity);
                }
              );
              if (event.event === "EntityChanged") {
                query.reactive = true;
              }
            } else if (event.event === "ComponentChanged") {
              query.reactive = true;
              query.eventDispatcher.addEventListener(
                Query.prototype.COMPONENT_CHANGED,
                (entity, component) => {
                  if (event.components.indexOf(component.constructor) !== -1) {
                    events[eventName].push(entity);
                  }
                }
              );
            }
          }
        }
      }
    }

    if (this.config.events) {
      for (let name in this.config.events) {
        var event = this.config.events[name];
        this.events[name] = [];
        this.world.addEventListener(event, data => {
          this.events[name].push(data);
        });
      }
    }
  }

  stop() {
    this.enabled = false;
  }

  play() {
    this.enabled = true;
  }

  clearEvents() {
    for (var name in this.events) {
      var event = this.events[name];
      if (Array.isArray(event)) {
        this.events[name].length = 0;
      } else {
        for (name in event) {
          event[name].length = 0;
        }
      }
    }
  }
}

function Not(Component) {
  return {
    operator: "not",
    Component: Component
  };
}

class FloatValidator {
  static validate(n) {
    return Number(n) === n && n % 1 !== 0;
  }
}

var SchemaTypes = {
  float: FloatValidator
  /*
  array
  bool
  func
  number
  object
  string
  symbol

  any
  arrayOf
  element
  elementType
  instanceOf
  node
  objectOf
  oneOf
  oneOfType
  shape
  exact
*/
};

class Component {}

export { Component, Not, SchemaTypes, System, TagComponent, World };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9TeXN0ZW1NYW5hZ2VyLmpzIiwiLi4vc3JjL0V2ZW50RGlzcGF0Y2hlci5qcyIsIi4uL3NyYy9VdGlscy5qcyIsIi4uL3NyYy9RdWVyeS5qcyIsIi4uL3NyYy9FbnRpdHkuanMiLCIuLi9zcmMvT2JqZWN0UG9vbC5qcyIsIi4uL3NyYy9RdWVyeU1hbmFnZXIuanMiLCIuLi9zcmMvRW50aXR5TWFuYWdlci5qcyIsIi4uL3NyYy9EdW1teU9iamVjdFBvb2wuanMiLCIuLi9zcmMvVGFnQ29tcG9uZW50LmpzIiwiLi4vc3JjL0NvbXBvbmVudE1hbmFnZXIuanMiLCIuLi9zcmMvV29ybGQuanMiLCIuLi9zcmMvU3lzdGVtLmpzIiwiLi4vc3JjL1NjaGVtYVR5cGVzLmpzIiwiLi4vc3JjL0NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBjbGFzcyBTeXN0ZW1NYW5hZ2VyXG4gKi9cbmV4cG9ydCBjbGFzcyBTeXN0ZW1NYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLnN5c3RlbXMgPSBbXTtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzeXN0ZW1cbiAgICogQHBhcmFtIHtTeXN0ZW19IFN5c3RlbSBTeXN0ZW0gdG8gcmVnaXN0ZXJcbiAgICovXG4gIHJlZ2lzdGVyU3lzdGVtKFN5c3RlbSwgYXR0cmlidXRlcykge1xuICAgIHZhciBzeXN0ZW0gPSBuZXcgU3lzdGVtKHRoaXMud29ybGQsIGF0dHJpYnV0ZXMpO1xuICAgIHN5c3RlbS5vcmRlciA9IHRoaXMuc3lzdGVtcy5sZW5ndGg7XG4gICAgdGhpcy5zeXN0ZW1zLnB1c2goc3lzdGVtKTtcbiAgICB0aGlzLnNvcnRTeXN0ZW1zKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzb3J0U3lzdGVtcygpIHtcbiAgICB0aGlzLnN5c3RlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgcmV0dXJuIGEucHJpb3JpdHkgLSBiLnByaW9yaXR5IHx8IGEub3JkZXIgLSBiLm9yZGVyO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIHN5c3RlbVxuICAgKiBAcGFyYW0ge1N5c3RlbX0gU3lzdGVtIFN5c3RlbSB0byByZW1vdmVcbiAgICovXG4gIHJlbW92ZVN5c3RlbShTeXN0ZW0pIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLnN5c3RlbXMuaW5kZXhPZihTeXN0ZW0pO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICB0aGlzLnN5c3RlbXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgYWxsIHRoZSBzeXN0ZW1zLiBDYWxsZWQgcGVyIGZyYW1lLlxuICAgKiBAcGFyYW0ge051bWJlcn0gZGVsdGEgRGVsdGEgdGltZSBzaW5jZSB0aGUgbGFzdCBmcmFtZVxuICAgKiBAcGFyYW0ge051bWJlcn0gdGltZSBFbGFwc2VkIHRpbWVcbiAgICovXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUpIHtcbiAgICB0aGlzLnN5c3RlbXMuZm9yRWFjaChzeXN0ZW0gPT4ge1xuICAgICAgaWYgKHN5c3RlbS5lbmFibGVkICYmIHN5c3RlbS5pbml0aWFsaXplZCkge1xuICAgICAgICBpZiAoc3lzdGVtLmV4ZWN1dGUpIHtcbiAgICAgICAgICBsZXQgc3RhcnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgICAgc3lzdGVtLmV4ZWN1dGUoZGVsdGEsIHRpbWUpO1xuICAgICAgICAgIHN5c3RlbS5leGVjdXRlVGltZSA9IHBlcmZvcm1hbmNlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICB9XG4gICAgICAgIHN5c3RlbS5jbGVhckV2ZW50cygpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzdGF0c1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge1xuICAgICAgbnVtU3lzdGVtczogdGhpcy5zeXN0ZW1zLmxlbmd0aCxcbiAgICAgIHN5c3RlbXM6IHt9XG4gICAgfTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5zeXN0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc3lzdGVtID0gdGhpcy5zeXN0ZW1zW2ldO1xuICAgICAgdmFyIHN5c3RlbVN0YXRzID0gKHN0YXRzLnN5c3RlbXNbc3lzdGVtLmNvbnN0cnVjdG9yLm5hbWVdID0ge1xuICAgICAgICBxdWVyaWVzOiB7fVxuICAgICAgfSk7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHN5c3RlbS5jdHgpIHtcbiAgICAgICAgc3lzdGVtU3RhdHMucXVlcmllc1tuYW1lXSA9IHN5c3RlbS5jdHhbbmFtZV0uc3RhdHMoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cbiIsIi8qKlxuICogQGNsYXNzIEV2ZW50RGlzcGF0Y2hlclxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFdmVudERpc3BhdGNoZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLl9saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLnN0YXRzID0ge1xuICAgICAgZmlyZWQ6IDAsXG4gICAgICBoYW5kbGVkOiAwXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBsaXN0ZW5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgdG8gdHJpZ2dlciB3aGVuIHRoZSBldmVudCBpcyBmaXJlZFxuICAgKi9cbiAgYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgbGV0IGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50TmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICB9XG5cbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihsaXN0ZW5lcikgPT09IC0xKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXS5wdXNoKGxpc3RlbmVyKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgYW4gZXZlbnQgbGlzdGVuZXIgaXMgYWxyZWFkeSBhZGRlZCB0byB0aGUgbGlzdCBvZiBsaXN0ZW5lcnNcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBjaGVja1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayBmb3IgdGhlIHNwZWNpZmllZCBldmVudFxuICAgKi9cbiAgaGFzRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdICE9PSB1bmRlZmluZWQgJiZcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdLmluZGV4T2YobGlzdGVuZXIpICE9PSAtMVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFuIGV2ZW50IGxpc3RlbmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50XG4gICAqL1xuICByZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICB2YXIgbGlzdGVuZXJBcnJheSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xuICAgIGlmIChsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBpbmRleCA9IGxpc3RlbmVyQXJyYXkuaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGxpc3RlbmVyQXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGlzcGF0Y2ggYW4gZXZlbnRcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBkaXNwYXRjaFxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IChPcHRpb25hbCkgRW50aXR5IHRvIGVtaXRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IGNvbXBvbmVudFxuICAgKi9cbiAgZGlzcGF0Y2hFdmVudChldmVudE5hbWUsIGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgdGhpcy5zdGF0cy5maXJlZCsrO1xuXG4gICAgdmFyIGxpc3RlbmVyQXJyYXkgPSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXTtcbiAgICBpZiAobGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgYXJyYXkgPSBsaXN0ZW5lckFycmF5LnNsaWNlKDApO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGFycmF5W2ldLmNhbGwodGhpcywgZW50aXR5LCBjb21wb25lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCBzdGF0cyBjb3VudGVyc1xuICAgKi9cbiAgcmVzZXRDb3VudGVycygpIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkID0gdGhpcy5zdGF0cy5oYW5kbGVkID0gMDtcbiAgfVxufVxuIiwiLyoqXG4gKiBSZXR1cm4gdGhlIG5hbWUgb2YgYSBjb21wb25lbnRcbiAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE5hbWUoQ29tcG9uZW50KSB7XG4gIHJldHVybiBDb21wb25lbnQubmFtZTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gYSB2YWxpZCBwcm9wZXJ0eSBuYW1lIGZvciB0aGUgQ29tcG9uZW50XG4gKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KSB7XG4gIHZhciBuYW1lID0gZ2V0TmFtZShDb21wb25lbnQpO1xuICByZXR1cm4gbmFtZS5jaGFyQXQoMCkudG9Mb3dlckNhc2UoKSArIG5hbWUuc2xpY2UoMSk7XG59XG5cbi8qKlxuICogR2V0IGEga2V5IGZyb20gYSBsaXN0IG9mIGNvbXBvbmVudHNcbiAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBBcnJheSBvZiBjb21wb25lbnRzIHRvIGdlbmVyYXRlIHRoZSBrZXlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1ZXJ5S2V5KENvbXBvbmVudHMpIHtcbiAgdmFyIG5hbWVzID0gW107XG4gIGZvciAodmFyIG4gPSAwOyBuIDwgQ29tcG9uZW50cy5sZW5ndGg7IG4rKykge1xuICAgIHZhciBUID0gQ29tcG9uZW50c1tuXTtcbiAgICBpZiAodHlwZW9mIFQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIHZhciBvcGVyYXRvciA9IFQub3BlcmF0b3IgPT09IFwibm90XCIgPyBcIiFcIiA6IFQub3BlcmF0b3I7XG4gICAgICBuYW1lcy5wdXNoKG9wZXJhdG9yICsgZ2V0TmFtZShULkNvbXBvbmVudCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lcy5wdXNoKGdldE5hbWUoVCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lc1xuICAgIC5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHgudG9Mb3dlckNhc2UoKTtcbiAgICB9KVxuICAgIC5zb3J0KClcbiAgICAuam9pbihcIi1cIik7XG59XG4iLCJpbXBvcnQgRXZlbnREaXNwYXRjaGVyIGZyb20gXCIuL0V2ZW50RGlzcGF0Y2hlci5qc1wiO1xuaW1wb3J0IHsgcXVlcnlLZXkgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG4vKipcbiAqIEBjbGFzcyBRdWVyeVxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBRdWVyeSB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgTGlzdCBvZiB0eXBlcyBvZiBjb21wb25lbnRzIHRvIHF1ZXJ5XG4gICAqL1xuICBjb25zdHJ1Y3RvcihDb21wb25lbnRzLCBtYW5hZ2VyKSB7XG4gICAgdGhpcy5Db21wb25lbnRzID0gW107XG4gICAgdGhpcy5Ob3RDb21wb25lbnRzID0gW107XG5cbiAgICBDb21wb25lbnRzLmZvckVhY2goY29tcG9uZW50ID0+IHtcbiAgICAgIGlmICh0eXBlb2YgY29tcG9uZW50ID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHRoaXMuTm90Q29tcG9uZW50cy5wdXNoKGNvbXBvbmVudC5Db21wb25lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5Db21wb25lbnRzLnB1c2goY29tcG9uZW50KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICh0aGlzLkNvbXBvbmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjcmVhdGUgYSBxdWVyeSB3aXRob3V0IGNvbXBvbmVudHNcIik7XG4gICAgfVxuXG4gICAgdGhpcy5lbnRpdGllcyA9IFtdO1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyID0gbmV3IEV2ZW50RGlzcGF0Y2hlcigpO1xuXG4gICAgLy8gVGhpcyBxdWVyeSBpcyBiZWluZyB1c2VkIGJ5IGEgcmVhY3RpdmUgc3lzdGVtXG4gICAgdGhpcy5yZWFjdGl2ZSA9IGZhbHNlO1xuXG4gICAgdGhpcy5rZXkgPSBxdWVyeUtleShDb21wb25lbnRzKTtcblxuICAgIC8vIEZpbGwgdGhlIHF1ZXJ5IHdpdGggdGhlIGV4aXN0aW5nIGVudGl0aWVzXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtYW5hZ2VyLl9lbnRpdGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGVudGl0eSA9IG1hbmFnZXIuX2VudGl0aWVzW2ldO1xuICAgICAgaWYgKHRoaXMubWF0Y2goZW50aXR5KSkge1xuICAgICAgICAvLyBAdG9kbyA/Pz8gdGhpcy5hZGRFbnRpdHkoZW50aXR5KTsgPT4gcHJldmVudGluZyB0aGUgZXZlbnQgdG8gYmUgZ2VuZXJhdGVkXG4gICAgICAgIGVudGl0eS5xdWVyaWVzLnB1c2godGhpcyk7XG4gICAgICAgIHRoaXMuZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgZW50aXR5IHRvIHRoaXMgcXVlcnlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eVxuICAgKi9cbiAgYWRkRW50aXR5KGVudGl0eSkge1xuICAgIGVudGl0eS5xdWVyaWVzLnB1c2godGhpcyk7XG4gICAgdGhpcy5lbnRpdGllcy5wdXNoKGVudGl0eSk7XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQsIGVudGl0eSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGVudGl0eSBmcm9tIHRoaXMgcXVlcnlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlRW50aXR5KGVudGl0eSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuICAgIGlmICh+aW5kZXgpIHtcbiAgICAgIHRoaXMuZW50aXRpZXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgICAgaW5kZXggPSBlbnRpdHkucXVlcmllcy5pbmRleE9mKHRoaXMpO1xuICAgICAgZW50aXR5LnF1ZXJpZXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICBlbnRpdHlcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbWF0Y2goZW50aXR5LCBpbmNsdWRlUmVtb3ZlZCA9IGZhbHNlKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGVudGl0eS5oYXNBbGxDb21wb25lbnRzKHRoaXMuQ29tcG9uZW50cywgaW5jbHVkZVJlbW92ZWQpICYmXG4gICAgICAhZW50aXR5Lmhhc0FueUNvbXBvbmVudHModGhpcy5Ob3RDb21wb25lbnRzLCBpbmNsdWRlUmVtb3ZlZClcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzdGF0cyBmb3IgdGhpcyBxdWVyeVxuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG51bUNvbXBvbmVudHM6IHRoaXMuQ29tcG9uZW50cy5sZW5ndGgsXG4gICAgICBudW1FbnRpdGllczogdGhpcy5lbnRpdGllcy5sZW5ndGhcbiAgICB9O1xuICB9XG59XG5cblF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQgPSBcIlF1ZXJ5I0VOVElUWV9BRERFRFwiO1xuUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVEID0gXCJRdWVyeSNFTlRJVFlfUkVNT1ZFRFwiO1xuUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VEID0gXCJRdWVyeSNDT01QT05FTlRfQ0hBTkdFRFwiO1xuIiwiaW1wb3J0IFF1ZXJ5IGZyb20gXCIuL1F1ZXJ5LmpzXCI7XG5pbXBvcnQgd3JhcEltbXV0YWJsZUNvbXBvbmVudCBmcm9tIFwiLi9XcmFwSW1tdXRhYmxlQ29tcG9uZW50LmpzXCI7XG5cbi8vIEB0b2RvIFRha2UgdGhpcyBvdXQgZnJvbSB0aGVyZSBvciB1c2UgRU5WXG5jb25zdCBERUJVRyA9IGZhbHNlO1xuXG4vLyBAdG9kbyByZXNldCBpdCBieSB3b3JsZD9cbnZhciBuZXh0SWQgPSAwO1xuXG4vKipcbiAqIEBjbGFzcyBFbnRpdHlcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRW50aXR5IHtcbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAY2xhc3MgRW50aXR5XG4gICAqIEBwYXJhbSB7V29ybGR9IHdvcmxkXG4gICAqL1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMuX3dvcmxkID0gd29ybGQgfHwgbnVsbDtcblxuICAgIC8vIFVuaXF1ZSBJRCBmb3IgdGhpcyBlbnRpdHlcbiAgICB0aGlzLmlkID0gbmV4dElkKys7XG5cbiAgICAvLyBMaXN0IG9mIGNvbXBvbmVudHMgdHlwZXMgdGhlIGVudGl0eSBoYXNcbiAgICB0aGlzLl9Db21wb25lbnRUeXBlcyA9IFtdO1xuXG4gICAgLy8gSW5zdGFuY2Ugb2YgdGhlIGNvbXBvbmVudHNcbiAgICB0aGlzLl9jb21wb25lbnRzID0ge307XG5cbiAgICAvLyBMaXN0IG9mIHRhZ3MgdGhpcyBlbnRpdHkgaGFzXG4gICAgdGhpcy5fdGFncyA9IFtdO1xuXG4gICAgLy8gUXVlcmllcyB3aGVyZSB0aGUgZW50aXR5IGlzIGFkZGVkXG4gICAgdGhpcy5xdWVyaWVzID0gW107XG5cbiAgICAvLyBVc2VkIGZvciBkZWZlcnJlZCByZW1vdmFsXG4gICAgdGhpcy5jb21wb25lbnRzVG9SZW1vdmUgPSBbXTtcbiAgfVxuXG4gIC8vIENPTVBPTkVOVFNcblxuICAvKipcbiAgICogUmV0dXJuIGFuIGltbXV0YWJsZSByZWZlcmVuY2Ugb2YgYSBjb21wb25lbnRcbiAgICogTm90ZTogQSBwcm94eSB3aWxsIGJlIHVzZWQgb24gZGVidWcgbW9kZSwgYW5kIGl0IHdpbGwganVzdCBhZmZlY3RcbiAgICogICAgICAgdGhlIGZpcnN0IGxldmVsIGF0dHJpYnV0ZXMgb24gdGhlIG9iamVjdCwgaXQgd29uJ3Qgd29yayByZWN1cnNpdmVseS5cbiAgICogQHBhcmFtIHtDb21wb25lbnR9IFR5cGUgb2YgY29tcG9uZW50IHRvIGdldFxuICAgKiBAcmV0dXJuIHtDb21wb25lbnR9IEltbXV0YWJsZSBjb21wb25lbnQgcmVmZXJlbmNlXG4gICAqL1xuICBnZXRDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IHRoaXMuX2NvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdO1xuICAgIHJldHVybiBERUJVRyA/IHdyYXBJbW11dGFibGVDb21wb25lbnQoQ29tcG9uZW50LCBjb21wb25lbnQpIDogY29tcG9uZW50O1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50cygpIHtcbiAgICByZXR1cm4gdGhpcy5fY29tcG9uZW50cztcbiAgfVxuXG4gIGdldENvbXBvbmVudFR5cGVzKCkge1xuICAgIHJldHVybiB0aGlzLl9Db21wb25lbnRUeXBlcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBtdXRhYmxlIHJlZmVyZW5jZSBvZiBhIGNvbXBvbmVudC5cbiAgICogQHBhcmFtIHtDb21wb25lbnR9IFR5cGUgb2YgY29tcG9uZW50IHRvIGdldFxuICAgKiBAcmV0dXJuIHtDb21wb25lbnR9IE11dGFibGUgY29tcG9uZW50IHJlZmVyZW5jZVxuICAgKi9cbiAgZ2V0TXV0YWJsZUNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcy5fY29tcG9uZW50c1tDb21wb25lbnQubmFtZV07XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnF1ZXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMucXVlcmllc1tpXTtcbiAgICAgIGlmIChxdWVyeS5yZWFjdGl2ZSkge1xuICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgICBRdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQsXG4gICAgICAgICAgdGhpcyxcbiAgICAgICAgICBjb21wb25lbnRcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSBjb21wb25lbnQgdG8gdGhlIGVudGl0eVxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IHRvIGFkZCB0byB0aGlzIGVudGl0eVxuICAgKiBAcGFyYW0ge09iamVjdH0gT3B0aW9uYWwgdmFsdWVzIHRvIHJlcGxhY2UgdGhlIGRlZmF1bHQgYXR0cmlidXRlcyBvbiB0aGUgY29tcG9uZW50XG4gICAqL1xuICBhZGRDb21wb25lbnQoQ29tcG9uZW50LCB2YWx1ZXMpIHtcbiAgICB0aGlzLl93b3JsZC5lbnRpdHlBZGRDb21wb25lbnQodGhpcywgQ29tcG9uZW50LCB2YWx1ZXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIGNvbXBvbmVudCBmcm9tIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCB0byByZW1vdmUgZnJvbSB0aGUgZW50aXR5XG4gICAqL1xuICByZW1vdmVDb21wb25lbnQoQ29tcG9uZW50LCBmb3JjZVJlbW92ZSkge1xuICAgIHRoaXMuX3dvcmxkLmVudGl0eVJlbW92ZUNvbXBvbmVudCh0aGlzLCBDb21wb25lbnQsIGZvcmNlUmVtb3ZlKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGUgZW50aXR5IGhhcyBhIGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IHRvIGNoZWNrXG4gICAqIEBwYXJhbSB7Qm9vbH0gaW5jbHVkZSBDb21wb25lbnRzIHF1ZXVlZCBmb3IgcmVtb3ZhbCAoRGVmYXVsdCBpcyBmYWxzZSlcbiAgICovXG4gIGhhc0NvbXBvbmVudChDb21wb25lbnQsIGluY2x1ZGVSZW1vdmVkID0gZmFsc2UpIHtcbiAgICByZXR1cm4gKFxuICAgICAgISF+dGhpcy5fQ29tcG9uZW50VHlwZXMuaW5kZXhPZihDb21wb25lbnQpICYmXG4gICAgICAoaW5jbHVkZVJlbW92ZWQgfHwgIX50aGlzLmNvbXBvbmVudHNUb1JlbW92ZS5pbmRleE9mKENvbXBvbmVudCkpXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGUgZW50aXR5IGhhcyBhbGwgY29tcG9uZW50cyBpbiBhIGxpc3RcbiAgICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIHRvIGNoZWNrXG4gICAqIEBwYXJhbSB7Qm9vbH0gaW5jbHVkZSBDb21wb25lbnRzIHF1ZXVlZCBmb3IgcmVtb3ZhbCAoRGVmYXVsdCBpcyBmYWxzZSlcbiAgICovXG4gIGhhc0FsbENvbXBvbmVudHMoQ29tcG9uZW50cywgaW5jbHVkZVJlbW92ZWQgPSBmYWxzZSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCF0aGlzLmhhc0NvbXBvbmVudChDb21wb25lbnRzW2ldLCBpbmNsdWRlUmVtb3ZlZCkpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhlIGVudGl0eSBoYXMgYW55IGNvbXBvbmVudHMgaW4gYSBsaXN0XG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyB0byBjaGVja1xuICAgKiBAcGFyYW0ge0Jvb2x9IGluY2x1ZGUgQ29tcG9uZW50cyBxdWV1ZWQgZm9yIHJlbW92YWwgKERlZmF1bHQgaXMgZmFsc2UpXG4gICAqL1xuICBoYXNBbnlDb21wb25lbnRzKENvbXBvbmVudHMsIGluY2x1ZGVSZW1vdmVkID0gZmFsc2UpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IENvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLmhhc0NvbXBvbmVudChDb21wb25lbnRzW2ldLCBpbmNsdWRlUmVtb3ZlZCkpIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0aGUgY29tcG9uZW50cyBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZUFsbENvbXBvbmVudHMoZm9yY2VSZW1vdmUpIHtcbiAgICByZXR1cm4gdGhpcy5fd29ybGQuZW50aXR5UmVtb3ZlQWxsQ29tcG9uZW50cyh0aGlzLCBmb3JjZVJlbW92ZSk7XG4gIH1cblxuICAvLyBUQUdTXG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGEgdGFnXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIGNoZWNrXG4gICAqL1xuICBoYXNUYWcodGFnKSB7XG4gICAgcmV0dXJuICEhfnRoaXMuX3RhZ3MuaW5kZXhPZih0YWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIHRhZyB0byB0aGlzIGVudGl0eVxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byBhZGQgdG8gdGhpcyBlbnRpdHlcbiAgICovXG4gIGFkZFRhZyh0YWcpIHtcbiAgICB0aGlzLl93b3JsZC5lbnRpdHlBZGRUYWcodGhpcywgdGFnKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSB0YWcgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZVRhZyh0YWcpIHtcbiAgICB0aGlzLl93b3JsZC5lbnRpdHlSZW1vdmVUYWcodGhpcywgdGFnKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIEVYVFJBU1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIHRoZSBlbnRpdHkuIFRvIGJlIHVzZWQgd2hlbiByZXR1cm5pbmcgYW4gZW50aXR5IHRvIHRoZSBwb29sXG4gICAqL1xuICByZXNldCgpIHtcbiAgICB0aGlzLmlkID0gbmV4dElkKys7XG4gICAgdGhpcy5fd29ybGQgPSBudWxsO1xuICAgIHRoaXMuX0NvbXBvbmVudFR5cGVzLmxlbmd0aCA9IDA7XG4gICAgdGhpcy5xdWVyaWVzLmxlbmd0aCA9IDA7XG4gICAgdGhpcy5fY29tcG9uZW50cyA9IHt9O1xuICAgIHRoaXMuX3RhZ3MubGVuZ3RoID0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhlIGVudGl0eSBmcm9tIHRoZSB3b3JsZFxuICAgKi9cbiAgcmVtb3ZlKGZvcmNlUmVtb3ZlKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dvcmxkLnJlbW92ZUVudGl0eSh0aGlzLCBmb3JjZVJlbW92ZSk7XG4gIH1cbn1cbiIsIi8qKlxuICogQGNsYXNzIE9iamVjdFBvb2xcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgT2JqZWN0UG9vbCB7XG4gIC8vIEB0b2RvIEFkZCBpbml0aWFsIHNpemVcbiAgY29uc3RydWN0b3IoVCwgaW5pdGlhbFNpemUpIHtcbiAgICB0aGlzLmZyZWVMaXN0ID0gW107XG4gICAgdGhpcy5jb3VudCA9IDA7XG4gICAgdGhpcy5UID0gVDtcblxuICAgIHZhciBleHRyYUFyZ3MgPSBudWxsO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgZXh0cmFBcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIGV4dHJhQXJncy5zaGlmdCgpO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRlRWxlbWVudCA9IGV4dHJhQXJnc1xuICAgICAgPyAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBUKC4uLmV4dHJhQXJncyk7XG4gICAgICAgIH1cbiAgICAgIDogKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgVCgpO1xuICAgICAgICB9O1xuXG4gICAgaWYgKHR5cGVvZiBpbml0aWFsU2l6ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgdGhpcy5leHBhbmQoaW5pdGlhbFNpemUpO1xuICAgIH1cbiAgfVxuXG4gIGFxdWlyZSgpIHtcbiAgICAvLyBHcm93IHRoZSBsaXN0IGJ5IDIwJWlzaCBpZiB3ZSdyZSBvdXRcbiAgICBpZiAodGhpcy5mcmVlTGlzdC5sZW5ndGggPD0gMCkge1xuICAgICAgdGhpcy5leHBhbmQoTWF0aC5yb3VuZCh0aGlzLmNvdW50ICogMC4yKSArIDEpO1xuICAgIH1cblxuICAgIHZhciBpdGVtID0gdGhpcy5mcmVlTGlzdC5wb3AoKTtcblxuICAgIHJldHVybiBpdGVtO1xuICB9XG5cbiAgcmVsZWFzZShpdGVtKSB7XG4gICAgaXRlbS5yZXNldCgpO1xuICAgIHRoaXMuZnJlZUxpc3QucHVzaChpdGVtKTtcbiAgfVxuXG4gIGV4cGFuZChjb3VudCkge1xuICAgIGZvciAodmFyIG4gPSAwOyBuIDwgY291bnQ7IG4rKykge1xuICAgICAgdGhpcy5mcmVlTGlzdC5wdXNoKHRoaXMuY3JlYXRlRWxlbWVudCgpKTtcbiAgICB9XG4gICAgdGhpcy5jb3VudCArPSBjb3VudDtcbiAgfVxuXG4gIHRvdGFsU2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb3VudDtcbiAgfVxuXG4gIHRvdGFsRnJlZSgpIHtcbiAgICByZXR1cm4gdGhpcy5mcmVlTGlzdC5sZW5ndGg7XG4gIH1cblxuICB0b3RhbFVzZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuY291bnQgLSB0aGlzLmZyZWVMaXN0Lmxlbmd0aDtcbiAgfVxufVxuIiwiaW1wb3J0IFF1ZXJ5IGZyb20gXCIuL1F1ZXJ5LmpzXCI7XG5pbXBvcnQgeyBxdWVyeUtleSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIFF1ZXJ5TWFuYWdlclxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBRdWVyeU1hbmFnZXIge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMuX3dvcmxkID0gd29ybGQ7XG5cbiAgICAvLyBRdWVyaWVzIGluZGV4ZWQgYnkgYSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIGNvbXBvbmVudHMgaXQgaGFzXG4gICAgdGhpcy5fcXVlcmllcyA9IHt9O1xuICB9XG5cbiAgb25FbnRpdHlSZW1vdmVkKGVudGl0eSkge1xuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV07XG4gICAgICBpZiAoZW50aXR5LnF1ZXJpZXMuaW5kZXhPZihxdWVyeSkgIT09IC0xKSB7XG4gICAgICAgIHF1ZXJ5LnJlbW92ZUVudGl0eShlbnRpdHkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB3aGVuIGEgY29tcG9uZW50IGlzIGFkZGVkIHRvIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0aGF0IGp1c3QgZ290IHRoZSBuZXcgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IGFkZGVkIHRvIHRoZSBlbnRpdHlcbiAgICovXG4gIG9uRW50aXR5Q29tcG9uZW50QWRkZWQoZW50aXR5LCBDb21wb25lbnQpIHtcbiAgICAvLyBAdG9kbyBVc2UgYml0bWFzayBmb3IgY2hlY2tpbmcgY29tcG9uZW50cz9cblxuICAgIC8vIENoZWNrIGVhY2ggaW5kZXhlZCBxdWVyeSB0byBzZWUgaWYgd2UgbmVlZCB0byBhZGQgdGhpcyBlbnRpdHkgdG8gdGhlIGxpc3RcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdO1xuXG4gICAgICBpZiAoXG4gICAgICAgICEhfnF1ZXJ5Lk5vdENvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpICYmXG4gICAgICAgIH5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSlcbiAgICAgICkge1xuICAgICAgICBxdWVyeS5yZW1vdmVFbnRpdHkoZW50aXR5KTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCB0aGUgZW50aXR5IG9ubHkgaWY6XG4gICAgICAvLyBDb21wb25lbnQgaXMgaW4gdGhlIHF1ZXJ5XG4gICAgICAvLyBhbmQgRW50aXR5IGhhcyBBTEwgdGhlIGNvbXBvbmVudHMgb2YgdGhlIHF1ZXJ5XG4gICAgICAvLyBhbmQgRW50aXR5IGlzIG5vdCBhbHJlYWR5IGluIHRoZSBxdWVyeVxuICAgICAgaWYgKFxuICAgICAgICAhfnF1ZXJ5LkNvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpIHx8XG4gICAgICAgICFxdWVyeS5tYXRjaChlbnRpdHkpIHx8XG4gICAgICAgIH5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSlcbiAgICAgIClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHF1ZXJ5LmFkZEVudGl0eShlbnRpdHkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB3aGVuIGEgY29tcG9uZW50IGlzIHJlbW92ZWQgZnJvbSBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdG8gcmVtb3ZlIHRoZSBjb21wb25lbnQgZnJvbVxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZW1vdmUgZnJvbSB0aGUgZW50aXR5XG4gICAqL1xuICBvbkVudGl0eUNvbXBvbmVudFJlbW92ZWQoZW50aXR5LCBDb21wb25lbnQpIHtcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdO1xuXG4gICAgICBpZiAoXG4gICAgICAgICEhfnF1ZXJ5Lk5vdENvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpICYmXG4gICAgICAgICF+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpICYmXG4gICAgICAgIHF1ZXJ5Lm1hdGNoKGVudGl0eSlcbiAgICAgICkge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcIlF1ZXJ5IG5vdyBtYXRjaGVzXCIsIHF1ZXJ5TmFtZSwgZW50aXR5KTtcbiAgICAgICAgcXVlcnkuYWRkRW50aXR5KGVudGl0eSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgICEhfnF1ZXJ5LkNvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpICYmXG4gICAgICAgICEhfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KSAmJlxuICAgICAgICAhcXVlcnkubWF0Y2goZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiUXVlcnkgbm8gbG9uZ2VyIG1hdGNoZXNcIiwgcXVlcnlOYW1lLCBlbnRpdHkpO1xuICAgICAgICBxdWVyeS5yZW1vdmVFbnRpdHkoZW50aXR5KTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHF1ZXJ5IGZvciB0aGUgc3BlY2lmaWVkIGNvbXBvbmVudHNcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudHMgQ29tcG9uZW50cyB0aGF0IHRoZSBxdWVyeSBzaG91bGQgaGF2ZVxuICAgKi9cbiAgZ2V0UXVlcnkoQ29tcG9uZW50cykge1xuICAgIHZhciBrZXkgPSBxdWVyeUtleShDb21wb25lbnRzKTtcbiAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW2tleV07XG4gICAgaWYgKCFxdWVyeSkge1xuICAgICAgdGhpcy5fcXVlcmllc1trZXldID0gcXVlcnkgPSBuZXcgUXVlcnkoQ29tcG9uZW50cywgdGhpcy5fd29ybGQpO1xuICAgIH1cbiAgICByZXR1cm4gcXVlcnk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHNvbWUgc3RhdHMgZnJvbSB0aGlzIGNsYXNzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7fTtcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgc3RhdHNbcXVlcnlOYW1lXSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXS5zdGF0cygpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cbiIsImltcG9ydCBFbnRpdHkgZnJvbSBcIi4vRW50aXR5LmpzXCI7XG5pbXBvcnQgT2JqZWN0UG9vbCBmcm9tIFwiLi9PYmplY3RQb29sLmpzXCI7XG5pbXBvcnQgUXVlcnlNYW5hZ2VyIGZyb20gXCIuL1F1ZXJ5TWFuYWdlci5qc1wiO1xuaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcbmltcG9ydCB7IGNvbXBvbmVudFByb3BlcnR5TmFtZSwgZ2V0TmFtZSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIEVudGl0eU1hbmFnZXJcbiAqL1xuZXhwb3J0IGNsYXNzIEVudGl0eU1hbmFnZXIge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyID0gd29ybGQuY29tcG9uZW50c01hbmFnZXI7XG5cbiAgICAvLyBBbGwgdGhlIGVudGl0aWVzIGluIHRoaXMgaW5zdGFuY2VcbiAgICB0aGlzLl9lbnRpdGllcyA9IFtdO1xuXG4gICAgLy8gTWFwIGJldHdlZW4gdGFnIGFuZCBlbnRpdGllc1xuICAgIHRoaXMuX3RhZ3MgPSB7fTtcblxuICAgIHRoaXMuX3F1ZXJ5TWFuYWdlciA9IG5ldyBRdWVyeU1hbmFnZXIodGhpcyk7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG4gICAgdGhpcy5fZW50aXR5UG9vbCA9IG5ldyBPYmplY3RQb29sKEVudGl0eSk7XG5cbiAgICAvLyBEZWZlcnJlZCBkZWxldGlvblxuICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlID0gW107XG4gICAgdGhpcy5lbnRpdGllc1RvUmVtb3ZlID0gW107XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGVudGl0eVxuICAgKi9cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHZhciBlbnRpdHkgPSB0aGlzLl9lbnRpdHlQb29sLmFxdWlyZSgpO1xuICAgIGVudGl0eS5fd29ybGQgPSB0aGlzO1xuICAgIHRoaXMuX2VudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KEVOVElUWV9DUkVBVEVELCBlbnRpdHkpO1xuICAgIHJldHVybiBlbnRpdHk7XG4gIH1cblxuICAvLyBDT01QT05FTlRTXG5cbiAgLyoqXG4gICAqIEFkZCBhIGNvbXBvbmVudCB0byBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hlcmUgdGhlIGNvbXBvbmVudCB3aWxsIGJlIGFkZGVkXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIGJlIGFkZGVkIHRvIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtPYmplY3R9IHZhbHVlcyBPcHRpb25hbCB2YWx1ZXMgdG8gcmVwbGFjZSB0aGUgZGVmYXVsdCBhdHRyaWJ1dGVzXG4gICAqL1xuICBlbnRpdHlBZGRDb21wb25lbnQoZW50aXR5LCBDb21wb25lbnQsIHZhbHVlcykge1xuICAgIGlmICh+ZW50aXR5Ll9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCkpIHJldHVybjtcblxuICAgIGVudGl0eS5fQ29tcG9uZW50VHlwZXMucHVzaChDb21wb25lbnQpO1xuXG4gICAgdmFyIGNvbXBvbmVudFBvb2wgPSB0aGlzLndvcmxkLmNvbXBvbmVudHNNYW5hZ2VyLmdldENvbXBvbmVudHNQb29sKFxuICAgICAgQ29tcG9uZW50XG4gICAgKTtcbiAgICB2YXIgY29tcG9uZW50ID0gY29tcG9uZW50UG9vbC5hcXVpcmUoKTtcblxuICAgIGVudGl0eS5fY29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBjb21wb25lbnQ7XG5cbiAgICBpZiAodmFsdWVzKSB7XG4gICAgICBpZiAoY29tcG9uZW50LmNvcHkpIHtcbiAgICAgICAgY29tcG9uZW50LmNvcHkodmFsdWVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4gdmFsdWVzKSB7XG4gICAgICAgICAgY29tcG9uZW50W25hbWVdID0gdmFsdWVzW25hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5Q29tcG9uZW50QWRkZWQoZW50aXR5LCBDb21wb25lbnQpO1xuICAgIHRoaXMud29ybGQuY29tcG9uZW50c01hbmFnZXIuY29tcG9uZW50QWRkZWRUb0VudGl0eShDb21wb25lbnQpO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChDT01QT05FTlRfQURERUQsIGVudGl0eSwgQ29tcG9uZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBjb21wb25lbnQgZnJvbSBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hpY2ggd2lsbCBnZXQgcmVtb3ZlZCB0aGUgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Kn0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZW1vdmUgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7Qm9vbH0gZm9yY2VSZW1vdmUgSWYgeW91IHdhbnQgdG8gcmVtb3ZlIHRoZSBjb21wb25lbnQgaW1tZWRpYXRlbHkgaW5zdGVhZCBvZiBkZWZlcnJlZCAoRGVmYXVsdCBpcyBmYWxzZSlcbiAgICovXG4gIGVudGl0eVJlbW92ZUNvbXBvbmVudChlbnRpdHksIENvbXBvbmVudCwgZm9yY2VSZW1vdmUpIHtcbiAgICB2YXIgaW5kZXggPSBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChDT01QT05FTlRfUkVNT1ZFLCBlbnRpdHksIENvbXBvbmVudCk7XG5cbiAgICBpZiAoZm9yY2VSZW1vdmUpIHtcbiAgICAgIHRoaXMuX2VudGl0eVJlbW92ZUNvbXBvbmVudFN5bmMoZW50aXR5LCBDb21wb25lbnQsIGluZGV4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGVudGl0eS5jb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoID09PSAwKVxuICAgICAgICB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZS5wdXNoKGVudGl0eSk7XG4gICAgICBlbnRpdHkuY29tcG9uZW50c1RvUmVtb3ZlLnB1c2goQ29tcG9uZW50KTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBlYWNoIGluZGV4ZWQgcXVlcnkgdG8gc2VlIGlmIHdlIG5lZWQgdG8gcmVtb3ZlIGl0XG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5Q29tcG9uZW50UmVtb3ZlZChlbnRpdHksIENvbXBvbmVudCk7XG4gIH1cblxuICBfZW50aXR5UmVtb3ZlQ29tcG9uZW50U3luYyhlbnRpdHksIENvbXBvbmVudCwgaW5kZXgpIHtcbiAgICAvLyBSZW1vdmUgVCBsaXN0aW5nIG9uIGVudGl0eSBhbmQgcHJvcGVydHkgcmVmLCB0aGVuIGZyZWUgdGhlIGNvbXBvbmVudC5cbiAgICBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgdmFyIHByb3BOYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG4gICAgdmFyIGNvbXBvbmVudE5hbWUgPSBnZXROYW1lKENvbXBvbmVudCk7XG4gICAgdmFyIGNvbXBvbmVudCA9IGVudGl0eS5fY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcbiAgICBkZWxldGUgZW50aXR5Ll9jb21wb25lbnRzW2NvbXBvbmVudE5hbWVdO1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2xbcHJvcE5hbWVdLnJlbGVhc2UoY29tcG9uZW50KTtcbiAgICB0aGlzLndvcmxkLmNvbXBvbmVudHNNYW5hZ2VyLmNvbXBvbmVudFJlbW92ZWRGcm9tRW50aXR5KENvbXBvbmVudCk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0aGUgY29tcG9uZW50cyBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSBmcm9tIHdoaWNoIHRoZSBjb21wb25lbnRzIHdpbGwgYmUgcmVtb3ZlZFxuICAgKi9cbiAgZW50aXR5UmVtb3ZlQWxsQ29tcG9uZW50cyhlbnRpdHksIGZvcmNlUmVtb3ZlKSB7XG4gICAgbGV0IENvbXBvbmVudHMgPSBlbnRpdHkuX0NvbXBvbmVudFR5cGVzO1xuXG4gICAgZm9yIChsZXQgaiA9IENvbXBvbmVudHMubGVuZ3RoIC0gMTsgaiA+PSAwOyBqLS0pIHtcbiAgICAgIHRoaXMuZW50aXR5UmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50c1tqXSwgZm9yY2VSZW1vdmUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhlIGVudGl0eSBmcm9tIHRoaXMgbWFuYWdlci4gSXQgd2lsbCBjbGVhciBhbHNvIGl0cyBjb21wb25lbnRzIGFuZCB0YWdzXG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRvIHJlbW92ZSBmcm9tIHRoZSBtYW5hZ2VyXG4gICAqIEBwYXJhbSB7Qm9vbH0gZm9yY2VSZW1vdmUgSWYgeW91IHdhbnQgdG8gcmVtb3ZlIHRoZSBjb21wb25lbnQgaW1tZWRpYXRlbHkgaW5zdGVhZCBvZiBkZWZlcnJlZCAoRGVmYXVsdCBpcyBmYWxzZSlcbiAgICovXG4gIHJlbW92ZUVudGl0eShlbnRpdHksIGZvcmNlUmVtb3ZlKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5fZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuXG4gICAgaWYgKCF+aW5kZXgpIHRocm93IG5ldyBFcnJvcihcIlRyaWVkIHRvIHJlbW92ZSBlbnRpdHkgbm90IGluIGxpc3RcIik7XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBlbnRpdHkgbGlzdFxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoRU5USVRZX1JFTU9WRUQsIGVudGl0eSk7XG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5UmVtb3ZlZChlbnRpdHkpO1xuXG4gICAgaWYgKGZvcmNlUmVtb3ZlID09PSB0cnVlKSB7XG4gICAgICB0aGlzLl9yZW1vdmVFbnRpdHlTeW5jKGVudGl0eSwgaW5kZXgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUucHVzaChlbnRpdHkpO1xuICAgIH1cbiAgfVxuXG4gIF9yZW1vdmVFbnRpdHlTeW5jKGVudGl0eSwgaW5kZXgpIHtcbiAgICB0aGlzLl9lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgdGhpcy5lbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKGVudGl0eSwgdHJ1ZSk7XG5cbiAgICAvLyBSZW1vdmUgZW50aXR5IGZyb20gYW55IHRhZyBncm91cHMgYW5kIGNsZWFyIHRoZSBvbi1lbnRpdHkgcmVmXG4gICAgZW50aXR5Ll90YWdzLmxlbmd0aCA9IDA7XG4gICAgZm9yICh2YXIgdGFnIGluIHRoaXMuX3RhZ3MpIHtcbiAgICAgIHZhciBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXTtcbiAgICAgIHZhciBuID0gZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuICAgICAgaWYgKH5uKSBlbnRpdGllcy5zcGxpY2UobiwgMSk7XG4gICAgfVxuXG4gICAgLy8gUHJldmVudCBhbnkgYWNjZXNzIGFuZCBmcmVlXG4gICAgZW50aXR5Ll93b3JsZCA9IG51bGw7XG4gICAgdGhpcy5fZW50aXR5UG9vbC5yZWxlYXNlKGVudGl0eSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCBlbnRpdGllcyBmcm9tIHRoaXMgbWFuYWdlclxuICAgKi9cbiAgcmVtb3ZlQWxsRW50aXRpZXMoKSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMuX2VudGl0aWVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB0aGlzLl9lbnRpdGllc1tpXS5yZW1vdmUoKTtcbiAgICB9XG4gIH1cblxuICBwcm9jZXNzRGVmZXJyZWRSZW1vdmFsKCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5lbnRpdGllc1RvUmVtb3ZlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgZW50aXR5ID0gdGhpcy5lbnRpdGllc1RvUmVtb3ZlW2ldO1xuICAgICAgbGV0IGluZGV4ID0gdGhpcy5fZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuICAgICAgdGhpcy5fcmVtb3ZlRW50aXR5U3luYyhlbnRpdHksIGluZGV4KTtcbiAgICB9XG4gICAgdGhpcy5lbnRpdGllc1RvUmVtb3ZlLmxlbmd0aCA9IDA7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgZW50aXR5ID0gdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmVbaV07XG4gICAgICB3aGlsZSAoZW50aXR5LmNvbXBvbmVudHNUb1JlbW92ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGxldCBDb21wb25lbnQgPSBlbnRpdHkuY29tcG9uZW50c1RvUmVtb3ZlLnBvcCgpO1xuICAgICAgICBsZXQgaW5kZXggPSBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KTtcbiAgICAgICAgdGhpcy5fZW50aXR5UmVtb3ZlQ29tcG9uZW50U3luYyhlbnRpdHksIENvbXBvbmVudCwgaW5kZXgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlLmxlbmd0aCA9IDA7XG4gIH1cblxuICAvLyBUQUdTXG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbGwgdGhlIGVudGl0aWVzIHRoYXQgaGFzIHRoZSBzcGVjaWZpZWQgdGFnXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIGZpbHRlciB0aGUgZW50aXRpZXMgdG8gYmUgcmVtb3ZlZFxuICAgKi9cbiAgcmVtb3ZlRW50aXRpZXNCeVRhZyh0YWcpIHtcbiAgICB2YXIgZW50aXRpZXMgPSB0aGlzLl90YWdzW3RhZ107XG5cbiAgICBpZiAoIWVudGl0aWVzKSByZXR1cm47XG5cbiAgICBmb3IgKHZhciB4ID0gZW50aXRpZXMubGVuZ3RoIC0gMTsgeCA+PSAwOyB4LS0pIHtcbiAgICAgIHZhciBlbnRpdHkgPSBlbnRpdGllc1t4XTtcbiAgICAgIGVudGl0eS5yZW1vdmUoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkIHRhZyB0byBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hpY2ggd2lsbCBnZXQgdGhlIHRhZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byBhZGQgdG8gdGhlIGVudGl0eVxuICAgKi9cbiAgZW50aXR5QWRkVGFnKGVudGl0eSwgdGFnKSB7XG4gICAgdmFyIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddO1xuXG4gICAgaWYgKCFlbnRpdGllcykgZW50aXRpZXMgPSB0aGlzLl90YWdzW3RhZ10gPSBbXTtcblxuICAgIC8vIERvbid0IGFkZCBpZiBhbHJlYWR5IHRoZXJlXG4gICAgaWYgKH5lbnRpdGllcy5pbmRleE9mKGVudGl0eSkpIHJldHVybjtcblxuICAgIC8vIEFkZCB0byBvdXIgdGFnIGluZGV4IEFORCB0aGUgbGlzdCBvbiB0aGUgZW50aXR5XG4gICAgZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgIGVudGl0eS5fdGFncy5wdXNoKHRhZyk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgdGFnIGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRoYXQgd2lsbCBnZXQgcmVtb3ZlZCB0aGUgdGFnXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIHJlbW92ZVxuICAgKi9cbiAgZW50aXR5UmVtb3ZlVGFnKGVudGl0eSwgdGFnKSB7XG4gICAgdmFyIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddO1xuICAgIGlmICghZW50aXRpZXMpIHJldHVybjtcblxuICAgIHZhciBpbmRleCA9IGVudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgLy8gUmVtb3ZlIGZyb20gb3VyIGluZGV4IEFORCB0aGUgbGlzdCBvbiB0aGUgZW50aXR5XG4gICAgZW50aXRpZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICBlbnRpdHkuX3RhZ3Muc3BsaWNlKGVudGl0eS5fdGFncy5pbmRleE9mKHRhZyksIDEpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHF1ZXJ5IGJhc2VkIG9uIGEgbGlzdCBvZiBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBMaXN0IG9mIGNvbXBvbmVudHMgdGhhdCB3aWxsIGZvcm0gdGhlIHF1ZXJ5XG4gICAqL1xuICBxdWVyeUNvbXBvbmVudHMoQ29tcG9uZW50cykge1xuICAgIHJldHVybiB0aGlzLl9xdWVyeU1hbmFnZXIuZ2V0UXVlcnkoQ29tcG9uZW50cyk7XG4gIH1cblxuICAvLyBFWFRSQVNcblxuICAvKipcbiAgICogUmV0dXJuIG51bWJlciBvZiBlbnRpdGllc1xuICAgKi9cbiAgY291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2VudGl0aWVzLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc29tZSBzdGF0c1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge1xuICAgICAgbnVtRW50aXRpZXM6IHRoaXMuX2VudGl0aWVzLmxlbmd0aCxcbiAgICAgIG51bVF1ZXJpZXM6IE9iamVjdC5rZXlzKHRoaXMuX3F1ZXJ5TWFuYWdlci5fcXVlcmllcykubGVuZ3RoLFxuICAgICAgcXVlcmllczogdGhpcy5fcXVlcnlNYW5hZ2VyLnN0YXRzKCksXG4gICAgICBudW1Db21wb25lbnRQb29sOiBPYmplY3Qua2V5cyh0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLl9jb21wb25lbnRQb29sKVxuICAgICAgICAubGVuZ3RoLFxuICAgICAgY29tcG9uZW50UG9vbDoge30sXG4gICAgICBldmVudERpc3BhdGNoZXI6IHRoaXMuZXZlbnREaXNwYXRjaGVyLnN0YXRzXG4gICAgfTtcblxuICAgIGZvciAodmFyIGNuYW1lIGluIHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2wpIHtcbiAgICAgIHZhciBwb29sID0gdGhpcy5jb21wb25lbnRzTWFuYWdlci5fY29tcG9uZW50UG9vbFtjbmFtZV07XG4gICAgICBzdGF0cy5jb21wb25lbnRQb29sW2NuYW1lXSA9IHtcbiAgICAgICAgdXNlZDogcG9vbC50b3RhbFVzZWQoKSxcbiAgICAgICAgc2l6ZTogcG9vbC5jb3VudFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cblxuY29uc3QgRU5USVRZX0NSRUFURUQgPSBcIkVudGl0eU1hbmFnZXIjRU5USVRZX0NSRUFURVwiO1xuY29uc3QgRU5USVRZX1JFTU9WRUQgPSBcIkVudGl0eU1hbmFnZXIjRU5USVRZX1JFTU9WRURcIjtcbmNvbnN0IENPTVBPTkVOVF9BRERFRCA9IFwiRW50aXR5TWFuYWdlciNDT01QT05FTlRfQURERURcIjtcbmNvbnN0IENPTVBPTkVOVF9SRU1PVkUgPSBcIkVudGl0eU1hbmFnZXIjQ09NUE9ORU5UX1JFTU9WRVwiO1xuIiwiLyoqXG4gKiBAY2xhc3MgRHVtbXlPYmplY3RQb29sXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIER1bW15T2JqZWN0UG9vbCB7XG4gIGNvbnN0cnVjdG9yKFQpIHtcbiAgICB0aGlzLmNvdW50ID0gMDtcbiAgICB0aGlzLnVzZWQgPSAwO1xuICAgIHRoaXMuVCA9IFQ7XG4gIH1cblxuICBhcXVpcmUoKSB7XG4gICAgdGhpcy51c2VkKys7XG4gICAgdGhpcy5jb3VudCsrO1xuICAgIHJldHVybiBuZXcgdGhpcy5UKCk7XG4gIH1cblxuICByZWxlYXNlKCkge1xuICAgIHRoaXMudXNlZC0tO1xuICB9XG5cbiAgdG90YWxTaXplKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50O1xuICB9XG5cbiAgdG90YWxGcmVlKCkge1xuICAgIHJldHVybiBJbmZpbml0eTtcbiAgfVxuXG4gIHRvdGFsVXNlZCgpIHtcbiAgICByZXR1cm4gdGhpcy51c2VkO1xuICB9XG59XG4iLCJleHBvcnQgY2xhc3MgVGFnQ29tcG9uZW50IHt9XG4iLCJpbXBvcnQgT2JqZWN0UG9vbCBmcm9tIFwiLi9PYmplY3RQb29sLmpzXCI7XG5pbXBvcnQgRHVtbXlPYmplY3RQb29sIGZyb20gXCIuL0R1bW15T2JqZWN0UG9vbC5qc1wiO1xuaW1wb3J0IHsgY29tcG9uZW50UHJvcGVydHlOYW1lIH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcbmltcG9ydCB7IFRhZ0NvbXBvbmVudCB9IGZyb20gXCIuL1RhZ0NvbXBvbmVudC5qc1wiO1xuXG4vKipcbiAqIEBjbGFzcyBDb21wb25lbnRNYW5hZ2VyXG4gKi9cbmV4cG9ydCBjbGFzcyBDb21wb25lbnRNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5Db21wb25lbnRzID0ge307XG4gICAgdGhpcy5TaW5nbGV0b25Db21wb25lbnRzID0ge307XG4gICAgdGhpcy5fY29tcG9uZW50UG9vbCA9IHt9O1xuICAgIHRoaXMubnVtQ29tcG9uZW50cyA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlZ2lzdGVyXG4gICAqL1xuICByZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB0aGlzLkNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gQ29tcG9uZW50O1xuICAgIHRoaXMubnVtQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgc2luZ2xldG9uIGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZWdpc3RlciBhcyBzaW5nbGV0b25cbiAgICovXG4gIHJlZ2lzdGVyU2luZ2xldG9uQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuU2luZ2xldG9uQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBDb21wb25lbnQ7XG4gIH1cblxuICBjb21wb25lbnRBZGRlZFRvRW50aXR5KENvbXBvbmVudCkge1xuICAgIGlmICghdGhpcy5udW1Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSkge1xuICAgICAgdGhpcy5udW1Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubnVtQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0rKztcbiAgICB9XG4gIH1cblxuICBjb21wb25lbnRSZW1vdmVkRnJvbUVudGl0eShDb21wb25lbnQpIHtcbiAgICB0aGlzLm51bUNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdLS07XG4gIH1cblxuICAvKipcbiAgICogR2V0IGNvbXBvbmVudHMgcG9vbFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IFR5cGUgb2YgY29tcG9uZW50IHR5cGUgZm9yIHRoZSBwb29sXG4gICAqL1xuICBnZXRDb21wb25lbnRzUG9vbChDb21wb25lbnQpIHtcbiAgICB2YXIgY29tcG9uZW50TmFtZSA9IGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpO1xuXG4gICAgaWYgKCF0aGlzLl9jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdKSB7XG4gICAgICBpZiAoXG4gICAgICAgIENvbXBvbmVudC5wcm90b3R5cGUucmVzZXQgfHxcbiAgICAgICAgQ29tcG9uZW50LnByb3RvdHlwZSBpbnN0YW5jZW9mIFRhZ0NvbXBvbmVudFxuICAgICAgKSB7XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0gPSBuZXcgT2JqZWN0UG9vbChDb21wb25lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBDb21wb25lbnQgJyR7XG4gICAgICAgICAgICBDb21wb25lbnQubmFtZVxuICAgICAgICAgIH0nIHdvbid0IGJlbmVmaXQgZnJvbSBwb29saW5nIGJlY2F1c2UgJ3Jlc2V0JyBtZXRob2Qgd2FzIG5vdCBpbXBsZW1lbmV0ZWQuYFxuICAgICAgICApO1xuICAgICAgICB0aGlzLl9jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdID0gbmV3IER1bW15T2JqZWN0UG9vbChDb21wb25lbnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdO1xuICB9XG59XG4iLCJpbXBvcnQgeyBTeXN0ZW1NYW5hZ2VyIH0gZnJvbSBcIi4vU3lzdGVtTWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgRW50aXR5TWFuYWdlciB9IGZyb20gXCIuL0VudGl0eU1hbmFnZXIuanNcIjtcbmltcG9ydCB7IENvbXBvbmVudE1hbmFnZXIgfSBmcm9tIFwiLi9Db21wb25lbnRNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBjb21wb25lbnRQcm9wZXJ0eU5hbWUgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcblxuLyoqXG4gKiBAY2xhc3MgV29ybGRcbiAqL1xuZXhwb3J0IGNsYXNzIFdvcmxkIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlciA9IG5ldyBDb21wb25lbnRNYW5hZ2VyKHRoaXMpO1xuICAgIHRoaXMuZW50aXR5TWFuYWdlciA9IG5ldyBFbnRpdHlNYW5hZ2VyKHRoaXMpO1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlciA9IG5ldyBTeXN0ZW1NYW5hZ2VyKHRoaXMpO1xuXG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcblxuICAgIC8vIFN0b3JhZ2UgZm9yIHNpbmdsZXRvbiBjb21wb25lbnRzXG4gICAgdGhpcy5jb21wb25lbnRzID0ge307XG5cbiAgICB0aGlzLmV2ZW50UXVldWVzID0ge307XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG5cbiAgICBpZiAodHlwZW9mIEN1c3RvbUV2ZW50ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICB2YXIgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoXCJlY3N5LXdvcmxkLWNyZWF0ZWRcIiwgeyBkZXRhaWw6IHRoaXMgfSk7XG4gICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChldmVudCk7XG4gICAgfVxuICB9XG5cbiAgZW1pdEV2ZW50KGV2ZW50TmFtZSwgZGF0YSkge1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoZXZlbnROYW1lLCBkYXRhKTtcbiAgfVxuXG4gIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBjYWxsYmFjayk7XG4gIH1cblxuICByZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgc2luZ2xldG9uIGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IFNpbmdsZXRvbiBjb21wb25lbnRcbiAgICovXG4gIHJlZ2lzdGVyU2luZ2xldG9uQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIucmVnaXN0ZXJTaW5nbGV0b25Db21wb25lbnQoQ29tcG9uZW50KTtcbiAgICB0aGlzLmNvbXBvbmVudHNbY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCldID0gbmV3IENvbXBvbmVudCgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRcbiAgICovXG4gIHJlZ2lzdGVyQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIucmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIHN5c3RlbVxuICAgKiBAcGFyYW0ge1N5c3RlbX0gU3lzdGVtXG4gICAqL1xuICByZWdpc3RlclN5c3RlbShTeXN0ZW0sIGF0dHJpYnV0ZXMpIHtcbiAgICB0aGlzLnN5c3RlbU1hbmFnZXIucmVnaXN0ZXJTeXN0ZW0oU3lzdGVtLCBhdHRyaWJ1dGVzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhlIHN5c3RlbXMgcGVyIGZyYW1lXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBkZWx0YSBEZWx0YSB0aW1lIHNpbmNlIHRoZSBsYXN0IGNhbGxcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHRpbWUgRWxhcHNlZCB0aW1lXG4gICAqL1xuICBleGVjdXRlKGRlbHRhLCB0aW1lKSB7XG4gICAgaWYgKHRoaXMuZW5hYmxlZCkge1xuICAgICAgdGhpcy5zeXN0ZW1NYW5hZ2VyLmV4ZWN1dGUoZGVsdGEsIHRpbWUpO1xuICAgICAgdGhpcy5lbnRpdHlNYW5hZ2VyLnByb2Nlc3NEZWZlcnJlZFJlbW92YWwoKTtcbiAgICB9XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICB9XG5cbiAgcGxheSgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBlbnRpdHlcbiAgICovXG4gIGNyZWF0ZUVudGl0eSgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRpdHlNYW5hZ2VyLmNyZWF0ZUVudGl0eSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBzb21lIHN0YXRzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBlbnRpdGllczogdGhpcy5lbnRpdHlNYW5hZ2VyLnN0YXRzKCksXG4gICAgICBzeXN0ZW06IHRoaXMuc3lzdGVtTWFuYWdlci5zdGF0cygpXG4gICAgfTtcblxuICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHN0YXRzLCBudWxsLCAyKSk7XG4gIH1cbn1cbiIsIi8qKlxuICogQGNsYXNzIFN5c3RlbVxuICovXG5pbXBvcnQgUXVlcnkgZnJvbSBcIi4vUXVlcnkuanNcIjtcblxuZXhwb3J0IGNsYXNzIFN5c3RlbSB7XG4gIHRvSlNPTigpIHtcbiAgICB2YXIganNvbiA9IHtcbiAgICAgIG5hbWU6IHRoaXMuY29uc3RydWN0b3IubmFtZSxcbiAgICAgIGVuYWJsZWQ6IHRoaXMuZW5hYmxlZCxcbiAgICAgIGV4ZWN1dGVUaW1lOiB0aGlzLmV4ZWN1dGVUaW1lLFxuICAgICAgcHJpb3JpdHk6IHRoaXMucHJpb3JpdHksXG4gICAgICBxdWVyaWVzOiB7fSxcbiAgICAgIGV2ZW50czoge31cbiAgICB9O1xuXG4gICAgaWYgKHRoaXMuY29uZmlnKSB7XG4gICAgICB2YXIgcXVlcmllcyA9IHRoaXMuY29uZmlnLnF1ZXJpZXM7XG4gICAgICBmb3IgKGxldCBxdWVyeU5hbWUgaW4gcXVlcmllcykge1xuICAgICAgICBsZXQgcXVlcnkgPSBxdWVyaWVzW3F1ZXJ5TmFtZV07XG4gICAgICAgIGpzb24ucXVlcmllc1txdWVyeU5hbWVdID0ge1xuICAgICAgICAgIGtleTogdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdLmtleVxuICAgICAgICB9O1xuICAgICAgICBpZiAocXVlcnkuZXZlbnRzKSB7XG4gICAgICAgICAgbGV0IGV2ZW50cyA9IChqc29uLnF1ZXJpZXNbcXVlcnlOYW1lXVtcImV2ZW50c1wiXSA9IHt9KTtcbiAgICAgICAgICBmb3IgKGxldCBldmVudE5hbWUgaW4gcXVlcnkuZXZlbnRzKSB7XG4gICAgICAgICAgICBsZXQgZXZlbnQgPSBxdWVyeS5ldmVudHNbZXZlbnROYW1lXTtcbiAgICAgICAgICAgIGV2ZW50c1tldmVudE5hbWVdID0ge1xuICAgICAgICAgICAgICBldmVudE5hbWU6IGV2ZW50LmV2ZW50LFxuICAgICAgICAgICAgICBudW1FbnRpdGllczogdGhpcy5ldmVudHNbcXVlcnlOYW1lXVtldmVudE5hbWVdLmxlbmd0aFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChldmVudC5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgIGV2ZW50c1tldmVudE5hbWVdLmNvbXBvbmVudHMgPSBldmVudC5jb21wb25lbnRzLm1hcChjID0+IGMubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxldCBldmVudHMgPSB0aGlzLmNvbmZpZy5ldmVudHM7XG4gICAgICBmb3IgKGxldCBldmVudE5hbWUgaW4gZXZlbnRzKSB7XG4gICAgICAgIGpzb24uZXZlbnRzW2V2ZW50TmFtZV0gPSB7XG4gICAgICAgICAgZXZlbnROYW1lOiBldmVudHNbZXZlbnROYW1lXVxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBqc29uO1xuICB9XG5cbiAgY29uc3RydWN0b3Iod29ybGQsIGF0dHJpYnV0ZXMpIHtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcblxuICAgIC8vIEB0b2RvIEJldHRlciBuYW1pbmcgOilcbiAgICB0aGlzLl9xdWVyaWVzID0ge307XG4gICAgdGhpcy5xdWVyaWVzID0ge307XG5cbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICB0aGlzLmV2ZW50cyA9IHt9O1xuXG4gICAgdGhpcy5wcmlvcml0eSA9IDA7XG5cbiAgICAvLyBVc2VkIGZvciBzdGF0c1xuICAgIHRoaXMuZXhlY3V0ZVRpbWUgPSAwO1xuXG4gICAgaWYgKGF0dHJpYnV0ZXMgJiYgYXR0cmlidXRlcy5wcmlvcml0eSkge1xuICAgICAgdGhpcy5wcmlvcml0eSA9IGF0dHJpYnV0ZXMucHJpb3JpdHk7XG4gICAgfVxuXG4gICAgdGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG5cbiAgICB0aGlzLmNvbmZpZyA9IHRoaXMuaW5pdCA/IHRoaXMuaW5pdCgpIDogbnVsbDtcblxuICAgIGlmICghdGhpcy5jb25maWcpIHJldHVybjtcbiAgICBpZiAodGhpcy5jb25maWcucXVlcmllcykge1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLmNvbmZpZy5xdWVyaWVzKSB7XG4gICAgICAgIHZhciBxdWVyeUNvbmZpZyA9IHRoaXMuY29uZmlnLnF1ZXJpZXNbbmFtZV07XG4gICAgICAgIHZhciBDb21wb25lbnRzID0gcXVlcnlDb25maWcuY29tcG9uZW50cztcbiAgICAgICAgaWYgKCFDb21wb25lbnRzIHx8IENvbXBvbmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiJ2NvbXBvbmVudHMnIGF0dHJpYnV0ZSBjYW4ndCBiZSBlbXB0eSBpbiBhIHF1ZXJ5XCIpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBxdWVyeSA9IHRoaXMud29ybGQuZW50aXR5TWFuYWdlci5xdWVyeUNvbXBvbmVudHMoQ29tcG9uZW50cyk7XG4gICAgICAgIHRoaXMuX3F1ZXJpZXNbbmFtZV0gPSBxdWVyeTtcbiAgICAgICAgdGhpcy5xdWVyaWVzW25hbWVdID0gcXVlcnkuZW50aXRpZXM7XG5cbiAgICAgICAgaWYgKHF1ZXJ5Q29uZmlnLmV2ZW50cykge1xuICAgICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0ge307XG4gICAgICAgICAgbGV0IGV2ZW50cyA9IHRoaXMuZXZlbnRzW25hbWVdO1xuICAgICAgICAgIGZvciAobGV0IGV2ZW50TmFtZSBpbiBxdWVyeUNvbmZpZy5ldmVudHMpIHtcbiAgICAgICAgICAgIGxldCBldmVudCA9IHF1ZXJ5Q29uZmlnLmV2ZW50c1tldmVudE5hbWVdO1xuICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0gPSBbXTtcblxuICAgICAgICAgICAgY29uc3QgZXZlbnRNYXBwaW5nID0ge1xuICAgICAgICAgICAgICBFbnRpdHlBZGRlZDogUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCxcbiAgICAgICAgICAgICAgRW50aXR5UmVtb3ZlZDogUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICAgICAgICBFbnRpdHlDaGFuZ2VkOiBRdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQgLy8gUXVlcnkucHJvdG90eXBlLkVOVElUWV9DSEFOR0VEXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoZXZlbnRNYXBwaW5nW2V2ZW50LmV2ZW50XSkge1xuICAgICAgICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICBldmVudE1hcHBpbmdbZXZlbnQuZXZlbnRdLFxuICAgICAgICAgICAgICAgIGVudGl0eSA9PiB7XG4gICAgICAgICAgICAgICAgICAvLyBAZml4bWUgQSBsb3Qgb2Ygb3ZlcmhlYWQ/XG4gICAgICAgICAgICAgICAgICBpZiAoZXZlbnRzW2V2ZW50TmFtZV0uaW5kZXhPZihlbnRpdHkpID09PSAtMSlcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0ucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgaWYgKGV2ZW50LmV2ZW50ID09PSBcIkVudGl0eUNoYW5nZWRcIikge1xuICAgICAgICAgICAgICAgIHF1ZXJ5LnJlYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5ldmVudCA9PT0gXCJDb21wb25lbnRDaGFuZ2VkXCIpIHtcbiAgICAgICAgICAgICAgcXVlcnkucmVhY3RpdmUgPSB0cnVlO1xuICAgICAgICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICBRdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQsXG4gICAgICAgICAgICAgICAgKGVudGl0eSwgY29tcG9uZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICBpZiAoZXZlbnQuY29tcG9uZW50cy5pbmRleE9mKGNvbXBvbmVudC5jb25zdHJ1Y3RvcikgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50c1tldmVudE5hbWVdLnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY29uZmlnLmV2ZW50cykge1xuICAgICAgZm9yIChsZXQgbmFtZSBpbiB0aGlzLmNvbmZpZy5ldmVudHMpIHtcbiAgICAgICAgdmFyIGV2ZW50ID0gdGhpcy5jb25maWcuZXZlbnRzW25hbWVdO1xuICAgICAgICB0aGlzLmV2ZW50c1tuYW1lXSA9IFtdO1xuICAgICAgICB0aGlzLndvcmxkLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGRhdGEgPT4ge1xuICAgICAgICAgIHRoaXMuZXZlbnRzW25hbWVdLnB1c2goZGF0YSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHN0b3AoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG4gIH1cblxuICBwbGF5KCkge1xuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG4gIH1cblxuICBjbGVhckV2ZW50cygpIHtcbiAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuZXZlbnRzKSB7XG4gICAgICB2YXIgZXZlbnQgPSB0aGlzLmV2ZW50c1tuYW1lXTtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGV2ZW50KSkge1xuICAgICAgICB0aGlzLmV2ZW50c1tuYW1lXS5sZW5ndGggPSAwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChuYW1lIGluIGV2ZW50KSB7XG4gICAgICAgICAgZXZlbnRbbmFtZV0ubGVuZ3RoID0gMDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gTm90KENvbXBvbmVudCkge1xuICByZXR1cm4ge1xuICAgIG9wZXJhdG9yOiBcIm5vdFwiLFxuICAgIENvbXBvbmVudDogQ29tcG9uZW50XG4gIH07XG59XG4iLCJjbGFzcyBGbG9hdFZhbGlkYXRvciB7XG4gIHN0YXRpYyB2YWxpZGF0ZShuKSB7XG4gICAgcmV0dXJuIE51bWJlcihuKSA9PT0gbiAmJiBuICUgMSAhPT0gMDtcbiAgfVxufVxuXG52YXIgU2NoZW1hVHlwZXMgPSB7XG4gIGZsb2F0OiBGbG9hdFZhbGlkYXRvclxuICAvKlxuICBhcnJheVxuICBib29sXG4gIGZ1bmNcbiAgbnVtYmVyXG4gIG9iamVjdFxuICBzdHJpbmdcbiAgc3ltYm9sXG5cbiAgYW55XG4gIGFycmF5T2ZcbiAgZWxlbWVudFxuICBlbGVtZW50VHlwZVxuICBpbnN0YW5jZU9mXG4gIG5vZGVcbiAgb2JqZWN0T2ZcbiAgb25lT2ZcbiAgb25lT2ZUeXBlXG4gIHNoYXBlXG4gIGV4YWN0XG4qL1xufTtcblxuZXhwb3J0IHsgU2NoZW1hVHlwZXMgfTtcbiIsImV4cG9ydCBjbGFzcyBDb21wb25lbnQge31cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FBR0EsQUFBTyxNQUFNLGFBQWEsQ0FBQztFQUN6QixXQUFXLENBQUMsS0FBSyxFQUFFO0lBQ2pCLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO0lBQ2xCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0dBQ3BCOzs7Ozs7RUFNRCxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRTtJQUNqQyxJQUFJLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2hELE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDbkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUIsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ25CLE9BQU8sSUFBSSxDQUFDO0dBQ2I7O0VBRUQsV0FBVyxHQUFHO0lBQ1osSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLO01BQzFCLE9BQU8sQ0FBQyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztLQUNyRCxDQUFDLENBQUM7R0FDSjs7Ozs7O0VBTUQsWUFBWSxDQUFDLE1BQU0sRUFBRTtJQUNuQixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN6QyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsT0FBTzs7SUFFcEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO0dBQy9COzs7Ozs7O0VBT0Qs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
