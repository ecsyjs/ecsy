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
        if (system.execute && system.meetDependencies()) {
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
    return  component;
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
   * Remove the entity from this manager. It will clear also its components
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
      if (Component.prototype.reset) {
        this._componentPool[componentName] = new ObjectPool(Component);
      } else {
        console.warn(
          `Component '${Component.name}' won't benefit from pooling because 'reset' method was not implemeneted.`
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

    var dependencies = this.config.dependencies;
    if (dependencies) {
      this.dependenciesToCheck = {};

      if (dependencies.singleton) {
        this.dependenciesToCheck.singleton = dependencies.singleton.slice();
      }

      if (dependencies.system) {
        this.dependenciesToCheck.system = dependencies.system.slice();
      }
    }
  }

  meetDependencies() {
    if (!this.dependenciesToCheck) return true;

    var success = true;

    // Singleton
    if (
      this.dependenciesToCheck.singleton &&
      this.dependenciesToCheck.singleton.length > 0
    ) {
      this.dependenciesToCheck.singleton = this.dependenciesToCheck.singleton.filter(
        d => {
          for (let id in this.world.components) {
            if (this.world.components[id] instanceof d) {
              return false;
            }
          }
          return true;
        }
      );
      success &= this.dependenciesToCheck.singleton.length === 0;
    }

    // System
    if (
      this.dependenciesToCheck.system &&
      this.dependenciesToCheck.system.length > 0
    ) {
      this.dependenciesToCheck.system = this.dependenciesToCheck.system.filter(
        d => {
          for (let i = 0; i < this.world.systemManager.systems.length; i++) {
            if (this.world.systemManager.systems[i] instanceof d) {
              return false;
            }
          }
          return true;
        }
      );
      success &= this.dependenciesToCheck.system.length === 0;
    }

    return success;
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

class Component {}

class TagComponent {
  reset() {}
}

function createType(typeDefinition) {
  var mandatoryFunctions = [
    "create",
    "reset",
    "clear"
    /*"copy"*/
  ];

  var undefinedFunctions = mandatoryFunctions.filter(f => {
    return !typeDefinition[f];
  });

  if (undefinedFunctions.length > 0) {
    throw new Error(
      `createType expect type definition to implements the following functions: ${undefinedFunctions.join(
        ", "
      )}`
    );
  }

  typeDefinition.isType = true;
  return typeDefinition;
}

var Types = {};

Types.Number = createType({
  baseType: Number,
  isSimpleType: true,
  create: defaultValue => {
    return typeof defaultValue !== "undefined" ? defaultValue : 0;
  },
  reset: (src, key, defaultValue) => {
    if (typeof defaultValue !== "undefined") {
      src[key] = defaultValue;
    } else {
      src[key] = 0;
    }
  },
  clear: (src, key) => {
    src[key] = 0;
  }
});

Types.Boolean = createType({
  baseType: Boolean,
  isSimpleType: true,
  create: defaultValue => {
    return typeof defaultValue !== "undefined" ? defaultValue : false;
  },
  reset: (src, key, defaultValue) => {
    if (typeof defaultValue !== "undefined") {
      src[key] = defaultValue;
    } else {
      src[key] = false;
    }
  },
  clear: (src, key) => {
    src[key] = false;
  }
});

Types.String = createType({
  baseType: String,
  isSimpleType: true,
  create: defaultValue => {
    return typeof defaultValue !== "undefined" ? defaultValue : "";
  },
  reset: (src, key, defaultValue) => {
    if (typeof defaultValue !== "undefined") {
      src[key] = defaultValue;
    } else {
      src[key] = "";
    }
  },
  clear: (src, key) => {
    src[key] = "";
  }
});

Types.Array = createType({
  baseType: Array,
  create: defaultValue => {
    if (typeof defaultValue !== "undefined") {
      return defaultValue.slice();
    }

    return [];
  },
  reset: (src, key, defaultValue) => {
    if (typeof defaultValue !== "undefined") {
      src[key] = defaultValue.slice();
    } else {
      src[key].length = 0;
    }
  },
  clear: (src, key) => {
    src[key].length = 0;
  },
  copy: (src, dst, key) => {
    src[key] = dst[key].slice();
  }
});

/**
 * Try to infer the type of the value
 * @param {*} value
 * @return {String} Type of the attribute
 */
var standardTypes = {
  number: Types.Number,
  boolean: Types.Boolean,
  string: Types.String
};

function inferType(value) {
  if (Array.isArray(value)) {
    return Types.Array;
  }

  if (standardTypes[typeof value]) {
    return standardTypes[typeof value];
  } else {
    return null;
  }
}

function createComponent(schema, name) {
  //var Component = new Function(`return function ${name}() {}`)();
  for (let key in schema) {
    let type = schema[key].type;
    if (!type) {
      schema[key].type = inferType(schema[key].default);
    }
  }

  var Component = function() {
    for (let key in schema) {
      var attr = schema[key];
      let type = attr.type;
      if (type && type.isType) {
        this[key] = type.create(attr.default);
      } else {
        this[key] = attr.default;
      }
    }
  };

  if (typeof name !== "undefined") {
    Object.defineProperty(Component, "name", { value: name });
  }

  Component.prototype.schema = schema;

  var knownTypes = true;
  for (let key in schema) {
    var attr = schema[key];
    if (!attr.type) {
      attr.type = inferType(attr.default);
    }

    var type = attr.type;
    if (!type) {
      console.warn(`Unknown type definition for attribute '${key}'`);
      knownTypes = false;
    }
  }

  if (!knownTypes) {
    console.warn(
      `This component can't use pooling because some data types are not registered. Please provide a type created with 'createType'`
    );

    for (var key in schema) {
      let attr = schema[key];
      Component.prototype[key] = attr.default;
    }

    var nopFunctions = ["copy", "reset", "clear"];

    nopFunctions.forEach(fun => {
      Component.prototype[fun] = () => {
        console.warn(
          `'${fun}' function is a nop for this component as the type definition of some attributes on the schema are unknown.`
        );
      };
    });
  } else {
    Component.prototype.copy = function(src) {
      for (let key in schema) {
        let type = schema[key].type;
        if (type.isSimpleType) {
          this[key] = src[key];
        } else if (type.copy) {
          type.copy(this, src, key);
        } else {
          // @todo Detect that it's not possible to copy all the attributes
          // and just avoid creating the copy function
          console.warn(
            `Unknown copy function for attribute '${key}' data type`
          );
        }
      }
    };

    Component.prototype.reset = function() {
      for (let key in schema) {
        let attr = schema[key];
        let type = attr.type;
        if (type.reset) type.reset(this, key, attr.default);
      }
    };

    Component.prototype.clear = function() {
      for (let key in schema) {
        let type = schema[key].type;
        if (type.clear) type.clear(this, key);
      }
    };

    for (let key in schema) {
      let attr = schema[key];
      let type = attr.type;
      Component.prototype[key] = attr.default;

      if (type.reset) {
        type.reset(Component.prototype, key, attr.default);
      }
    }
  }

  return Component;
}

export { Component, Not, System, TagComponent, Types, World, createComponent, createType };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9TeXN0ZW1NYW5hZ2VyLmpzIiwiLi4vc3JjL0V2ZW50RGlzcGF0Y2hlci5qcyIsIi4uL3NyYy9VdGlscy5qcyIsIi4uL3NyYy9RdWVyeS5qcyIsIi4uL3NyYy9FbnRpdHkuanMiLCIuLi9zcmMvT2JqZWN0UG9vbC5qcyIsIi4uL3NyYy9RdWVyeU1hbmFnZXIuanMiLCIuLi9zcmMvRW50aXR5TWFuYWdlci5qcyIsIi4uL3NyYy9EdW1teU9iamVjdFBvb2wuanMiLCIuLi9zcmMvQ29tcG9uZW50TWFuYWdlci5qcyIsIi4uL3NyYy9Xb3JsZC5qcyIsIi4uL3NyYy9TeXN0ZW0uanMiLCIuLi9zcmMvQ29tcG9uZW50LmpzIiwiLi4vc3JjL1RhZ0NvbXBvbmVudC5qcyIsIi4uL3NyYy9DcmVhdGVUeXBlLmpzIiwiLi4vc3JjL1N0YW5kYXJkVHlwZXMuanMiLCIuLi9zcmMvSW5mZXJUeXBlLmpzIiwiLi4vc3JjL0NyZWF0ZUNvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBjbGFzcyBTeXN0ZW1NYW5hZ2VyXG4gKi9cbmV4cG9ydCBjbGFzcyBTeXN0ZW1NYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLnN5c3RlbXMgPSBbXTtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzeXN0ZW1cbiAgICogQHBhcmFtIHtTeXN0ZW19IFN5c3RlbSBTeXN0ZW0gdG8gcmVnaXN0ZXJcbiAgICovXG4gIHJlZ2lzdGVyU3lzdGVtKFN5c3RlbSwgYXR0cmlidXRlcykge1xuICAgIHZhciBzeXN0ZW0gPSBuZXcgU3lzdGVtKHRoaXMud29ybGQsIGF0dHJpYnV0ZXMpO1xuICAgIHN5c3RlbS5vcmRlciA9IHRoaXMuc3lzdGVtcy5sZW5ndGg7XG4gICAgdGhpcy5zeXN0ZW1zLnB1c2goc3lzdGVtKTtcbiAgICB0aGlzLnNvcnRTeXN0ZW1zKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzb3J0U3lzdGVtcygpIHtcbiAgICB0aGlzLnN5c3RlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgcmV0dXJuIGEucHJpb3JpdHkgLSBiLnByaW9yaXR5IHx8IGEub3JkZXIgLSBiLm9yZGVyO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIHN5c3RlbVxuICAgKiBAcGFyYW0ge1N5c3RlbX0gU3lzdGVtIFN5c3RlbSB0byByZW1vdmVcbiAgICovXG4gIHJlbW92ZVN5c3RlbShTeXN0ZW0pIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLnN5c3RlbXMuaW5kZXhPZihTeXN0ZW0pO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICB0aGlzLnN5c3RlbXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgYWxsIHRoZSBzeXN0ZW1zLiBDYWxsZWQgcGVyIGZyYW1lLlxuICAgKiBAcGFyYW0ge051bWJlcn0gZGVsdGEgRGVsdGEgdGltZSBzaW5jZSB0aGUgbGFzdCBmcmFtZVxuICAgKiBAcGFyYW0ge051bWJlcn0gdGltZSBFbGFwc2VkIHRpbWVcbiAgICovXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUpIHtcbiAgICB0aGlzLnN5c3RlbXMuZm9yRWFjaChzeXN0ZW0gPT4ge1xuICAgICAgaWYgKHN5c3RlbS5lbmFibGVkICYmIHN5c3RlbS5pbml0aWFsaXplZCkge1xuICAgICAgICBpZiAoc3lzdGVtLmV4ZWN1dGUgJiYgc3lzdGVtLm1lZXREZXBlbmRlbmNpZXMoKSkge1xuICAgICAgICAgIGxldCBzdGFydFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICBzeXN0ZW0uZXhlY3V0ZShkZWx0YSwgdGltZSk7XG4gICAgICAgICAgc3lzdGVtLmV4ZWN1dGVUaW1lID0gcGVyZm9ybWFuY2Uubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICAgIH1cbiAgICAgICAgc3lzdGVtLmNsZWFyRXZlbnRzKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHN0YXRzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBudW1TeXN0ZW1zOiB0aGlzLnN5c3RlbXMubGVuZ3RoLFxuICAgICAgc3lzdGVtczoge31cbiAgICB9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnN5c3RlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBzeXN0ZW0gPSB0aGlzLnN5c3RlbXNbaV07XG4gICAgICB2YXIgc3lzdGVtU3RhdHMgPSAoc3RhdHMuc3lzdGVtc1tzeXN0ZW0uY29uc3RydWN0b3IubmFtZV0gPSB7XG4gICAgICAgIHF1ZXJpZXM6IHt9XG4gICAgICB9KTtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gc3lzdGVtLmN0eCkge1xuICAgICAgICBzeXN0ZW1TdGF0cy5xdWVyaWVzW25hbWVdID0gc3lzdGVtLmN0eFtuYW1lXS5zdGF0cygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuIiwiLyoqXG4gKiBAY2xhc3MgRXZlbnREaXNwYXRjaGVyXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEV2ZW50RGlzcGF0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuX2xpc3RlbmVycyA9IHt9O1xuICAgIHRoaXMuc3RhdHMgPSB7XG4gICAgICBmaXJlZDogMCxcbiAgICAgIGhhbmRsZWQ6IDBcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhbiBldmVudCBsaXN0ZW5lclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGxpc3RlblxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayB0byB0cmlnZ2VyIHdoZW4gdGhlIGV2ZW50IGlzIGZpcmVkXG4gICAqL1xuICBhZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICBsZXQgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnROYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgIH1cblxuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnROYW1lXS5pbmRleE9mKGxpc3RlbmVyKSA9PT0gLTEpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudE5hbWVdLnB1c2gobGlzdGVuZXIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBhbiBldmVudCBsaXN0ZW5lciBpcyBhbHJlYWR5IGFkZGVkIHRvIHRoZSBsaXN0IG9mIGxpc3RlbmVyc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGNoZWNrXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50XG4gICAqL1xuICBoYXNFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihsaXN0ZW5lcikgIT09IC0xXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byByZW1vdmVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnRcbiAgICovXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIHZhciBsaXN0ZW5lckFycmF5ID0gdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV07XG4gICAgaWYgKGxpc3RlbmVyQXJyYXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGluZGV4ID0gbGlzdGVuZXJBcnJheS5pbmRleE9mKGxpc3RlbmVyKTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgbGlzdGVuZXJBcnJheS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNwYXRjaCBhbiBldmVudFxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGRpc3BhdGNoXG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgKE9wdGlvbmFsKSBFbnRpdHkgdG8gZW1pdFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XG4gICAqL1xuICBkaXNwYXRjaEV2ZW50KGV2ZW50TmFtZSwgZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkKys7XG5cbiAgICB2YXIgbGlzdGVuZXJBcnJheSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xuICAgIGlmIChsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBhcnJheSA9IGxpc3RlbmVyQXJyYXkuc2xpY2UoMCk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJyYXlbaV0uY2FsbCh0aGlzLCBlbnRpdHksIGNvbXBvbmVudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHN0YXRzIGNvdW50ZXJzXG4gICAqL1xuICByZXNldENvdW50ZXJzKCkge1xuICAgIHRoaXMuc3RhdHMuZmlyZWQgPSB0aGlzLnN0YXRzLmhhbmRsZWQgPSAwO1xuICB9XG59XG4iLCIvKipcbiAqIFJldHVybiB0aGUgbmFtZSBvZiBhIGNvbXBvbmVudFxuICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TmFtZShDb21wb25lbnQpIHtcbiAgcmV0dXJuIENvbXBvbmVudC5uYW1lO1xufVxuXG4vKipcbiAqIFJldHVybiBhIHZhbGlkIHByb3BlcnR5IG5hbWUgZm9yIHRoZSBDb21wb25lbnRcbiAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpIHtcbiAgdmFyIG5hbWUgPSBnZXROYW1lKENvbXBvbmVudCk7XG4gIHJldHVybiBuYW1lLmNoYXJBdCgwKS50b0xvd2VyQ2FzZSgpICsgbmFtZS5zbGljZSgxKTtcbn1cblxuLyoqXG4gKiBHZXQgYSBrZXkgZnJvbSBhIGxpc3Qgb2YgY29tcG9uZW50c1xuICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIEFycmF5IG9mIGNvbXBvbmVudHMgdG8gZ2VuZXJhdGUgdGhlIGtleVxuICovXG5leHBvcnQgZnVuY3Rpb24gcXVlcnlLZXkoQ29tcG9uZW50cykge1xuICB2YXIgbmFtZXMgPSBbXTtcbiAgZm9yICh2YXIgbiA9IDA7IG4gPCBDb21wb25lbnRzLmxlbmd0aDsgbisrKSB7XG4gICAgdmFyIFQgPSBDb21wb25lbnRzW25dO1xuICAgIGlmICh0eXBlb2YgVCA9PT0gXCJvYmplY3RcIikge1xuICAgICAgdmFyIG9wZXJhdG9yID0gVC5vcGVyYXRvciA9PT0gXCJub3RcIiA/IFwiIVwiIDogVC5vcGVyYXRvcjtcbiAgICAgIG5hbWVzLnB1c2gob3BlcmF0b3IgKyBnZXROYW1lKFQuQ29tcG9uZW50KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hbWVzLnB1c2goZ2V0TmFtZShUKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWVzXG4gICAgLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geC50b0xvd2VyQ2FzZSgpO1xuICAgIH0pXG4gICAgLnNvcnQoKVxuICAgIC5qb2luKFwiLVwiKTtcbn1cbiIsImltcG9ydCBFdmVudERpc3BhdGNoZXIgZnJvbSBcIi4vRXZlbnREaXNwYXRjaGVyLmpzXCI7XG5pbXBvcnQgeyBxdWVyeUtleSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIFF1ZXJ5XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFF1ZXJ5IHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBMaXN0IG9mIHR5cGVzIG9mIGNvbXBvbmVudHMgdG8gcXVlcnlcbiAgICovXG4gIGNvbnN0cnVjdG9yKENvbXBvbmVudHMsIG1hbmFnZXIpIHtcbiAgICB0aGlzLkNvbXBvbmVudHMgPSBbXTtcbiAgICB0aGlzLk5vdENvbXBvbmVudHMgPSBbXTtcblxuICAgIENvbXBvbmVudHMuZm9yRWFjaChjb21wb25lbnQgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBjb21wb25lbnQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgdGhpcy5Ob3RDb21wb25lbnRzLnB1c2goY29tcG9uZW50LkNvbXBvbmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLkNvbXBvbmVudHMucHVzaChjb21wb25lbnQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuQ29tcG9uZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGNyZWF0ZSBhIHF1ZXJ5IHdpdGhvdXQgY29tcG9uZW50c1wiKTtcbiAgICB9XG5cbiAgICB0aGlzLmVudGl0aWVzID0gW107XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG5cbiAgICAvLyBUaGlzIHF1ZXJ5IGlzIGJlaW5nIHVzZWQgYnkgYSByZWFjdGl2ZSBzeXN0ZW1cbiAgICB0aGlzLnJlYWN0aXZlID0gZmFsc2U7XG5cbiAgICB0aGlzLmtleSA9IHF1ZXJ5S2V5KENvbXBvbmVudHMpO1xuXG4gICAgLy8gRmlsbCB0aGUgcXVlcnkgd2l0aCB0aGUgZXhpc3RpbmcgZW50aXRpZXNcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hbmFnZXIuX2VudGl0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZW50aXR5ID0gbWFuYWdlci5fZW50aXRpZXNbaV07XG4gICAgICBpZiAodGhpcy5tYXRjaChlbnRpdHkpKSB7XG4gICAgICAgIC8vIEB0b2RvID8/PyB0aGlzLmFkZEVudGl0eShlbnRpdHkpOyA9PiBwcmV2ZW50aW5nIHRoZSBldmVudCB0byBiZSBnZW5lcmF0ZWRcbiAgICAgICAgZW50aXR5LnF1ZXJpZXMucHVzaCh0aGlzKTtcbiAgICAgICAgdGhpcy5lbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBlbnRpdHkgdG8gdGhpcyBxdWVyeVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5XG4gICAqL1xuICBhZGRFbnRpdHkoZW50aXR5KSB7XG4gICAgZW50aXR5LnF1ZXJpZXMucHVzaCh0aGlzKTtcbiAgICB0aGlzLmVudGl0aWVzLnB1c2goZW50aXR5KTtcblxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCwgZW50aXR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgZW50aXR5IGZyb20gdGhpcyBxdWVyeVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5XG4gICAqL1xuICByZW1vdmVFbnRpdHkoZW50aXR5KSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgaWYgKH5pbmRleCkge1xuICAgICAgdGhpcy5lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICBpbmRleCA9IGVudGl0eS5xdWVyaWVzLmluZGV4T2YodGhpcyk7XG4gICAgICBlbnRpdHkucXVlcmllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBRdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQsXG4gICAgICAgIGVudGl0eVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBtYXRjaChlbnRpdHksIGluY2x1ZGVSZW1vdmVkID0gZmFsc2UpIHtcbiAgICByZXR1cm4gKFxuICAgICAgZW50aXR5Lmhhc0FsbENvbXBvbmVudHModGhpcy5Db21wb25lbnRzLCBpbmNsdWRlUmVtb3ZlZCkgJiZcbiAgICAgICFlbnRpdHkuaGFzQW55Q29tcG9uZW50cyh0aGlzLk5vdENvbXBvbmVudHMsIGluY2x1ZGVSZW1vdmVkKVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHN0YXRzIGZvciB0aGlzIHF1ZXJ5XG4gICAqL1xuICBzdGF0cygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbnVtQ29tcG9uZW50czogdGhpcy5Db21wb25lbnRzLmxlbmd0aCxcbiAgICAgIG51bUVudGl0aWVzOiB0aGlzLmVudGl0aWVzLmxlbmd0aFxuICAgIH07XG4gIH1cbn1cblxuUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCA9IFwiUXVlcnkjRU5USVRZX0FEREVEXCI7XG5RdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQgPSBcIlF1ZXJ5I0VOVElUWV9SRU1PVkVEXCI7XG5RdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQgPSBcIlF1ZXJ5I0NPTVBPTkVOVF9DSEFOR0VEXCI7XG4iLCJpbXBvcnQgUXVlcnkgZnJvbSBcIi4vUXVlcnkuanNcIjtcbmltcG9ydCB3cmFwSW1tdXRhYmxlQ29tcG9uZW50IGZyb20gXCIuL1dyYXBJbW11dGFibGVDb21wb25lbnQuanNcIjtcblxuLy8gQHRvZG8gVGFrZSB0aGlzIG91dCBmcm9tIHRoZXJlIG9yIHVzZSBFTlZcbmNvbnN0IERFQlVHID0gZmFsc2U7XG5cbi8vIEB0b2RvIHJlc2V0IGl0IGJ5IHdvcmxkP1xudmFyIG5leHRJZCA9IDA7XG5cbi8qKlxuICogQGNsYXNzIEVudGl0eVxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFbnRpdHkge1xuICAvKipcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBjbGFzcyBFbnRpdHlcbiAgICogQHBhcmFtIHtXb3JsZH0gd29ybGRcbiAgICovXG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy5fd29ybGQgPSB3b3JsZCB8fCBudWxsO1xuXG4gICAgLy8gVW5pcXVlIElEIGZvciB0aGlzIGVudGl0eVxuICAgIHRoaXMuaWQgPSBuZXh0SWQrKztcblxuICAgIC8vIExpc3Qgb2YgY29tcG9uZW50cyB0eXBlcyB0aGUgZW50aXR5IGhhc1xuICAgIHRoaXMuX0NvbXBvbmVudFR5cGVzID0gW107XG5cbiAgICAvLyBJbnN0YW5jZSBvZiB0aGUgY29tcG9uZW50c1xuICAgIHRoaXMuX2NvbXBvbmVudHMgPSB7fTtcblxuICAgIC8vIFF1ZXJpZXMgd2hlcmUgdGhlIGVudGl0eSBpcyBhZGRlZFxuICAgIHRoaXMucXVlcmllcyA9IFtdO1xuXG4gICAgLy8gVXNlZCBmb3IgZGVmZXJyZWQgcmVtb3ZhbFxuICAgIHRoaXMuY29tcG9uZW50c1RvUmVtb3ZlID0gW107XG4gIH1cblxuICAvLyBDT01QT05FTlRTXG5cbiAgLyoqXG4gICAqIFJldHVybiBhbiBpbW11dGFibGUgcmVmZXJlbmNlIG9mIGEgY29tcG9uZW50XG4gICAqIE5vdGU6IEEgcHJveHkgd2lsbCBiZSB1c2VkIG9uIGRlYnVnIG1vZGUsIGFuZCBpdCB3aWxsIGp1c3QgYWZmZWN0XG4gICAqICAgICAgIHRoZSBmaXJzdCBsZXZlbCBhdHRyaWJ1dGVzIG9uIHRoZSBvYmplY3QsIGl0IHdvbid0IHdvcmsgcmVjdXJzaXZlbHkuXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBUeXBlIG9mIGNvbXBvbmVudCB0byBnZXRcbiAgICogQHJldHVybiB7Q29tcG9uZW50fSBJbW11dGFibGUgY29tcG9uZW50IHJlZmVyZW5jZVxuICAgKi9cbiAgZ2V0Q29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXTtcbiAgICByZXR1cm4gREVCVUcgPyB3cmFwSW1tdXRhYmxlQ29tcG9uZW50KENvbXBvbmVudCwgY29tcG9uZW50KSA6IGNvbXBvbmVudDtcbiAgfVxuXG4gIGdldENvbXBvbmVudHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudHM7XG4gIH1cblxuICBnZXRDb21wb25lbnRUeXBlcygpIHtcbiAgICByZXR1cm4gdGhpcy5fQ29tcG9uZW50VHlwZXM7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGEgbXV0YWJsZSByZWZlcmVuY2Ugb2YgYSBjb21wb25lbnQuXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBUeXBlIG9mIGNvbXBvbmVudCB0byBnZXRcbiAgICogQHJldHVybiB7Q29tcG9uZW50fSBNdXRhYmxlIGNvbXBvbmVudCByZWZlcmVuY2VcbiAgICovXG4gIGdldE11dGFibGVDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IHRoaXMuX2NvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5xdWVyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaV07XG4gICAgICBpZiAocXVlcnkucmVhY3RpdmUpIHtcbiAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoXG4gICAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgY29tcG9uZW50XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjb21wb25lbnQ7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgY29tcG9uZW50IHRvIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCB0byBhZGQgdG8gdGhpcyBlbnRpdHlcbiAgICogQHBhcmFtIHtPYmplY3R9IE9wdGlvbmFsIHZhbHVlcyB0byByZXBsYWNlIHRoZSBkZWZhdWx0IGF0dHJpYnV0ZXMgb24gdGhlIGNvbXBvbmVudFxuICAgKi9cbiAgYWRkQ29tcG9uZW50KENvbXBvbmVudCwgdmFsdWVzKSB7XG4gICAgdGhpcy5fd29ybGQuZW50aXR5QWRkQ29tcG9uZW50KHRoaXMsIENvbXBvbmVudCwgdmFsdWVzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBjb21wb25lbnQgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgdG8gcmVtb3ZlIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlQ29tcG9uZW50KENvbXBvbmVudCwgZm9yY2VSZW1vdmUpIHtcbiAgICB0aGlzLl93b3JsZC5lbnRpdHlSZW1vdmVDb21wb25lbnQodGhpcywgQ29tcG9uZW50LCBmb3JjZVJlbW92ZSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhlIGVudGl0eSBoYXMgYSBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCB0byBjaGVja1xuICAgKiBAcGFyYW0ge0Jvb2x9IGluY2x1ZGUgQ29tcG9uZW50cyBxdWV1ZWQgZm9yIHJlbW92YWwgKERlZmF1bHQgaXMgZmFsc2UpXG4gICAqL1xuICBoYXNDb21wb25lbnQoQ29tcG9uZW50LCBpbmNsdWRlUmVtb3ZlZCA9IGZhbHNlKSB7XG4gICAgcmV0dXJuIChcbiAgICAgICEhfnRoaXMuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgKGluY2x1ZGVSZW1vdmVkIHx8ICF+dGhpcy5jb21wb25lbnRzVG9SZW1vdmUuaW5kZXhPZihDb21wb25lbnQpKVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhlIGVudGl0eSBoYXMgYWxsIGNvbXBvbmVudHMgaW4gYSBsaXN0XG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyB0byBjaGVja1xuICAgKiBAcGFyYW0ge0Jvb2x9IGluY2x1ZGUgQ29tcG9uZW50cyBxdWV1ZWQgZm9yIHJlbW92YWwgKERlZmF1bHQgaXMgZmFsc2UpXG4gICAqL1xuICBoYXNBbGxDb21wb25lbnRzKENvbXBvbmVudHMsIGluY2x1ZGVSZW1vdmVkID0gZmFsc2UpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IENvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICghdGhpcy5oYXNDb21wb25lbnQoQ29tcG9uZW50c1tpXSwgaW5jbHVkZVJlbW92ZWQpKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGFueSBjb21wb25lbnRzIGluIGEgbGlzdFxuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgdG8gY2hlY2tcbiAgICogQHBhcmFtIHtCb29sfSBpbmNsdWRlIENvbXBvbmVudHMgcXVldWVkIGZvciByZW1vdmFsIChEZWZhdWx0IGlzIGZhbHNlKVxuICAgKi9cbiAgaGFzQW55Q29tcG9uZW50cyhDb21wb25lbnRzLCBpbmNsdWRlUmVtb3ZlZCA9IGZhbHNlKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBDb21wb25lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5oYXNDb21wb25lbnQoQ29tcG9uZW50c1tpXSwgaW5jbHVkZVJlbW92ZWQpKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbGwgdGhlIGNvbXBvbmVudHMgZnJvbSB0aGUgZW50aXR5XG4gICAqL1xuICByZW1vdmVBbGxDb21wb25lbnRzKGZvcmNlUmVtb3ZlKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dvcmxkLmVudGl0eVJlbW92ZUFsbENvbXBvbmVudHModGhpcywgZm9yY2VSZW1vdmUpO1xuICB9XG5cbiAgLy8gRVhUUkFTXG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgdGhlIGVudGl0eS4gVG8gYmUgdXNlZCB3aGVuIHJldHVybmluZyBhbiBlbnRpdHkgdG8gdGhlIHBvb2xcbiAgICovXG4gIHJlc2V0KCkge1xuICAgIHRoaXMuaWQgPSBuZXh0SWQrKztcbiAgICB0aGlzLl93b3JsZCA9IG51bGw7XG4gICAgdGhpcy5fQ29tcG9uZW50VHlwZXMubGVuZ3RoID0gMDtcbiAgICB0aGlzLnF1ZXJpZXMubGVuZ3RoID0gMDtcbiAgICB0aGlzLl9jb21wb25lbnRzID0ge307XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBlbnRpdHkgZnJvbSB0aGUgd29ybGRcbiAgICovXG4gIHJlbW92ZShmb3JjZVJlbW92ZSkge1xuICAgIHJldHVybiB0aGlzLl93b3JsZC5yZW1vdmVFbnRpdHkodGhpcywgZm9yY2VSZW1vdmUpO1xuICB9XG59XG4iLCIvKipcbiAqIEBjbGFzcyBPYmplY3RQb29sXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE9iamVjdFBvb2wge1xuICAvLyBAdG9kbyBBZGQgaW5pdGlhbCBzaXplXG4gIGNvbnN0cnVjdG9yKFQsIGluaXRpYWxTaXplKSB7XG4gICAgdGhpcy5mcmVlTGlzdCA9IFtdO1xuICAgIHRoaXMuY291bnQgPSAwO1xuICAgIHRoaXMuVCA9IFQ7XG5cbiAgICB2YXIgZXh0cmFBcmdzID0gbnVsbDtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGV4dHJhQXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICBleHRyYUFyZ3Muc2hpZnQoKTtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0ZUVsZW1lbnQgPSBleHRyYUFyZ3NcbiAgICAgID8gKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgVCguLi5leHRyYUFyZ3MpO1xuICAgICAgICB9XG4gICAgICA6ICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFQoKTtcbiAgICAgICAgfTtcblxuICAgIGlmICh0eXBlb2YgaW5pdGlhbFNpemUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHRoaXMuZXhwYW5kKGluaXRpYWxTaXplKTtcbiAgICB9XG4gIH1cblxuICBhcXVpcmUoKSB7XG4gICAgLy8gR3JvdyB0aGUgbGlzdCBieSAyMCVpc2ggaWYgd2UncmUgb3V0XG4gICAgaWYgKHRoaXMuZnJlZUxpc3QubGVuZ3RoIDw9IDApIHtcbiAgICAgIHRoaXMuZXhwYW5kKE1hdGgucm91bmQodGhpcy5jb3VudCAqIDAuMikgKyAxKTtcbiAgICB9XG5cbiAgICB2YXIgaXRlbSA9IHRoaXMuZnJlZUxpc3QucG9wKCk7XG5cbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuXG4gIHJlbGVhc2UoaXRlbSkge1xuICAgIGl0ZW0ucmVzZXQoKTtcbiAgICB0aGlzLmZyZWVMaXN0LnB1c2goaXRlbSk7XG4gIH1cblxuICBleHBhbmQoY291bnQpIHtcbiAgICBmb3IgKHZhciBuID0gMDsgbiA8IGNvdW50OyBuKyspIHtcbiAgICAgIHRoaXMuZnJlZUxpc3QucHVzaCh0aGlzLmNyZWF0ZUVsZW1lbnQoKSk7XG4gICAgfVxuICAgIHRoaXMuY291bnQgKz0gY291bnQ7XG4gIH1cblxuICB0b3RhbFNpemUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY291bnQ7XG4gIH1cblxuICB0b3RhbEZyZWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuZnJlZUxpc3QubGVuZ3RoO1xuICB9XG5cbiAgdG90YWxVc2VkKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50IC0gdGhpcy5mcmVlTGlzdC5sZW5ndGg7XG4gIH1cbn1cbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuaW1wb3J0IHsgcXVlcnlLZXkgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG4vKipcbiAqIEBjbGFzcyBRdWVyeU1hbmFnZXJcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUXVlcnlNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLl93b3JsZCA9IHdvcmxkO1xuXG4gICAgLy8gUXVlcmllcyBpbmRleGVkIGJ5IGEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBjb21wb25lbnRzIGl0IGhhc1xuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgfVxuXG4gIG9uRW50aXR5UmVtb3ZlZChlbnRpdHkpIHtcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdO1xuICAgICAgaWYgKGVudGl0eS5xdWVyaWVzLmluZGV4T2YocXVlcnkpICE9PSAtMSkge1xuICAgICAgICBxdWVyeS5yZW1vdmVFbnRpdHkoZW50aXR5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2hlbiBhIGNvbXBvbmVudCBpcyBhZGRlZCB0byBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdGhhdCBqdXN0IGdvdCB0aGUgbmV3IGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCBhZGRlZCB0byB0aGUgZW50aXR5XG4gICAqL1xuICBvbkVudGl0eUNvbXBvbmVudEFkZGVkKGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgLy8gQHRvZG8gVXNlIGJpdG1hc2sgZm9yIGNoZWNraW5nIGNvbXBvbmVudHM/XG5cbiAgICAvLyBDaGVjayBlYWNoIGluZGV4ZWQgcXVlcnkgdG8gc2VlIGlmIHdlIG5lZWQgdG8gYWRkIHRoaXMgZW50aXR5IHRvIHRoZSBsaXN0XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXTtcblxuICAgICAgaWYgKFxuICAgICAgICAhIX5xdWVyeS5Ob3RDb21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgICB+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpXG4gICAgICApIHtcbiAgICAgICAgcXVlcnkucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgdGhlIGVudGl0eSBvbmx5IGlmOlxuICAgICAgLy8gQ29tcG9uZW50IGlzIGluIHRoZSBxdWVyeVxuICAgICAgLy8gYW5kIEVudGl0eSBoYXMgQUxMIHRoZSBjb21wb25lbnRzIG9mIHRoZSBxdWVyeVxuICAgICAgLy8gYW5kIEVudGl0eSBpcyBub3QgYWxyZWFkeSBpbiB0aGUgcXVlcnlcbiAgICAgIGlmIChcbiAgICAgICAgIX5xdWVyeS5Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSB8fFxuICAgICAgICAhcXVlcnkubWF0Y2goZW50aXR5KSB8fFxuICAgICAgICB+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpXG4gICAgICApXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBxdWVyeS5hZGRFbnRpdHkoZW50aXR5KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2hlbiBhIGNvbXBvbmVudCBpcyByZW1vdmVkIGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRvIHJlbW92ZSB0aGUgY29tcG9uZW50IGZyb21cbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gcmVtb3ZlIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgb25FbnRpdHlDb21wb25lbnRSZW1vdmVkKGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXTtcblxuICAgICAgaWYgKFxuICAgICAgICAhIX5xdWVyeS5Ob3RDb21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgICAhfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KSAmJlxuICAgICAgICBxdWVyeS5tYXRjaChlbnRpdHkpXG4gICAgICApIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJRdWVyeSBub3cgbWF0Y2hlc1wiLCBxdWVyeU5hbWUsIGVudGl0eSk7XG4gICAgICAgIHF1ZXJ5LmFkZEVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICAhIX5xdWVyeS5Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgICAhIX5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSkgJiZcbiAgICAgICAgIXF1ZXJ5Lm1hdGNoKGVudGl0eSlcbiAgICAgICkge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcIlF1ZXJ5IG5vIGxvbmdlciBtYXRjaGVzXCIsIHF1ZXJ5TmFtZSwgZW50aXR5KTtcbiAgICAgICAgcXVlcnkucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBxdWVyeSBmb3IgdGhlIHNwZWNpZmllZCBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRzIENvbXBvbmVudHMgdGhhdCB0aGUgcXVlcnkgc2hvdWxkIGhhdmVcbiAgICovXG4gIGdldFF1ZXJ5KENvbXBvbmVudHMpIHtcbiAgICB2YXIga2V5ID0gcXVlcnlLZXkoQ29tcG9uZW50cyk7XG4gICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1trZXldO1xuICAgIGlmICghcXVlcnkpIHtcbiAgICAgIHRoaXMuX3F1ZXJpZXNba2V5XSA9IHF1ZXJ5ID0gbmV3IFF1ZXJ5KENvbXBvbmVudHMsIHRoaXMuX3dvcmxkKTtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzb21lIHN0YXRzIGZyb20gdGhpcyBjbGFzc1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge307XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHN0YXRzW3F1ZXJ5TmFtZV0gPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV0uc3RhdHMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG4iLCJpbXBvcnQgRW50aXR5IGZyb20gXCIuL0VudGl0eS5qc1wiO1xuaW1wb3J0IE9iamVjdFBvb2wgZnJvbSBcIi4vT2JqZWN0UG9vbC5qc1wiO1xuaW1wb3J0IFF1ZXJ5TWFuYWdlciBmcm9tIFwiLi9RdWVyeU1hbmFnZXIuanNcIjtcbmltcG9ydCBFdmVudERpc3BhdGNoZXIgZnJvbSBcIi4vRXZlbnREaXNwYXRjaGVyLmpzXCI7XG5pbXBvcnQgeyBjb21wb25lbnRQcm9wZXJ0eU5hbWUsIGdldE5hbWUgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG4vKipcbiAqIEBjbGFzcyBFbnRpdHlNYW5hZ2VyXG4gKi9cbmV4cG9ydCBjbGFzcyBFbnRpdHlNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlciA9IHdvcmxkLmNvbXBvbmVudHNNYW5hZ2VyO1xuXG4gICAgLy8gQWxsIHRoZSBlbnRpdGllcyBpbiB0aGlzIGluc3RhbmNlXG4gICAgdGhpcy5fZW50aXRpZXMgPSBbXTtcblxuICAgIHRoaXMuX3F1ZXJ5TWFuYWdlciA9IG5ldyBRdWVyeU1hbmFnZXIodGhpcyk7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG4gICAgdGhpcy5fZW50aXR5UG9vbCA9IG5ldyBPYmplY3RQb29sKEVudGl0eSk7XG5cbiAgICAvLyBEZWZlcnJlZCBkZWxldGlvblxuICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlID0gW107XG4gICAgdGhpcy5lbnRpdGllc1RvUmVtb3ZlID0gW107XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGVudGl0eVxuICAgKi9cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHZhciBlbnRpdHkgPSB0aGlzLl9lbnRpdHlQb29sLmFxdWlyZSgpO1xuICAgIGVudGl0eS5fd29ybGQgPSB0aGlzO1xuICAgIHRoaXMuX2VudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KEVOVElUWV9DUkVBVEVELCBlbnRpdHkpO1xuICAgIHJldHVybiBlbnRpdHk7XG4gIH1cblxuICAvLyBDT01QT05FTlRTXG5cbiAgLyoqXG4gICAqIEFkZCBhIGNvbXBvbmVudCB0byBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hlcmUgdGhlIGNvbXBvbmVudCB3aWxsIGJlIGFkZGVkXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIGJlIGFkZGVkIHRvIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtPYmplY3R9IHZhbHVlcyBPcHRpb25hbCB2YWx1ZXMgdG8gcmVwbGFjZSB0aGUgZGVmYXVsdCBhdHRyaWJ1dGVzXG4gICAqL1xuICBlbnRpdHlBZGRDb21wb25lbnQoZW50aXR5LCBDb21wb25lbnQsIHZhbHVlcykge1xuICAgIGlmICh+ZW50aXR5Ll9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCkpIHJldHVybjtcblxuICAgIGVudGl0eS5fQ29tcG9uZW50VHlwZXMucHVzaChDb21wb25lbnQpO1xuXG4gICAgdmFyIGNvbXBvbmVudFBvb2wgPSB0aGlzLndvcmxkLmNvbXBvbmVudHNNYW5hZ2VyLmdldENvbXBvbmVudHNQb29sKFxuICAgICAgQ29tcG9uZW50XG4gICAgKTtcbiAgICB2YXIgY29tcG9uZW50ID0gY29tcG9uZW50UG9vbC5hcXVpcmUoKTtcblxuICAgIGVudGl0eS5fY29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBjb21wb25lbnQ7XG5cbiAgICBpZiAodmFsdWVzKSB7XG4gICAgICBpZiAoY29tcG9uZW50LmNvcHkpIHtcbiAgICAgICAgY29tcG9uZW50LmNvcHkodmFsdWVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4gdmFsdWVzKSB7XG4gICAgICAgICAgY29tcG9uZW50W25hbWVdID0gdmFsdWVzW25hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5Q29tcG9uZW50QWRkZWQoZW50aXR5LCBDb21wb25lbnQpO1xuICAgIHRoaXMud29ybGQuY29tcG9uZW50c01hbmFnZXIuY29tcG9uZW50QWRkZWRUb0VudGl0eShDb21wb25lbnQpO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChDT01QT05FTlRfQURERUQsIGVudGl0eSwgQ29tcG9uZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBjb21wb25lbnQgZnJvbSBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hpY2ggd2lsbCBnZXQgcmVtb3ZlZCB0aGUgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Kn0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZW1vdmUgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7Qm9vbH0gZm9yY2VSZW1vdmUgSWYgeW91IHdhbnQgdG8gcmVtb3ZlIHRoZSBjb21wb25lbnQgaW1tZWRpYXRlbHkgaW5zdGVhZCBvZiBkZWZlcnJlZCAoRGVmYXVsdCBpcyBmYWxzZSlcbiAgICovXG4gIGVudGl0eVJlbW92ZUNvbXBvbmVudChlbnRpdHksIENvbXBvbmVudCwgZm9yY2VSZW1vdmUpIHtcbiAgICB2YXIgaW5kZXggPSBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChDT01QT05FTlRfUkVNT1ZFLCBlbnRpdHksIENvbXBvbmVudCk7XG5cbiAgICBpZiAoZm9yY2VSZW1vdmUpIHtcbiAgICAgIHRoaXMuX2VudGl0eVJlbW92ZUNvbXBvbmVudFN5bmMoZW50aXR5LCBDb21wb25lbnQsIGluZGV4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGVudGl0eS5jb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoID09PSAwKVxuICAgICAgICB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZS5wdXNoKGVudGl0eSk7XG4gICAgICBlbnRpdHkuY29tcG9uZW50c1RvUmVtb3ZlLnB1c2goQ29tcG9uZW50KTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBlYWNoIGluZGV4ZWQgcXVlcnkgdG8gc2VlIGlmIHdlIG5lZWQgdG8gcmVtb3ZlIGl0XG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5Q29tcG9uZW50UmVtb3ZlZChlbnRpdHksIENvbXBvbmVudCk7XG4gIH1cblxuICBfZW50aXR5UmVtb3ZlQ29tcG9uZW50U3luYyhlbnRpdHksIENvbXBvbmVudCwgaW5kZXgpIHtcbiAgICAvLyBSZW1vdmUgVCBsaXN0aW5nIG9uIGVudGl0eSBhbmQgcHJvcGVydHkgcmVmLCB0aGVuIGZyZWUgdGhlIGNvbXBvbmVudC5cbiAgICBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgdmFyIHByb3BOYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG4gICAgdmFyIGNvbXBvbmVudE5hbWUgPSBnZXROYW1lKENvbXBvbmVudCk7XG4gICAgdmFyIGNvbXBvbmVudCA9IGVudGl0eS5fY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcbiAgICBkZWxldGUgZW50aXR5Ll9jb21wb25lbnRzW2NvbXBvbmVudE5hbWVdO1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2xbcHJvcE5hbWVdLnJlbGVhc2UoY29tcG9uZW50KTtcbiAgICB0aGlzLndvcmxkLmNvbXBvbmVudHNNYW5hZ2VyLmNvbXBvbmVudFJlbW92ZWRGcm9tRW50aXR5KENvbXBvbmVudCk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0aGUgY29tcG9uZW50cyBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSBmcm9tIHdoaWNoIHRoZSBjb21wb25lbnRzIHdpbGwgYmUgcmVtb3ZlZFxuICAgKi9cbiAgZW50aXR5UmVtb3ZlQWxsQ29tcG9uZW50cyhlbnRpdHksIGZvcmNlUmVtb3ZlKSB7XG4gICAgbGV0IENvbXBvbmVudHMgPSBlbnRpdHkuX0NvbXBvbmVudFR5cGVzO1xuXG4gICAgZm9yIChsZXQgaiA9IENvbXBvbmVudHMubGVuZ3RoIC0gMTsgaiA+PSAwOyBqLS0pIHtcbiAgICAgIHRoaXMuZW50aXR5UmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50c1tqXSwgZm9yY2VSZW1vdmUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhlIGVudGl0eSBmcm9tIHRoaXMgbWFuYWdlci4gSXQgd2lsbCBjbGVhciBhbHNvIGl0cyBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRvIHJlbW92ZSBmcm9tIHRoZSBtYW5hZ2VyXG4gICAqIEBwYXJhbSB7Qm9vbH0gZm9yY2VSZW1vdmUgSWYgeW91IHdhbnQgdG8gcmVtb3ZlIHRoZSBjb21wb25lbnQgaW1tZWRpYXRlbHkgaW5zdGVhZCBvZiBkZWZlcnJlZCAoRGVmYXVsdCBpcyBmYWxzZSlcbiAgICovXG4gIHJlbW92ZUVudGl0eShlbnRpdHksIGZvcmNlUmVtb3ZlKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5fZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuXG4gICAgaWYgKCF+aW5kZXgpIHRocm93IG5ldyBFcnJvcihcIlRyaWVkIHRvIHJlbW92ZSBlbnRpdHkgbm90IGluIGxpc3RcIik7XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBlbnRpdHkgbGlzdFxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoRU5USVRZX1JFTU9WRUQsIGVudGl0eSk7XG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5UmVtb3ZlZChlbnRpdHkpO1xuXG4gICAgaWYgKGZvcmNlUmVtb3ZlID09PSB0cnVlKSB7XG4gICAgICB0aGlzLl9yZW1vdmVFbnRpdHlTeW5jKGVudGl0eSwgaW5kZXgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUucHVzaChlbnRpdHkpO1xuICAgIH1cbiAgfVxuXG4gIF9yZW1vdmVFbnRpdHlTeW5jKGVudGl0eSwgaW5kZXgpIHtcbiAgICB0aGlzLl9lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgdGhpcy5lbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKGVudGl0eSwgdHJ1ZSk7XG5cbiAgICAvLyBQcmV2ZW50IGFueSBhY2Nlc3MgYW5kIGZyZWVcbiAgICBlbnRpdHkuX3dvcmxkID0gbnVsbDtcbiAgICB0aGlzLl9lbnRpdHlQb29sLnJlbGVhc2UoZW50aXR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIGVudGl0aWVzIGZyb20gdGhpcyBtYW5hZ2VyXG4gICAqL1xuICByZW1vdmVBbGxFbnRpdGllcygpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5fZW50aXRpZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHRoaXMuX2VudGl0aWVzW2ldLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByb2Nlc3NEZWZlcnJlZFJlbW92YWwoKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmVudGl0aWVzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBlbnRpdHkgPSB0aGlzLmVudGl0aWVzVG9SZW1vdmVbaV07XG4gICAgICBsZXQgaW5kZXggPSB0aGlzLl9lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgICB0aGlzLl9yZW1vdmVFbnRpdHlTeW5jKGVudGl0eSwgaW5kZXgpO1xuICAgIH1cbiAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUubGVuZ3RoID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBlbnRpdHkgPSB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZVtpXTtcbiAgICAgIHdoaWxlIChlbnRpdHkuY29tcG9uZW50c1RvUmVtb3ZlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbGV0IENvbXBvbmVudCA9IGVudGl0eS5jb21wb25lbnRzVG9SZW1vdmUucG9wKCk7XG4gICAgICAgIGxldCBpbmRleCA9IGVudGl0eS5fQ29tcG9uZW50VHlwZXMuaW5kZXhPZihDb21wb25lbnQpO1xuICAgICAgICB0aGlzLl9lbnRpdHlSZW1vdmVDb21wb25lbnRTeW5jKGVudGl0eSwgQ29tcG9uZW50LCBpbmRleCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoID0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBxdWVyeSBiYXNlZCBvbiBhIGxpc3Qgb2YgY29tcG9uZW50c1xuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgTGlzdCBvZiBjb21wb25lbnRzIHRoYXQgd2lsbCBmb3JtIHRoZSBxdWVyeVxuICAgKi9cbiAgcXVlcnlDb21wb25lbnRzKENvbXBvbmVudHMpIHtcbiAgICByZXR1cm4gdGhpcy5fcXVlcnlNYW5hZ2VyLmdldFF1ZXJ5KENvbXBvbmVudHMpO1xuICB9XG5cbiAgLy8gRVhUUkFTXG5cbiAgLyoqXG4gICAqIFJldHVybiBudW1iZXIgb2YgZW50aXRpZXNcbiAgICovXG4gIGNvdW50KCkge1xuICAgIHJldHVybiB0aGlzLl9lbnRpdGllcy5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHNvbWUgc3RhdHNcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIG51bUVudGl0aWVzOiB0aGlzLl9lbnRpdGllcy5sZW5ndGgsXG4gICAgICBudW1RdWVyaWVzOiBPYmplY3Qua2V5cyh0aGlzLl9xdWVyeU1hbmFnZXIuX3F1ZXJpZXMpLmxlbmd0aCxcbiAgICAgIHF1ZXJpZXM6IHRoaXMuX3F1ZXJ5TWFuYWdlci5zdGF0cygpLFxuICAgICAgbnVtQ29tcG9uZW50UG9vbDogT2JqZWN0LmtleXModGhpcy5jb21wb25lbnRzTWFuYWdlci5fY29tcG9uZW50UG9vbClcbiAgICAgICAgLmxlbmd0aCxcbiAgICAgIGNvbXBvbmVudFBvb2w6IHt9LFxuICAgICAgZXZlbnREaXNwYXRjaGVyOiB0aGlzLmV2ZW50RGlzcGF0Y2hlci5zdGF0c1xuICAgIH07XG5cbiAgICBmb3IgKHZhciBjbmFtZSBpbiB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLl9jb21wb25lbnRQb29sKSB7XG4gICAgICB2YXIgcG9vbCA9IHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2xbY25hbWVdO1xuICAgICAgc3RhdHMuY29tcG9uZW50UG9vbFtjbmFtZV0gPSB7XG4gICAgICAgIHVzZWQ6IHBvb2wudG90YWxVc2VkKCksXG4gICAgICAgIHNpemU6IHBvb2wuY291bnRcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG5cbmNvbnN0IEVOVElUWV9DUkVBVEVEID0gXCJFbnRpdHlNYW5hZ2VyI0VOVElUWV9DUkVBVEVcIjtcbmNvbnN0IEVOVElUWV9SRU1PVkVEID0gXCJFbnRpdHlNYW5hZ2VyI0VOVElUWV9SRU1PVkVEXCI7XG5jb25zdCBDT01QT05FTlRfQURERUQgPSBcIkVudGl0eU1hbmFnZXIjQ09NUE9ORU5UX0FEREVEXCI7XG5jb25zdCBDT01QT05FTlRfUkVNT1ZFID0gXCJFbnRpdHlNYW5hZ2VyI0NPTVBPTkVOVF9SRU1PVkVcIjtcbiIsIi8qKlxuICogQGNsYXNzIER1bW15T2JqZWN0UG9vbFxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEdW1teU9iamVjdFBvb2wge1xuICBjb25zdHJ1Y3RvcihUKSB7XG4gICAgdGhpcy5jb3VudCA9IDA7XG4gICAgdGhpcy51c2VkID0gMDtcbiAgICB0aGlzLlQgPSBUO1xuICB9XG5cbiAgYXF1aXJlKCkge1xuICAgIHRoaXMudXNlZCsrO1xuICAgIHRoaXMuY291bnQrKztcbiAgICByZXR1cm4gbmV3IHRoaXMuVCgpO1xuICB9XG5cbiAgcmVsZWFzZSgpIHtcbiAgICB0aGlzLnVzZWQtLTtcbiAgfVxuXG4gIHRvdGFsU2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb3VudDtcbiAgfVxuXG4gIHRvdGFsRnJlZSgpIHtcbiAgICByZXR1cm4gSW5maW5pdHk7XG4gIH1cblxuICB0b3RhbFVzZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMudXNlZDtcbiAgfVxufVxuIiwiaW1wb3J0IE9iamVjdFBvb2wgZnJvbSBcIi4vT2JqZWN0UG9vbC5qc1wiO1xuaW1wb3J0IER1bW15T2JqZWN0UG9vbCBmcm9tIFwiLi9EdW1teU9iamVjdFBvb2wuanNcIjtcbmltcG9ydCB7IGNvbXBvbmVudFByb3BlcnR5TmFtZSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIENvbXBvbmVudE1hbmFnZXJcbiAqL1xuZXhwb3J0IGNsYXNzIENvbXBvbmVudE1hbmFnZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLkNvbXBvbmVudHMgPSB7fTtcbiAgICB0aGlzLlNpbmdsZXRvbkNvbXBvbmVudHMgPSB7fTtcbiAgICB0aGlzLl9jb21wb25lbnRQb29sID0ge307XG4gICAgdGhpcy5udW1Db21wb25lbnRzID0ge307XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gcmVnaXN0ZXJcbiAgICovXG4gIHJlZ2lzdGVyQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBDb21wb25lbnQ7XG4gICAgdGhpcy5udW1Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IDA7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzaW5nbGV0b24gY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlZ2lzdGVyIGFzIHNpbmdsZXRvblxuICAgKi9cbiAgcmVnaXN0ZXJTaW5nbGV0b25Db21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5TaW5nbGV0b25Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IENvbXBvbmVudDtcbiAgfVxuXG4gIGNvbXBvbmVudEFkZGVkVG9FbnRpdHkoQ29tcG9uZW50KSB7XG4gICAgaWYgKCF0aGlzLm51bUNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdKSB7XG4gICAgICB0aGlzLm51bUNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5udW1Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSsrO1xuICAgIH1cbiAgfVxuXG4gIGNvbXBvbmVudFJlbW92ZWRGcm9tRW50aXR5KENvbXBvbmVudCkge1xuICAgIHRoaXMubnVtQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0tLTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY29tcG9uZW50cyBwb29sXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgVHlwZSBvZiBjb21wb25lbnQgdHlwZSBmb3IgdGhlIHBvb2xcbiAgICovXG4gIGdldENvbXBvbmVudHNQb29sKENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnROYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG5cbiAgICBpZiAoIXRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0pIHtcbiAgICAgIGlmIChDb21wb25lbnQucHJvdG90eXBlLnJlc2V0KSB7XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0gPSBuZXcgT2JqZWN0UG9vbChDb21wb25lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBDb21wb25lbnQgJyR7Q29tcG9uZW50Lm5hbWV9JyB3b24ndCBiZW5lZml0IGZyb20gcG9vbGluZyBiZWNhdXNlICdyZXNldCcgbWV0aG9kIHdhcyBub3QgaW1wbGVtZW5ldGVkLmBcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXSA9IG5ldyBEdW1teU9iamVjdFBvb2woQ29tcG9uZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgU3lzdGVtTWFuYWdlciB9IGZyb20gXCIuL1N5c3RlbU1hbmFnZXIuanNcIjtcbmltcG9ydCB7IEVudGl0eU1hbmFnZXIgfSBmcm9tIFwiLi9FbnRpdHlNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBDb21wb25lbnRNYW5hZ2VyIH0gZnJvbSBcIi4vQ29tcG9uZW50TWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgY29tcG9uZW50UHJvcGVydHlOYW1lIH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcbmltcG9ydCBFdmVudERpc3BhdGNoZXIgZnJvbSBcIi4vRXZlbnREaXNwYXRjaGVyLmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIFdvcmxkXG4gKi9cbmV4cG9ydCBjbGFzcyBXb3JsZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIgPSBuZXcgQ29tcG9uZW50TWFuYWdlcih0aGlzKTtcbiAgICB0aGlzLmVudGl0eU1hbmFnZXIgPSBuZXcgRW50aXR5TWFuYWdlcih0aGlzKTtcbiAgICB0aGlzLnN5c3RlbU1hbmFnZXIgPSBuZXcgU3lzdGVtTWFuYWdlcih0aGlzKTtcblxuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cbiAgICAvLyBTdG9yYWdlIGZvciBzaW5nbGV0b24gY29tcG9uZW50c1xuICAgIHRoaXMuY29tcG9uZW50cyA9IHt9O1xuXG4gICAgdGhpcy5ldmVudFF1ZXVlcyA9IHt9O1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyID0gbmV3IEV2ZW50RGlzcGF0Y2hlcigpO1xuXG4gICAgaWYgKHR5cGVvZiBDdXN0b21FdmVudCAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgdmFyIGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KFwiZWNzeS13b3JsZC1jcmVhdGVkXCIsIHsgZGV0YWlsOiB0aGlzIH0pO1xuICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICAgIH1cbiAgfVxuXG4gIGVtaXRFdmVudChldmVudE5hbWUsIGRhdGEpIHtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KGV2ZW50TmFtZSwgZGF0YSk7XG4gIH1cblxuICBhZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgY2FsbGJhY2spO1xuICB9XG5cbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIHNpbmdsZXRvbiBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBTaW5nbGV0b24gY29tcG9uZW50XG4gICAqL1xuICByZWdpc3RlclNpbmdsZXRvbkNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLnJlZ2lzdGVyU2luZ2xldG9uQ29tcG9uZW50KENvbXBvbmVudCk7XG4gICAgdGhpcy5jb21wb25lbnRzW2NvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpXSA9IG5ldyBDb21wb25lbnQoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50XG4gICAqL1xuICByZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLnJlZ2lzdGVyQ29tcG9uZW50KENvbXBvbmVudCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzeXN0ZW1cbiAgICogQHBhcmFtIHtTeXN0ZW19IFN5c3RlbVxuICAgKi9cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtLCBhdHRyaWJ1dGVzKSB7XG4gICAgdGhpcy5zeXN0ZW1NYW5hZ2VyLnJlZ2lzdGVyU3lzdGVtKFN5c3RlbSwgYXR0cmlidXRlcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRoZSBzeXN0ZW1zIHBlciBmcmFtZVxuICAgKiBAcGFyYW0ge051bWJlcn0gZGVsdGEgRGVsdGEgdGltZSBzaW5jZSB0aGUgbGFzdCBjYWxsXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lIEVsYXBzZWQgdGltZVxuICAgKi9cbiAgZXhlY3V0ZShkZWx0YSwgdGltZSkge1xuICAgIGlmICh0aGlzLmVuYWJsZWQpIHtcbiAgICAgIHRoaXMuc3lzdGVtTWFuYWdlci5leGVjdXRlKGRlbHRhLCB0aW1lKTtcbiAgICAgIHRoaXMuZW50aXR5TWFuYWdlci5wcm9jZXNzRGVmZXJyZWRSZW1vdmFsKCk7XG4gICAgfVxuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHBsYXkoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgZW50aXR5XG4gICAqL1xuICBjcmVhdGVFbnRpdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50aXR5TWFuYWdlci5jcmVhdGVFbnRpdHkoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgc29tZSBzdGF0c1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge1xuICAgICAgZW50aXRpZXM6IHRoaXMuZW50aXR5TWFuYWdlci5zdGF0cygpLFxuICAgICAgc3lzdGVtOiB0aGlzLnN5c3RlbU1hbmFnZXIuc3RhdHMoKVxuICAgIH07XG5cbiAgICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeShzdGF0cywgbnVsbCwgMikpO1xuICB9XG59XG4iLCIvKipcbiAqIEBjbGFzcyBTeXN0ZW1cbiAqL1xuaW1wb3J0IFF1ZXJ5IGZyb20gXCIuL1F1ZXJ5LmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBTeXN0ZW0ge1xuICB0b0pTT04oKSB7XG4gICAgdmFyIGpzb24gPSB7XG4gICAgICBuYW1lOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICBlbmFibGVkOiB0aGlzLmVuYWJsZWQsXG4gICAgICBleGVjdXRlVGltZTogdGhpcy5leGVjdXRlVGltZSxcbiAgICAgIHByaW9yaXR5OiB0aGlzLnByaW9yaXR5LFxuICAgICAgcXVlcmllczoge30sXG4gICAgICBldmVudHM6IHt9XG4gICAgfTtcblxuICAgIGlmICh0aGlzLmNvbmZpZykge1xuICAgICAgdmFyIHF1ZXJpZXMgPSB0aGlzLmNvbmZpZy5xdWVyaWVzO1xuICAgICAgZm9yIChsZXQgcXVlcnlOYW1lIGluIHF1ZXJpZXMpIHtcbiAgICAgICAgbGV0IHF1ZXJ5ID0gcXVlcmllc1txdWVyeU5hbWVdO1xuICAgICAgICBqc29uLnF1ZXJpZXNbcXVlcnlOYW1lXSA9IHtcbiAgICAgICAgICBrZXk6IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXS5rZXlcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHF1ZXJ5LmV2ZW50cykge1xuICAgICAgICAgIGxldCBldmVudHMgPSAoanNvbi5xdWVyaWVzW3F1ZXJ5TmFtZV1bXCJldmVudHNcIl0gPSB7fSk7XG4gICAgICAgICAgZm9yIChsZXQgZXZlbnROYW1lIGluIHF1ZXJ5LmV2ZW50cykge1xuICAgICAgICAgICAgbGV0IGV2ZW50ID0gcXVlcnkuZXZlbnRzW2V2ZW50TmFtZV07XG4gICAgICAgICAgICBldmVudHNbZXZlbnROYW1lXSA9IHtcbiAgICAgICAgICAgICAgZXZlbnROYW1lOiBldmVudC5ldmVudCxcbiAgICAgICAgICAgICAgbnVtRW50aXRpZXM6IHRoaXMuZXZlbnRzW3F1ZXJ5TmFtZV1bZXZlbnROYW1lXS5sZW5ndGhcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoZXZlbnQuY29tcG9uZW50cykge1xuICAgICAgICAgICAgICBldmVudHNbZXZlbnROYW1lXS5jb21wb25lbnRzID0gZXZlbnQuY29tcG9uZW50cy5tYXAoYyA9PiBjLm5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsZXQgZXZlbnRzID0gdGhpcy5jb25maWcuZXZlbnRzO1xuICAgICAgZm9yIChsZXQgZXZlbnROYW1lIGluIGV2ZW50cykge1xuICAgICAgICBqc29uLmV2ZW50c1tldmVudE5hbWVdID0ge1xuICAgICAgICAgIGV2ZW50TmFtZTogZXZlbnRzW2V2ZW50TmFtZV1cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ganNvbjtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHdvcmxkLCBhdHRyaWJ1dGVzKSB7XG4gICAgdGhpcy53b3JsZCA9IHdvcmxkO1xuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cbiAgICAvLyBAdG9kbyBCZXR0ZXIgbmFtaW5nIDopXG4gICAgdGhpcy5fcXVlcmllcyA9IHt9O1xuICAgIHRoaXMucXVlcmllcyA9IHt9O1xuXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgdGhpcy5ldmVudHMgPSB7fTtcblxuICAgIHRoaXMucHJpb3JpdHkgPSAwO1xuXG4gICAgLy8gVXNlZCBmb3Igc3RhdHNcbiAgICB0aGlzLmV4ZWN1dGVUaW1lID0gMDtcblxuICAgIGlmIChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXMucHJpb3JpdHkpIHtcbiAgICAgIHRoaXMucHJpb3JpdHkgPSBhdHRyaWJ1dGVzLnByaW9yaXR5O1xuICAgIH1cblxuICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgdGhpcy5jb25maWcgPSB0aGlzLmluaXQgPyB0aGlzLmluaXQoKSA6IG51bGw7XG5cbiAgICBpZiAoIXRoaXMuY29uZmlnKSByZXR1cm47XG4gICAgaWYgKHRoaXMuY29uZmlnLnF1ZXJpZXMpIHtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5jb25maWcucXVlcmllcykge1xuICAgICAgICB2YXIgcXVlcnlDb25maWcgPSB0aGlzLmNvbmZpZy5xdWVyaWVzW25hbWVdO1xuICAgICAgICB2YXIgQ29tcG9uZW50cyA9IHF1ZXJ5Q29uZmlnLmNvbXBvbmVudHM7XG4gICAgICAgIGlmICghQ29tcG9uZW50cyB8fCBDb21wb25lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIidjb21wb25lbnRzJyBhdHRyaWJ1dGUgY2FuJ3QgYmUgZW1wdHkgaW4gYSBxdWVyeVwiKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcXVlcnkgPSB0aGlzLndvcmxkLmVudGl0eU1hbmFnZXIucXVlcnlDb21wb25lbnRzKENvbXBvbmVudHMpO1xuICAgICAgICB0aGlzLl9xdWVyaWVzW25hbWVdID0gcXVlcnk7XG4gICAgICAgIHRoaXMucXVlcmllc1tuYW1lXSA9IHF1ZXJ5LmVudGl0aWVzO1xuXG4gICAgICAgIGlmIChxdWVyeUNvbmZpZy5ldmVudHMpIHtcbiAgICAgICAgICB0aGlzLmV2ZW50c1tuYW1lXSA9IHt9O1xuICAgICAgICAgIGxldCBldmVudHMgPSB0aGlzLmV2ZW50c1tuYW1lXTtcbiAgICAgICAgICBmb3IgKGxldCBldmVudE5hbWUgaW4gcXVlcnlDb25maWcuZXZlbnRzKSB7XG4gICAgICAgICAgICBsZXQgZXZlbnQgPSBxdWVyeUNvbmZpZy5ldmVudHNbZXZlbnROYW1lXTtcbiAgICAgICAgICAgIGV2ZW50c1tldmVudE5hbWVdID0gW107XG5cbiAgICAgICAgICAgIGNvbnN0IGV2ZW50TWFwcGluZyA9IHtcbiAgICAgICAgICAgICAgRW50aXR5QWRkZWQ6IFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQsXG4gICAgICAgICAgICAgIEVudGl0eVJlbW92ZWQ6IFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfUkVNT1ZFRCxcbiAgICAgICAgICAgICAgRW50aXR5Q2hhbmdlZDogUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VEIC8vIFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQ0hBTkdFRFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKGV2ZW50TWFwcGluZ1tldmVudC5ldmVudF0pIHtcbiAgICAgICAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgZXZlbnRNYXBwaW5nW2V2ZW50LmV2ZW50XSxcbiAgICAgICAgICAgICAgICBlbnRpdHkgPT4ge1xuICAgICAgICAgICAgICAgICAgLy8gQGZpeG1lIEEgbG90IG9mIG92ZXJoZWFkP1xuICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50c1tldmVudE5hbWVdLmluZGV4T2YoZW50aXR5KSA9PT0gLTEpXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50c1tldmVudE5hbWVdLnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGlmIChldmVudC5ldmVudCA9PT0gXCJFbnRpdHlDaGFuZ2VkXCIpIHtcbiAgICAgICAgICAgICAgICBxdWVyeS5yZWFjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQuZXZlbnQgPT09IFwiQ29tcG9uZW50Q2hhbmdlZFwiKSB7XG4gICAgICAgICAgICAgIHF1ZXJ5LnJlYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICAgICAgICAgIChlbnRpdHksIGNvbXBvbmVudCkgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50LmNvbXBvbmVudHMuaW5kZXhPZihjb21wb25lbnQuY29uc3RydWN0b3IpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBldmVudHNbZXZlbnROYW1lXS5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLmNvbmZpZy5ldmVudHMpIHtcbiAgICAgIGZvciAobGV0IG5hbWUgaW4gdGhpcy5jb25maWcuZXZlbnRzKSB7XG4gICAgICAgIHZhciBldmVudCA9IHRoaXMuY29uZmlnLmV2ZW50c1tuYW1lXTtcbiAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0gPSBbXTtcbiAgICAgICAgdGhpcy53b3JsZC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBkYXRhID0+IHtcbiAgICAgICAgICB0aGlzLmV2ZW50c1tuYW1lXS5wdXNoKGRhdGEpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgZGVwZW5kZW5jaWVzID0gdGhpcy5jb25maWcuZGVwZW5kZW5jaWVzO1xuICAgIGlmIChkZXBlbmRlbmNpZXMpIHtcbiAgICAgIHRoaXMuZGVwZW5kZW5jaWVzVG9DaGVjayA9IHt9O1xuXG4gICAgICBpZiAoZGVwZW5kZW5jaWVzLnNpbmdsZXRvbikge1xuICAgICAgICB0aGlzLmRlcGVuZGVuY2llc1RvQ2hlY2suc2luZ2xldG9uID0gZGVwZW5kZW5jaWVzLnNpbmdsZXRvbi5zbGljZSgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoZGVwZW5kZW5jaWVzLnN5c3RlbSkge1xuICAgICAgICB0aGlzLmRlcGVuZGVuY2llc1RvQ2hlY2suc3lzdGVtID0gZGVwZW5kZW5jaWVzLnN5c3RlbS5zbGljZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG1lZXREZXBlbmRlbmNpZXMoKSB7XG4gICAgaWYgKCF0aGlzLmRlcGVuZGVuY2llc1RvQ2hlY2spIHJldHVybiB0cnVlO1xuXG4gICAgdmFyIHN1Y2Nlc3MgPSB0cnVlO1xuXG4gICAgLy8gU2luZ2xldG9uXG4gICAgaWYgKFxuICAgICAgdGhpcy5kZXBlbmRlbmNpZXNUb0NoZWNrLnNpbmdsZXRvbiAmJlxuICAgICAgdGhpcy5kZXBlbmRlbmNpZXNUb0NoZWNrLnNpbmdsZXRvbi5sZW5ndGggPiAwXG4gICAgKSB7XG4gICAgICB0aGlzLmRlcGVuZGVuY2llc1RvQ2hlY2suc2luZ2xldG9uID0gdGhpcy5kZXBlbmRlbmNpZXNUb0NoZWNrLnNpbmdsZXRvbi5maWx0ZXIoXG4gICAgICAgIGQgPT4ge1xuICAgICAgICAgIGZvciAobGV0IGlkIGluIHRoaXMud29ybGQuY29tcG9uZW50cykge1xuICAgICAgICAgICAgaWYgKHRoaXMud29ybGQuY29tcG9uZW50c1tpZF0gaW5zdGFuY2VvZiBkKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgICBzdWNjZXNzICY9IHRoaXMuZGVwZW5kZW5jaWVzVG9DaGVjay5zaW5nbGV0b24ubGVuZ3RoID09PSAwO1xuICAgIH1cblxuICAgIC8vIFN5c3RlbVxuICAgIGlmIChcbiAgICAgIHRoaXMuZGVwZW5kZW5jaWVzVG9DaGVjay5zeXN0ZW0gJiZcbiAgICAgIHRoaXMuZGVwZW5kZW5jaWVzVG9DaGVjay5zeXN0ZW0ubGVuZ3RoID4gMFxuICAgICkge1xuICAgICAgdGhpcy5kZXBlbmRlbmNpZXNUb0NoZWNrLnN5c3RlbSA9IHRoaXMuZGVwZW5kZW5jaWVzVG9DaGVjay5zeXN0ZW0uZmlsdGVyKFxuICAgICAgICBkID0+IHtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMud29ybGQuc3lzdGVtTWFuYWdlci5zeXN0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53b3JsZC5zeXN0ZW1NYW5hZ2VyLnN5c3RlbXNbaV0gaW5zdGFuY2VvZiBkKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgICBzdWNjZXNzICY9IHRoaXMuZGVwZW5kZW5jaWVzVG9DaGVjay5zeXN0ZW0ubGVuZ3RoID09PSAwO1xuICAgIH1cblxuICAgIHJldHVybiBzdWNjZXNzO1xuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHBsYXkoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgfVxuXG4gIGNsZWFyRXZlbnRzKCkge1xuICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5ldmVudHMpIHtcbiAgICAgIHZhciBldmVudCA9IHRoaXMuZXZlbnRzW25hbWVdO1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdLmxlbmd0aCA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKG5hbWUgaW4gZXZlbnQpIHtcbiAgICAgICAgICBldmVudFtuYW1lXS5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBOb3QoQ29tcG9uZW50KSB7XG4gIHJldHVybiB7XG4gICAgb3BlcmF0b3I6IFwibm90XCIsXG4gICAgQ29tcG9uZW50OiBDb21wb25lbnRcbiAgfTtcbn1cbiIsImV4cG9ydCBjbGFzcyBDb21wb25lbnQge31cbiIsImV4cG9ydCBjbGFzcyBUYWdDb21wb25lbnQge1xuICByZXNldCgpIHt9XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gY3JlYXRlVHlwZSh0eXBlRGVmaW5pdGlvbikge1xuICB2YXIgbWFuZGF0b3J5RnVuY3Rpb25zID0gW1xuICAgIFwiY3JlYXRlXCIsXG4gICAgXCJyZXNldFwiLFxuICAgIFwiY2xlYXJcIlxuICAgIC8qXCJjb3B5XCIqL1xuICBdO1xuXG4gIHZhciB1bmRlZmluZWRGdW5jdGlvbnMgPSBtYW5kYXRvcnlGdW5jdGlvbnMuZmlsdGVyKGYgPT4ge1xuICAgIHJldHVybiAhdHlwZURlZmluaXRpb25bZl07XG4gIH0pO1xuXG4gIGlmICh1bmRlZmluZWRGdW5jdGlvbnMubGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBjcmVhdGVUeXBlIGV4cGVjdCB0eXBlIGRlZmluaXRpb24gdG8gaW1wbGVtZW50cyB0aGUgZm9sbG93aW5nIGZ1bmN0aW9uczogJHt1bmRlZmluZWRGdW5jdGlvbnMuam9pbihcbiAgICAgICAgXCIsIFwiXG4gICAgICApfWBcbiAgICApO1xuICB9XG5cbiAgdHlwZURlZmluaXRpb24uaXNUeXBlID0gdHJ1ZTtcbiAgcmV0dXJuIHR5cGVEZWZpbml0aW9uO1xufVxuIiwiaW1wb3J0IHsgY3JlYXRlVHlwZSB9IGZyb20gXCIuL0NyZWF0ZVR5cGVcIjtcbnZhciBUeXBlcyA9IHt9O1xuXG5UeXBlcy5OdW1iZXIgPSBjcmVhdGVUeXBlKHtcbiAgYmFzZVR5cGU6IE51bWJlcixcbiAgaXNTaW1wbGVUeXBlOiB0cnVlLFxuICBjcmVhdGU6IGRlZmF1bHRWYWx1ZSA9PiB7XG4gICAgcmV0dXJuIHR5cGVvZiBkZWZhdWx0VmFsdWUgIT09IFwidW5kZWZpbmVkXCIgPyBkZWZhdWx0VmFsdWUgOiAwO1xuICB9LFxuICByZXNldDogKHNyYywga2V5LCBkZWZhdWx0VmFsdWUpID0+IHtcbiAgICBpZiAodHlwZW9mIGRlZmF1bHRWYWx1ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgc3JjW2tleV0gPSBkZWZhdWx0VmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNyY1trZXldID0gMDtcbiAgICB9XG4gIH0sXG4gIGNsZWFyOiAoc3JjLCBrZXkpID0+IHtcbiAgICBzcmNba2V5XSA9IDA7XG4gIH1cbn0pO1xuXG5UeXBlcy5Cb29sZWFuID0gY3JlYXRlVHlwZSh7XG4gIGJhc2VUeXBlOiBCb29sZWFuLFxuICBpc1NpbXBsZVR5cGU6IHRydWUsXG4gIGNyZWF0ZTogZGVmYXVsdFZhbHVlID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIGRlZmF1bHRWYWx1ZSAhPT0gXCJ1bmRlZmluZWRcIiA/IGRlZmF1bHRWYWx1ZSA6IGZhbHNlO1xuICB9LFxuICByZXNldDogKHNyYywga2V5LCBkZWZhdWx0VmFsdWUpID0+IHtcbiAgICBpZiAodHlwZW9mIGRlZmF1bHRWYWx1ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgc3JjW2tleV0gPSBkZWZhdWx0VmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNyY1trZXldID0gZmFsc2U7XG4gICAgfVxuICB9LFxuICBjbGVhcjogKHNyYywga2V5KSA9PiB7XG4gICAgc3JjW2tleV0gPSBmYWxzZTtcbiAgfVxufSk7XG5cblR5cGVzLlN0cmluZyA9IGNyZWF0ZVR5cGUoe1xuICBiYXNlVHlwZTogU3RyaW5nLFxuICBpc1NpbXBsZVR5cGU6IHRydWUsXG4gIGNyZWF0ZTogZGVmYXVsdFZhbHVlID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIGRlZmF1bHRWYWx1ZSAhPT0gXCJ1bmRlZmluZWRcIiA/IGRlZmF1bHRWYWx1ZSA6IFwiXCI7XG4gIH0sXG4gIHJlc2V0OiAoc3JjLCBrZXksIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICBzcmNba2V5XSA9IGRlZmF1bHRWYWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3JjW2tleV0gPSBcIlwiO1xuICAgIH1cbiAgfSxcbiAgY2xlYXI6IChzcmMsIGtleSkgPT4ge1xuICAgIHNyY1trZXldID0gXCJcIjtcbiAgfVxufSk7XG5cblR5cGVzLkFycmF5ID0gY3JlYXRlVHlwZSh7XG4gIGJhc2VUeXBlOiBBcnJheSxcbiAgY3JlYXRlOiBkZWZhdWx0VmFsdWUgPT4ge1xuICAgIGlmICh0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICByZXR1cm4gZGVmYXVsdFZhbHVlLnNsaWNlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFtdO1xuICB9LFxuICByZXNldDogKHNyYywga2V5LCBkZWZhdWx0VmFsdWUpID0+IHtcbiAgICBpZiAodHlwZW9mIGRlZmF1bHRWYWx1ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgc3JjW2tleV0gPSBkZWZhdWx0VmFsdWUuc2xpY2UoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3JjW2tleV0ubGVuZ3RoID0gMDtcbiAgICB9XG4gIH0sXG4gIGNsZWFyOiAoc3JjLCBrZXkpID0+IHtcbiAgICBzcmNba2V5XS5sZW5ndGggPSAwO1xuICB9LFxuICBjb3B5OiAoc3JjLCBkc3QsIGtleSkgPT4ge1xuICAgIHNyY1trZXldID0gZHN0W2tleV0uc2xpY2UoKTtcbiAgfVxufSk7XG5cbmV4cG9ydCB7IFR5cGVzIH07XG4iLCJpbXBvcnQgeyBUeXBlcyB9IGZyb20gXCIuL1N0YW5kYXJkVHlwZXNcIjtcblxuLyoqXG4gKiBUcnkgdG8gaW5mZXIgdGhlIHR5cGUgb2YgdGhlIHZhbHVlXG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKiBAcmV0dXJuIHtTdHJpbmd9IFR5cGUgb2YgdGhlIGF0dHJpYnV0ZVxuICovXG52YXIgc3RhbmRhcmRUeXBlcyA9IHtcbiAgbnVtYmVyOiBUeXBlcy5OdW1iZXIsXG4gIGJvb2xlYW46IFR5cGVzLkJvb2xlYW4sXG4gIHN0cmluZzogVHlwZXMuU3RyaW5nXG59O1xuXG5leHBvcnQgZnVuY3Rpb24gaW5mZXJUeXBlKHZhbHVlKSB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiBUeXBlcy5BcnJheTtcbiAgfVxuXG4gIGlmIChzdGFuZGFyZFR5cGVzW3R5cGVvZiB2YWx1ZV0pIHtcbiAgICByZXR1cm4gc3RhbmRhcmRUeXBlc1t0eXBlb2YgdmFsdWVdO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG4iLCJpbXBvcnQgeyBpbmZlclR5cGUgfSBmcm9tIFwiLi9JbmZlclR5cGVcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudChzY2hlbWEsIG5hbWUpIHtcbiAgLy92YXIgQ29tcG9uZW50ID0gbmV3IEZ1bmN0aW9uKGByZXR1cm4gZnVuY3Rpb24gJHtuYW1lfSgpIHt9YCkoKTtcbiAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgIGxldCB0eXBlID0gc2NoZW1hW2tleV0udHlwZTtcbiAgICBpZiAoIXR5cGUpIHtcbiAgICAgIHNjaGVtYVtrZXldLnR5cGUgPSBpbmZlclR5cGUoc2NoZW1hW2tleV0uZGVmYXVsdCk7XG4gICAgfVxuICB9XG5cbiAgdmFyIENvbXBvbmVudCA9IGZ1bmN0aW9uKCkge1xuICAgIGZvciAobGV0IGtleSBpbiBzY2hlbWEpIHtcbiAgICAgIHZhciBhdHRyID0gc2NoZW1hW2tleV07XG4gICAgICBsZXQgdHlwZSA9IGF0dHIudHlwZTtcbiAgICAgIGlmICh0eXBlICYmIHR5cGUuaXNUeXBlKSB7XG4gICAgICAgIHRoaXNba2V5XSA9IHR5cGUuY3JlYXRlKGF0dHIuZGVmYXVsdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzW2tleV0gPSBhdHRyLmRlZmF1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGlmICh0eXBlb2YgbmFtZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb21wb25lbnQsIFwibmFtZVwiLCB7IHZhbHVlOiBuYW1lIH0pO1xuICB9XG5cbiAgQ29tcG9uZW50LnByb3RvdHlwZS5zY2hlbWEgPSBzY2hlbWE7XG5cbiAgdmFyIGtub3duVHlwZXMgPSB0cnVlO1xuICBmb3IgKGxldCBrZXkgaW4gc2NoZW1hKSB7XG4gICAgdmFyIGF0dHIgPSBzY2hlbWFba2V5XTtcbiAgICBpZiAoIWF0dHIudHlwZSkge1xuICAgICAgYXR0ci50eXBlID0gaW5mZXJUeXBlKGF0dHIuZGVmYXVsdCk7XG4gICAgfVxuXG4gICAgdmFyIHR5cGUgPSBhdHRyLnR5cGU7XG4gICAgaWYgKCF0eXBlKSB7XG4gICAgICBjb25zb2xlLndhcm4oYFVua25vd24gdHlwZSBkZWZpbml0aW9uIGZvciBhdHRyaWJ1dGUgJyR7a2V5fSdgKTtcbiAgICAgIGtub3duVHlwZXMgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWtub3duVHlwZXMpIHtcbiAgICBjb25zb2xlLndhcm4oXG4gICAgICBgVGhpcyBjb21wb25lbnQgY2FuJ3QgdXNlIHBvb2xpbmcgYmVjYXVzZSBzb21lIGRhdGEgdHlwZXMgYXJlIG5vdCByZWdpc3RlcmVkLiBQbGVhc2UgcHJvdmlkZSBhIHR5cGUgY3JlYXRlZCB3aXRoICdjcmVhdGVUeXBlJ2BcbiAgICApO1xuXG4gICAgZm9yICh2YXIga2V5IGluIHNjaGVtYSkge1xuICAgICAgbGV0IGF0dHIgPSBzY2hlbWFba2V5XTtcbiAgICAgIENvbXBvbmVudC5wcm90b3R5cGVba2V5XSA9IGF0dHIuZGVmYXVsdDtcbiAgICB9XG5cbiAgICB2YXIgbm9wRnVuY3Rpb25zID0gW1wiY29weVwiLCBcInJlc2V0XCIsIFwiY2xlYXJcIl07XG5cbiAgICBub3BGdW5jdGlvbnMuZm9yRWFjaChmdW4gPT4ge1xuICAgICAgQ29tcG9uZW50LnByb3RvdHlwZVtmdW5dID0gKCkgPT4ge1xuICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgYCcke2Z1bn0nIGZ1bmN0aW9uIGlzIGEgbm9wIGZvciB0aGlzIGNvbXBvbmVudCBhcyB0aGUgdHlwZSBkZWZpbml0aW9uIG9mIHNvbWUgYXR0cmlidXRlcyBvbiB0aGUgc2NoZW1hIGFyZSB1bmtub3duLmBcbiAgICAgICAgKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24oc3JjKSB7XG4gICAgICBmb3IgKGxldCBrZXkgaW4gc2NoZW1hKSB7XG4gICAgICAgIGxldCB0eXBlID0gc2NoZW1hW2tleV0udHlwZTtcbiAgICAgICAgaWYgKHR5cGUuaXNTaW1wbGVUeXBlKSB7XG4gICAgICAgICAgdGhpc1trZXldID0gc3JjW2tleV07XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZS5jb3B5KSB7XG4gICAgICAgICAgdHlwZS5jb3B5KHRoaXMsIHNyYywga2V5KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBAdG9kbyBEZXRlY3QgdGhhdCBpdCdzIG5vdCBwb3NzaWJsZSB0byBjb3B5IGFsbCB0aGUgYXR0cmlidXRlc1xuICAgICAgICAgIC8vIGFuZCBqdXN0IGF2b2lkIGNyZWF0aW5nIHRoZSBjb3B5IGZ1bmN0aW9uXG4gICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgYFVua25vd24gY29weSBmdW5jdGlvbiBmb3IgYXR0cmlidXRlICcke2tleX0nIGRhdGEgdHlwZWBcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIENvbXBvbmVudC5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgIGZvciAobGV0IGtleSBpbiBzY2hlbWEpIHtcbiAgICAgICAgbGV0IGF0dHIgPSBzY2hlbWFba2V5XTtcbiAgICAgICAgbGV0IHR5cGUgPSBhdHRyLnR5cGU7XG4gICAgICAgIGlmICh0eXBlLnJlc2V0KSB0eXBlLnJlc2V0KHRoaXMsIGtleSwgYXR0ci5kZWZhdWx0KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICAgICAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgICAgICBsZXQgdHlwZSA9IHNjaGVtYVtrZXldLnR5cGU7XG4gICAgICAgIGlmICh0eXBlLmNsZWFyKSB0eXBlLmNsZWFyKHRoaXMsIGtleSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGZvciAobGV0IGtleSBpbiBzY2hlbWEpIHtcbiAgICAgIGxldCBhdHRyID0gc2NoZW1hW2tleV07XG4gICAgICBsZXQgdHlwZSA9IGF0dHIudHlwZTtcbiAgICAgIENvbXBvbmVudC5wcm90b3R5cGVba2V5XSA9IGF0dHIuZGVmYXVsdDtcblxuICAgICAgaWYgKHR5cGUucmVzZXQpIHtcbiAgICAgICAgdHlwZS5yZXNldChDb21wb25lbnQucHJvdG90eXBlLCBrZXksIGF0dHIuZGVmYXVsdCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIENvbXBvbmVudDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FBR0EsQUFBTyxNQUFNLGFBQWEsQ0FBQztFQUN6QixXQUFXLENBQUMsS0FBSyxFQUFFO0lBQ2pCLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO0lBQ2xCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0dBQ3BCOzs7Ozs7RUFNRCxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRTtJQUNqQyxJQUFJLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2hELE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDbkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUIsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ25CLE9BQU8sSUFBSSxDQUFDO0dBQ2I7O0VBRUQsV0FBVyxHQUFHO0lBQ1osSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLO01BQzFCLE9BQU8sQ0FBQyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztLQUNyRCxDQUFDLENBQUM7R0FDSjs7Ozs7O0VBTUQsWUFBWSxDQUFDLE1BQU0sRUFBRTtJQUNuQixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMs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LFdBQVc7TUFDckMsS0FBSyxJQUFJLEdBQUcsSUFBSSxNQUFNLEVBQUU7UUFDdEIsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUM1QixJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7T0FDdkM7S0FDRixDQUFDOztJQUVGLEtBQUssSUFBSSxHQUFHLElBQUksTUFBTSxFQUFFO01BQ3RCLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztNQUN2QixJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO01BQ3JCLFNBQVMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQzs7TUFFeEMsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO1FBQ2QsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7T0FDcEQ7S0FDRjtHQUNGOztFQUVELE9BQU8sU0FBUyxDQUFDO0NBQ2xCOzs7OyJ9
