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
      return b.priority - a.priority || a.order - b.order;
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

  match(entity) {
    var result = true;

    for (let i = 0; i < this.Components.length; i++) {
      result = result && !!~entity._ComponentTypes.indexOf(this.Components[i]);
    }

    // Not components
    for (let i = 0; i < this.NotComponents.length; i++) {
      result =
        result && !~entity._ComponentTypes.indexOf(this.NotComponents[i]);
    }

    return result;
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
   */
  hasComponent(Component) {
    return !!~this._ComponentTypes.indexOf(Component);
  }

  /**
   * Check if the entity has a list of components
   * @param {Array(Component)} Components to check
   */
  hasAllComponents(Components) {
    var result = true;

    for (var i = 0; i < Components.length; i++) {
      result = result && !!~this._ComponentTypes.indexOf(Components[i]);
    }

    return result;
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
  __init() {
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
  constructor(T) {
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

    this.initialObject = this.createElement();
  }

  aquire() {
    // Grow the list by 20%ish if we're out
    if (this.freeList.length <= 0) {
      this.expand(Math.round(this.count * 0.2) + 1);
    }

    var item = this.freeList.pop();

    // We can provide explicit initing, otherwise we copy the value of the initial component
    if (item.__init) item.__init();
    else if (item.copy) item.copy(this.initialObject);
    else {
      for (let name in item) {
        delete item[name];
      }
      for (let name in this.initialObject) {
        item[name] = this.initialObject[name];
      }
    }

    return item;
  }

  release(item) {
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
        !~query.entities.indexOf(entity)
      ) {
        query.addEntity(entity);
        continue;
      }

      if (!~query.Components.indexOf(Component)) continue;
      if (!query.match(entity)) continue;

      query.removeEntity(entity);
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

    // Check each indexed query to see if we need to remove it
    this._queryManager.onEntityComponentRemoved(entity, Component);

    if (forceRemove) {
      this._entityRemoveComponentSync(entity, Component, index);
    } else {
      if (entity.componentsToRemove.length === 0)
        this.entitiesWithComponentsToRemove.push(entity);
      entity.componentsToRemove.push(Component);
    }
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
      this._componentPool[componentName] = new ObjectPool(Component);
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

export { Not, SchemaTypes, System, World };
