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
    this.systems.push(new System(this.world, attributes));
    this.sortSystems();
    return this;
  }

  sortSystems() {
    this.systems.sort((a, b) => {
      return b.priority - a.priority;
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
      if (system.enabled) {
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

const proxyMap = new WeakMap();

const proxyHandler = {
  set(target, prop) {
    throw new Error(
      `Tried to write to "${target.constructor.name}#${String(
        prop
      )}" on immutable component. Use .getMutableComponent() to modify a component.`
    );
  }
};

function wrapImmutableComponent(T, component) {
  if (component === undefined) {
    return undefined;
  }

  let wrappedComponent = proxyMap.get(component);

  if (!wrappedComponent) {
    wrappedComponent = new Proxy(component, proxyHandler);
    proxyMap.set(component, wrappedComponent);
  }

  return wrappedComponent;
}

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
    return wrapImmutableComponent(Component, component);
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
  removeComponent(Component) {
    this._world.entityRemoveComponent(this, Component);
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
  removeAllComponents() {
    return this._world.entityRemoveAllComponents(this);
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
   * Dispose the entity from the world
   */
  dispose() {
    return this._world.removeEntity(this);
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

  /**
   * Callback when a component is added to an entity
   * @param {Entity} entity Entity that just got the new component
   * @param {Component} Component Component added to the entity
   */
  onEntityAdded(entity, Component) {
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
  onEntityRemoved(entity, Component) {
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

    this._queryManager.onEntityAdded(entity, Component);

    this.eventDispatcher.dispatchEvent(COMPONENT_ADDED, entity, Component);
  }

  /**
   * Remove a component from an entity
   * @param {Entity} entity Entity which will get removed the component
   * @param {*} Component Component to remove from the entity
   */
  entityRemoveComponent(entity, Component) {
    var index = entity._ComponentTypes.indexOf(Component);
    if (!~index) return;

    this.eventDispatcher.dispatchEvent(COMPONENT_REMOVE, entity, Component);

    // Check each indexed query to see if we need to remove it
    this._queryManager.onEntityRemoved(entity, Component);

    // Remove T listing on entity and property ref, then free the component.
    entity._ComponentTypes.splice(index, 1);
    var propName = componentPropertyName(Component);
    var componentName = getName(Component);
    var component = entity._components[componentName];
    delete entity._components[componentName];
    this.componentsManager._componentPool[propName].release(component);
  }

  /**
   * Remove all the components from an entity
   * @param {Entity} entity Entity from which the components will be removed
   */
  entityRemoveAllComponents(entity) {
    let Components = entity._ComponentTypes;

    for (let j = Components.length - 1; j >= 0; j--) {
      var C = Components[j];
      entity.removeComponent(C);
    }
  }

  /**
   * Remove the entity from this manager. It will clear also its components and tags
   * @param {Entity} entity Entity to remove from the manager
   */
  removeEntity(entity) {
    var index = this._entities.indexOf(entity);

    if (!~index) throw new Error("Tried to remove entity not in list");

    this.entityRemoveAllComponents(entity);

    // Remove from entity list
    this.eventDispatcher.dispatchEvent(ENTITY_REMOVE, entity);
    this._entities.splice(index, 1);

    // Remove entity from any tag groups and clear the on-entity ref
    entity._tags.length = 0;
    for (var tag in this._tags) {
      var entities = this._tags[tag];
      var n = entities.indexOf(entity);
      if (~n) entities.splice(n, 1);
    }

    // Prevent any acecss and free
    entity._world = null;
    this._entityPool.release(entity);
  }

  /**
   * Remove all entities from this manager
   */
  removeAllEntities() {
    for (var i = this._entities.length - 1; i >= 0; i--) {
      this._entities[i].dispose();
    }
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
      entity.dispose();
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
const ENTITY_REMOVE = "EntityManager#ENTITY_REMOVE";
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
  }

  /**
   * Register a component
   * @param {Component} Component Component to register
   */
  registerComponent(Component) {
    this.Components[Component.name] = Component;
  }

  /**
   * Register a singleton component
   * @param {Component} Component Component to register as singleton
   */
  registerSingletonComponent(Component) {
    this.SingletonComponents[Component.name] = Component;
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
    this.systemManager.execute(delta, time);
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
              EntityChanged: Query.prototype.ENTITY_CHANGED
            };

            if (eventMapping[event.event]) {
              query.eventDispatcher.addEventListener(
                eventMapping[event.event],
                entity => {
                  events[eventName].push(entity);
                }
              );
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9TeXN0ZW1NYW5hZ2VyLmpzIiwiLi4vc3JjL0V2ZW50RGlzcGF0Y2hlci5qcyIsIi4uL3NyYy9VdGlscy5qcyIsIi4uL3NyYy9RdWVyeS5qcyIsIi4uL3NyYy9XcmFwSW1tdXRhYmxlQ29tcG9uZW50LmpzIiwiLi4vc3JjL0VudGl0eS5qcyIsIi4uL3NyYy9PYmplY3RQb29sLmpzIiwiLi4vc3JjL1F1ZXJ5TWFuYWdlci5qcyIsIi4uL3NyYy9FbnRpdHlNYW5hZ2VyLmpzIiwiLi4vc3JjL0NvbXBvbmVudE1hbmFnZXIuanMiLCIuLi9zcmMvV29ybGQuanMiLCIuLi9zcmMvU3lzdGVtLmpzIiwiLi4vc3JjL1NjaGVtYVR5cGVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGNsYXNzIFN5c3RlbU1hbmFnZXJcbiAqL1xuZXhwb3J0IGNsYXNzIFN5c3RlbU1hbmFnZXIge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMuc3lzdGVtcyA9IFtdO1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIHN5c3RlbVxuICAgKiBAcGFyYW0ge1N5c3RlbX0gU3lzdGVtIFN5c3RlbSB0byByZWdpc3RlclxuICAgKi9cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtLCBhdHRyaWJ1dGVzKSB7XG4gICAgdGhpcy5zeXN0ZW1zLnB1c2gobmV3IFN5c3RlbSh0aGlzLndvcmxkLCBhdHRyaWJ1dGVzKSk7XG4gICAgdGhpcy5zb3J0U3lzdGVtcygpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc29ydFN5c3RlbXMoKSB7XG4gICAgdGhpcy5zeXN0ZW1zLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIHJldHVybiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBzeXN0ZW1cbiAgICogQHBhcmFtIHtTeXN0ZW19IFN5c3RlbSBTeXN0ZW0gdG8gcmVtb3ZlXG4gICAqL1xuICByZW1vdmVTeXN0ZW0oU3lzdGVtKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5zeXN0ZW1zLmluZGV4T2YoU3lzdGVtKTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgdGhpcy5zeXN0ZW1zLnNwbGljZShpbmRleCwgMSk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIGFsbCB0aGUgc3lzdGVtcy4gQ2FsbGVkIHBlciBmcmFtZS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbHRhIERlbHRhIHRpbWUgc2luY2UgdGhlIGxhc3QgZnJhbWVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHRpbWUgRWxhcHNlZCB0aW1lXG4gICAqL1xuICBleGVjdXRlKGRlbHRhLCB0aW1lKSB7XG4gICAgdGhpcy5zeXN0ZW1zLmZvckVhY2goc3lzdGVtID0+IHtcbiAgICAgIGlmIChzeXN0ZW0uZW5hYmxlZCkge1xuICAgICAgICBpZiAoc3lzdGVtLmV4ZWN1dGUpIHtcbiAgICAgICAgICBsZXQgc3RhcnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgICAgc3lzdGVtLmV4ZWN1dGUoZGVsdGEsIHRpbWUpO1xuICAgICAgICAgIHN5c3RlbS5leGVjdXRlVGltZSA9IHBlcmZvcm1hbmNlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICB9XG4gICAgICAgIHN5c3RlbS5jbGVhckV2ZW50cygpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzdGF0c1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge1xuICAgICAgbnVtU3lzdGVtczogdGhpcy5zeXN0ZW1zLmxlbmd0aCxcbiAgICAgIHN5c3RlbXM6IHt9XG4gICAgfTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5zeXN0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc3lzdGVtID0gdGhpcy5zeXN0ZW1zW2ldO1xuICAgICAgdmFyIHN5c3RlbVN0YXRzID0gKHN0YXRzLnN5c3RlbXNbc3lzdGVtLmNvbnN0cnVjdG9yLm5hbWVdID0ge1xuICAgICAgICBxdWVyaWVzOiB7fVxuICAgICAgfSk7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHN5c3RlbS5jdHgpIHtcbiAgICAgICAgc3lzdGVtU3RhdHMucXVlcmllc1tuYW1lXSA9IHN5c3RlbS5jdHhbbmFtZV0uc3RhdHMoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cbiIsIi8qKlxuICogQGNsYXNzIEV2ZW50RGlzcGF0Y2hlclxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFdmVudERpc3BhdGNoZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLl9saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLnN0YXRzID0ge1xuICAgICAgZmlyZWQ6IDAsXG4gICAgICBoYW5kbGVkOiAwXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBsaXN0ZW5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgdG8gdHJpZ2dlciB3aGVuIHRoZSBldmVudCBpcyBmaXJlZFxuICAgKi9cbiAgYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgbGV0IGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50TmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICB9XG5cbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihsaXN0ZW5lcikgPT09IC0xKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXS5wdXNoKGxpc3RlbmVyKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgYW4gZXZlbnQgbGlzdGVuZXIgaXMgYWxyZWFkeSBhZGRlZCB0byB0aGUgbGlzdCBvZiBsaXN0ZW5lcnNcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBjaGVja1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayBmb3IgdGhlIHNwZWNpZmllZCBldmVudFxuICAgKi9cbiAgaGFzRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdICE9PSB1bmRlZmluZWQgJiZcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdLmluZGV4T2YobGlzdGVuZXIpICE9PSAtMVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFuIGV2ZW50IGxpc3RlbmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50XG4gICAqL1xuICByZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICB2YXIgbGlzdGVuZXJBcnJheSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xuICAgIGlmIChsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBpbmRleCA9IGxpc3RlbmVyQXJyYXkuaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGxpc3RlbmVyQXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGlzcGF0Y2ggYW4gZXZlbnRcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBkaXNwYXRjaFxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IChPcHRpb25hbCkgRW50aXR5IHRvIGVtaXRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IGNvbXBvbmVudFxuICAgKi9cbiAgZGlzcGF0Y2hFdmVudChldmVudE5hbWUsIGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgdGhpcy5zdGF0cy5maXJlZCsrO1xuXG4gICAgdmFyIGxpc3RlbmVyQXJyYXkgPSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXTtcbiAgICBpZiAobGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgYXJyYXkgPSBsaXN0ZW5lckFycmF5LnNsaWNlKDApO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGFycmF5W2ldLmNhbGwodGhpcywgZW50aXR5LCBjb21wb25lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCBzdGF0cyBjb3VudGVyc1xuICAgKi9cbiAgcmVzZXRDb3VudGVycygpIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkID0gdGhpcy5zdGF0cy5oYW5kbGVkID0gMDtcbiAgfVxufVxuIiwiLyoqXG4gKiBSZXR1cm4gdGhlIG5hbWUgb2YgYSBjb21wb25lbnRcbiAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE5hbWUoQ29tcG9uZW50KSB7XG4gIHJldHVybiBDb21wb25lbnQubmFtZTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gYSB2YWxpZCBwcm9wZXJ0eSBuYW1lIGZvciB0aGUgQ29tcG9uZW50XG4gKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KSB7XG4gIHZhciBuYW1lID0gZ2V0TmFtZShDb21wb25lbnQpO1xuICByZXR1cm4gbmFtZS5jaGFyQXQoMCkudG9Mb3dlckNhc2UoKSArIG5hbWUuc2xpY2UoMSk7XG59XG5cbi8qKlxuICogR2V0IGEga2V5IGZyb20gYSBsaXN0IG9mIGNvbXBvbmVudHNcbiAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBBcnJheSBvZiBjb21wb25lbnRzIHRvIGdlbmVyYXRlIHRoZSBrZXlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1ZXJ5S2V5KENvbXBvbmVudHMpIHtcbiAgdmFyIG5hbWVzID0gW107XG4gIGZvciAodmFyIG4gPSAwOyBuIDwgQ29tcG9uZW50cy5sZW5ndGg7IG4rKykge1xuICAgIHZhciBUID0gQ29tcG9uZW50c1tuXTtcbiAgICBpZiAodHlwZW9mIFQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIHZhciBvcGVyYXRvciA9IFQub3BlcmF0b3IgPT09IFwibm90XCIgPyBcIiFcIiA6IFQub3BlcmF0b3I7XG4gICAgICBuYW1lcy5wdXNoKG9wZXJhdG9yICsgZ2V0TmFtZShULkNvbXBvbmVudCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lcy5wdXNoKGdldE5hbWUoVCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lc1xuICAgIC5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHgudG9Mb3dlckNhc2UoKTtcbiAgICB9KVxuICAgIC5zb3J0KClcbiAgICAuam9pbihcIi1cIik7XG59XG4iLCJpbXBvcnQgRXZlbnREaXNwYXRjaGVyIGZyb20gXCIuL0V2ZW50RGlzcGF0Y2hlci5qc1wiO1xuaW1wb3J0IHsgcXVlcnlLZXkgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG4vKipcbiAqIEBjbGFzcyBRdWVyeVxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBRdWVyeSB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgTGlzdCBvZiB0eXBlcyBvZiBjb21wb25lbnRzIHRvIHF1ZXJ5XG4gICAqL1xuICBjb25zdHJ1Y3RvcihDb21wb25lbnRzLCBtYW5hZ2VyKSB7XG4gICAgdGhpcy5Db21wb25lbnRzID0gW107XG4gICAgdGhpcy5Ob3RDb21wb25lbnRzID0gW107XG5cbiAgICBDb21wb25lbnRzLmZvckVhY2goY29tcG9uZW50ID0+IHtcbiAgICAgIGlmICh0eXBlb2YgY29tcG9uZW50ID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHRoaXMuTm90Q29tcG9uZW50cy5wdXNoKGNvbXBvbmVudC5Db21wb25lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5Db21wb25lbnRzLnB1c2goY29tcG9uZW50KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICh0aGlzLkNvbXBvbmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjcmVhdGUgYSBxdWVyeSB3aXRob3V0IGNvbXBvbmVudHNcIik7XG4gICAgfVxuXG4gICAgdGhpcy5lbnRpdGllcyA9IFtdO1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyID0gbmV3IEV2ZW50RGlzcGF0Y2hlcigpO1xuXG4gICAgLy8gVGhpcyBxdWVyeSBpcyBiZWluZyB1c2VkIGJ5IGEgcmVhY3RpdmUgc3lzdGVtXG4gICAgdGhpcy5yZWFjdGl2ZSA9IGZhbHNlO1xuXG4gICAgdGhpcy5rZXkgPSBxdWVyeUtleShDb21wb25lbnRzKTtcblxuICAgIC8vIEZpbGwgdGhlIHF1ZXJ5IHdpdGggdGhlIGV4aXN0aW5nIGVudGl0aWVzXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtYW5hZ2VyLl9lbnRpdGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGVudGl0eSA9IG1hbmFnZXIuX2VudGl0aWVzW2ldO1xuICAgICAgaWYgKHRoaXMubWF0Y2goZW50aXR5KSkge1xuICAgICAgICB0aGlzLmVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkIGVudGl0eSB0byB0aGlzIHF1ZXJ5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHlcbiAgICovXG4gIGFkZEVudGl0eShlbnRpdHkpIHtcbiAgICBlbnRpdHkucXVlcmllcy5wdXNoKHRoaXMpO1xuICAgIHRoaXMuZW50aXRpZXMucHVzaChlbnRpdHkpO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChRdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVELCBlbnRpdHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBlbnRpdHkgZnJvbSB0aGlzIHF1ZXJ5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZUVudGl0eShlbnRpdHkpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLmVudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcbiAgICBpZiAofmluZGV4KSB7XG4gICAgICB0aGlzLmVudGl0aWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgIGluZGV4ID0gZW50aXR5LnF1ZXJpZXMuaW5kZXhPZih0aGlzKTtcbiAgICAgIGVudGl0eS5xdWVyaWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoXG4gICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfUkVNT1ZFRCxcbiAgICAgICAgZW50aXR5XG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIG1hdGNoKGVudGl0eSkge1xuICAgIHZhciByZXN1bHQgPSB0cnVlO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLkNvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdCAmJiAhIX5lbnRpdHkuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YodGhpcy5Db21wb25lbnRzW2ldKTtcbiAgICB9XG5cbiAgICAvLyBOb3QgY29tcG9uZW50c1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5Ob3RDb21wb25lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHQgPVxuICAgICAgICByZXN1bHQgJiYgIX5lbnRpdHkuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YodGhpcy5Ob3RDb21wb25lbnRzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzdGF0cyBmb3IgdGhpcyBxdWVyeVxuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG51bUNvbXBvbmVudHM6IHRoaXMuQ29tcG9uZW50cy5sZW5ndGgsXG4gICAgICBudW1FbnRpdGllczogdGhpcy5lbnRpdGllcy5sZW5ndGhcbiAgICB9O1xuICB9XG59XG5cblF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQgPSBcIlF1ZXJ5I0VOVElUWV9BRERFRFwiO1xuUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVEID0gXCJRdWVyeSNFTlRJVFlfUkVNT1ZFRFwiO1xuUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VEID0gXCJRdWVyeSNDT01QT05FTlRfQ0hBTkdFRFwiO1xuIiwiY29uc3QgcHJveHlNYXAgPSBuZXcgV2Vha01hcCgpO1xuXG5jb25zdCBwcm94eUhhbmRsZXIgPSB7XG4gIHNldCh0YXJnZXQsIHByb3ApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgVHJpZWQgdG8gd3JpdGUgdG8gXCIke3RhcmdldC5jb25zdHJ1Y3Rvci5uYW1lfSMke1N0cmluZyhcbiAgICAgICAgcHJvcFxuICAgICAgKX1cIiBvbiBpbW11dGFibGUgY29tcG9uZW50LiBVc2UgLmdldE11dGFibGVDb21wb25lbnQoKSB0byBtb2RpZnkgYSBjb21wb25lbnQuYFxuICAgICk7XG4gIH1cbn07XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHdyYXBJbW11dGFibGVDb21wb25lbnQoVCwgY29tcG9uZW50KSB7XG4gIGlmIChjb21wb25lbnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBsZXQgd3JhcHBlZENvbXBvbmVudCA9IHByb3h5TWFwLmdldChjb21wb25lbnQpO1xuXG4gIGlmICghd3JhcHBlZENvbXBvbmVudCkge1xuICAgIHdyYXBwZWRDb21wb25lbnQgPSBuZXcgUHJveHkoY29tcG9uZW50LCBwcm94eUhhbmRsZXIpO1xuICAgIHByb3h5TWFwLnNldChjb21wb25lbnQsIHdyYXBwZWRDb21wb25lbnQpO1xuICB9XG5cbiAgcmV0dXJuIHdyYXBwZWRDb21wb25lbnQ7XG59XG4iLCJpbXBvcnQgUXVlcnkgZnJvbSBcIi4vUXVlcnkuanNcIjtcbmltcG9ydCB3cmFwSW1tdXRhYmxlQ29tcG9uZW50IGZyb20gXCIuL1dyYXBJbW11dGFibGVDb21wb25lbnQuanNcIjtcblxuLy8gQHRvZG8gVGFrZSB0aGlzIG91dCBmcm9tIHRoZXJlIG9yIHVzZSBFTlZcbmNvbnN0IERFQlVHID0gdHJ1ZTtcblxuLy8gQHRvZG8gcmVzZXQgaXQgYnkgd29ybGQ/XG52YXIgbmV4dElkID0gMDtcblxuLyoqXG4gKiBAY2xhc3MgRW50aXR5XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVudGl0eSB7XG4gIC8qKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQGNsYXNzIEVudGl0eVxuICAgKiBAcGFyYW0ge1dvcmxkfSB3b3JsZFxuICAgKi9cbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLl93b3JsZCA9IHdvcmxkIHx8IG51bGw7XG5cbiAgICAvLyBVbmlxdWUgSUQgZm9yIHRoaXMgZW50aXR5XG4gICAgdGhpcy5pZCA9IG5leHRJZCsrO1xuXG4gICAgLy8gTGlzdCBvZiBjb21wb25lbnRzIHR5cGVzIHRoZSBlbnRpdHkgaGFzXG4gICAgdGhpcy5fQ29tcG9uZW50VHlwZXMgPSBbXTtcblxuICAgIC8vIEluc3RhbmNlIG9mIHRoZSBjb21wb25lbnRzXG4gICAgdGhpcy5fY29tcG9uZW50cyA9IHt9O1xuXG4gICAgLy8gTGlzdCBvZiB0YWdzIHRoaXMgZW50aXR5IGhhc1xuICAgIHRoaXMuX3RhZ3MgPSBbXTtcblxuICAgIC8vIFF1ZXJpZXMgd2hlcmUgdGhlIGVudGl0eSBpcyBhZGRlZFxuICAgIHRoaXMucXVlcmllcyA9IFtdO1xuICB9XG5cbiAgLy8gQ09NUE9ORU5UU1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gYW4gaW1tdXRhYmxlIHJlZmVyZW5jZSBvZiBhIGNvbXBvbmVudFxuICAgKiBOb3RlOiBBIHByb3h5IHdpbGwgYmUgdXNlZCBvbiBkZWJ1ZyBtb2RlLCBhbmQgaXQgd2lsbCBqdXN0IGFmZmVjdFxuICAgKiAgICAgICB0aGUgZmlyc3QgbGV2ZWwgYXR0cmlidXRlcyBvbiB0aGUgb2JqZWN0LCBpdCB3b24ndCB3b3JrIHJlY3Vyc2l2ZWx5LlxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gVHlwZSBvZiBjb21wb25lbnQgdG8gZ2V0XG4gICAqIEByZXR1cm4ge0NvbXBvbmVudH0gSW1tdXRhYmxlIGNvbXBvbmVudCByZWZlcmVuY2VcbiAgICovXG4gIGdldENvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcy5fY29tcG9uZW50c1tDb21wb25lbnQubmFtZV07XG4gICAgaWYgKERFQlVHKSByZXR1cm4gd3JhcEltbXV0YWJsZUNvbXBvbmVudChDb21wb25lbnQsIGNvbXBvbmVudCk7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgfVxuXG4gIGdldENvbXBvbmVudHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudHM7XG4gIH1cblxuICBnZXRDb21wb25lbnRUeXBlcygpIHtcbiAgICByZXR1cm4gdGhpcy5fQ29tcG9uZW50VHlwZXM7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGEgbXV0YWJsZSByZWZlcmVuY2Ugb2YgYSBjb21wb25lbnQuXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBUeXBlIG9mIGNvbXBvbmVudCB0byBnZXRcbiAgICogQHJldHVybiB7Q29tcG9uZW50fSBNdXRhYmxlIGNvbXBvbmVudCByZWZlcmVuY2VcbiAgICovXG4gIGdldE11dGFibGVDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IHRoaXMuX2NvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5xdWVyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaV07XG4gICAgICBpZiAocXVlcnkucmVhY3RpdmUpIHtcbiAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoXG4gICAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgY29tcG9uZW50XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjb21wb25lbnQ7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgY29tcG9uZW50IHRvIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCB0byBhZGQgdG8gdGhpcyBlbnRpdHlcbiAgICogQHBhcmFtIHtPYmplY3R9IE9wdGlvbmFsIHZhbHVlcyB0byByZXBsYWNlIHRoZSBkZWZhdWx0IGF0dHJpYnV0ZXMgb24gdGhlIGNvbXBvbmVudFxuICAgKi9cbiAgYWRkQ29tcG9uZW50KENvbXBvbmVudCwgdmFsdWVzKSB7XG4gICAgdGhpcy5fd29ybGQuZW50aXR5QWRkQ29tcG9uZW50KHRoaXMsIENvbXBvbmVudCwgdmFsdWVzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBjb21wb25lbnQgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgdG8gcmVtb3ZlIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuX3dvcmxkLmVudGl0eVJlbW92ZUNvbXBvbmVudCh0aGlzLCBDb21wb25lbnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGEgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgdG8gY2hlY2tcbiAgICovXG4gIGhhc0NvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICByZXR1cm4gISF+dGhpcy5fQ29tcG9uZW50VHlwZXMuaW5kZXhPZihDb21wb25lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGEgbGlzdCBvZiBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyB0byBjaGVja1xuICAgKi9cbiAgaGFzQWxsQ29tcG9uZW50cyhDb21wb25lbnRzKSB7XG4gICAgdmFyIHJlc3VsdCA9IHRydWU7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IENvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdCAmJiAhIX50aGlzLl9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudHNbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0aGUgY29tcG9uZW50cyBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZUFsbENvbXBvbmVudHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dvcmxkLmVudGl0eVJlbW92ZUFsbENvbXBvbmVudHModGhpcyk7XG4gIH1cblxuICAvLyBUQUdTXG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGEgdGFnXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIGNoZWNrXG4gICAqL1xuICBoYXNUYWcodGFnKSB7XG4gICAgcmV0dXJuICEhfnRoaXMuX3RhZ3MuaW5kZXhPZih0YWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIHRhZyB0byB0aGlzIGVudGl0eVxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byBhZGQgdG8gdGhpcyBlbnRpdHlcbiAgICovXG4gIGFkZFRhZyh0YWcpIHtcbiAgICB0aGlzLl93b3JsZC5lbnRpdHlBZGRUYWcodGhpcywgdGFnKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSB0YWcgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZVRhZyh0YWcpIHtcbiAgICB0aGlzLl93b3JsZC5lbnRpdHlSZW1vdmVUYWcodGhpcywgdGFnKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIEVYVFJBU1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIHRoZSBlbnRpdHkuIFRvIGJlIHVzZWQgd2hlbiByZXR1cm5pbmcgYW4gZW50aXR5IHRvIHRoZSBwb29sXG4gICAqL1xuICBfX2luaXQoKSB7XG4gICAgdGhpcy5pZCA9IG5leHRJZCsrO1xuICAgIHRoaXMuX3dvcmxkID0gbnVsbDtcbiAgICB0aGlzLl9Db21wb25lbnRUeXBlcy5sZW5ndGggPSAwO1xuICAgIHRoaXMucXVlcmllcy5sZW5ndGggPSAwO1xuICAgIHRoaXMuX2NvbXBvbmVudHMgPSB7fTtcbiAgICB0aGlzLl90YWdzLmxlbmd0aCA9IDA7XG4gIH1cblxuICAvKipcbiAgICogRGlzcG9zZSB0aGUgZW50aXR5IGZyb20gdGhlIHdvcmxkXG4gICAqL1xuICBkaXNwb3NlKCkge1xuICAgIHJldHVybiB0aGlzLl93b3JsZC5yZW1vdmVFbnRpdHkodGhpcyk7XG4gIH1cbn1cbiIsIi8qKlxuICogQGNsYXNzIE9iamVjdFBvb2xcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgT2JqZWN0UG9vbCB7XG4gIGNvbnN0cnVjdG9yKFQpIHtcbiAgICB0aGlzLmZyZWVMaXN0ID0gW107XG4gICAgdGhpcy5jb3VudCA9IDA7XG4gICAgdGhpcy5UID0gVDtcblxuICAgIHZhciBleHRyYUFyZ3MgPSBudWxsO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgZXh0cmFBcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIGV4dHJhQXJncy5zaGlmdCgpO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRlRWxlbWVudCA9IGV4dHJhQXJnc1xuICAgICAgPyAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBUKC4uLmV4dHJhQXJncyk7XG4gICAgICAgIH1cbiAgICAgIDogKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgVCgpO1xuICAgICAgICB9O1xuXG4gICAgdGhpcy5pbml0aWFsT2JqZWN0ID0gdGhpcy5jcmVhdGVFbGVtZW50KCk7XG4gIH1cblxuICBhcXVpcmUoKSB7XG4gICAgLy8gR3JvdyB0aGUgbGlzdCBieSAyMCVpc2ggaWYgd2UncmUgb3V0XG4gICAgaWYgKHRoaXMuZnJlZUxpc3QubGVuZ3RoIDw9IDApIHtcbiAgICAgIHRoaXMuZXhwYW5kKE1hdGgucm91bmQodGhpcy5jb3VudCAqIDAuMikgKyAxKTtcbiAgICB9XG5cbiAgICB2YXIgaXRlbSA9IHRoaXMuZnJlZUxpc3QucG9wKCk7XG5cbiAgICAvLyBXZSBjYW4gcHJvdmlkZSBleHBsaWNpdCBpbml0aW5nLCBvdGhlcndpc2Ugd2UgY29weSB0aGUgdmFsdWUgb2YgdGhlIGluaXRpYWwgY29tcG9uZW50XG4gICAgaWYgKGl0ZW0uX19pbml0KSBpdGVtLl9faW5pdCgpO1xuICAgIGVsc2UgaWYgKGl0ZW0uY29weSkgaXRlbS5jb3B5KHRoaXMuaW5pdGlhbE9iamVjdCk7XG5cbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuXG4gIHJlbGVhc2UoaXRlbSkge1xuICAgIHRoaXMuZnJlZUxpc3QucHVzaChpdGVtKTtcbiAgfVxuXG4gIGV4cGFuZChjb3VudCkge1xuICAgIGZvciAodmFyIG4gPSAwOyBuIDwgY291bnQ7IG4rKykge1xuICAgICAgdGhpcy5mcmVlTGlzdC5wdXNoKHRoaXMuY3JlYXRlRWxlbWVudCgpKTtcbiAgICB9XG4gICAgdGhpcy5jb3VudCArPSBjb3VudDtcbiAgfVxuXG4gIHRvdGFsU2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb3VudDtcbiAgfVxuXG4gIHRvdGFsRnJlZSgpIHtcbiAgICByZXR1cm4gdGhpcy5mcmVlTGlzdC5sZW5ndGg7XG4gIH1cblxuICB0b3RhbFVzZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuY291bnQgLSB0aGlzLmZyZWVMaXN0Lmxlbmd0aDtcbiAgfVxufVxuIiwiaW1wb3J0IFF1ZXJ5IGZyb20gXCIuL1F1ZXJ5LmpzXCI7XG5pbXBvcnQgeyBxdWVyeUtleSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIFF1ZXJ5TWFuYWdlclxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBRdWVyeU1hbmFnZXIge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMuX3dvcmxkID0gd29ybGQ7XG5cbiAgICAvLyBRdWVyaWVzIGluZGV4ZWQgYnkgYSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIGNvbXBvbmVudHMgaXQgaGFzXG4gICAgdGhpcy5fcXVlcmllcyA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdoZW4gYSBjb21wb25lbnQgaXMgYWRkZWQgdG8gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRoYXQganVzdCBnb3QgdGhlIG5ldyBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgYWRkZWQgdG8gdGhlIGVudGl0eVxuICAgKi9cbiAgb25FbnRpdHlBZGRlZChlbnRpdHksIENvbXBvbmVudCkge1xuICAgIC8vIEB0b2RvIFVzZSBiaXRtYXNrIGZvciBjaGVja2luZyBjb21wb25lbnRzP1xuXG4gICAgLy8gQ2hlY2sgZWFjaCBpbmRleGVkIHF1ZXJ5IHRvIHNlZSBpZiB3ZSBuZWVkIHRvIGFkZCB0aGlzIGVudGl0eSB0byB0aGUgbGlzdFxuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIGlmIChcbiAgICAgICAgISF+cXVlcnkuTm90Q29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgICAgfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIHF1ZXJ5LnJlbW92ZUVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIHRoZSBlbnRpdHkgb25seSBpZjpcbiAgICAgIC8vIENvbXBvbmVudCBpcyBpbiB0aGUgcXVlcnlcbiAgICAgIC8vIGFuZCBFbnRpdHkgaGFzIEFMTCB0aGUgY29tcG9uZW50cyBvZiB0aGUgcXVlcnlcbiAgICAgIC8vIGFuZCBFbnRpdHkgaXMgbm90IGFscmVhZHkgaW4gdGhlIHF1ZXJ5XG4gICAgICBpZiAoXG4gICAgICAgICF+cXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgfHxcbiAgICAgICAgIXF1ZXJ5Lm1hdGNoKGVudGl0eSkgfHxcbiAgICAgICAgfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KVxuICAgICAgKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgcXVlcnkuYWRkRW50aXR5KGVudGl0eSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdoZW4gYSBjb21wb25lbnQgaXMgcmVtb3ZlZCBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBmcm9tXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIG9uRW50aXR5UmVtb3ZlZChlbnRpdHksIENvbXBvbmVudCkge1xuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIGlmIChcbiAgICAgICAgISF+cXVlcnkuTm90Q29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgICAgIX5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSlcbiAgICAgICkge1xuICAgICAgICBxdWVyeS5hZGRFbnRpdHkoZW50aXR5KTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghfnF1ZXJ5LkNvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpKSBjb250aW51ZTtcbiAgICAgIGlmICghcXVlcnkubWF0Y2goZW50aXR5KSkgY29udGludWU7XG5cbiAgICAgIHF1ZXJ5LnJlbW92ZUVudGl0eShlbnRpdHkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBxdWVyeSBmb3IgdGhlIHNwZWNpZmllZCBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRzIENvbXBvbmVudHMgdGhhdCB0aGUgcXVlcnkgc2hvdWxkIGhhdmVcbiAgICovXG4gIGdldFF1ZXJ5KENvbXBvbmVudHMpIHtcbiAgICB2YXIga2V5ID0gcXVlcnlLZXkoQ29tcG9uZW50cyk7XG4gICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1trZXldO1xuICAgIGlmICghcXVlcnkpIHtcbiAgICAgIHRoaXMuX3F1ZXJpZXNba2V5XSA9IHF1ZXJ5ID0gbmV3IFF1ZXJ5KENvbXBvbmVudHMsIHRoaXMuX3dvcmxkKTtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzb21lIHN0YXRzIGZyb20gdGhpcyBjbGFzc1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge307XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHN0YXRzW3F1ZXJ5TmFtZV0gPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV0uc3RhdHMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG4iLCJpbXBvcnQgRW50aXR5IGZyb20gXCIuL0VudGl0eS5qc1wiO1xuaW1wb3J0IE9iamVjdFBvb2wgZnJvbSBcIi4vT2JqZWN0UG9vbC5qc1wiO1xuaW1wb3J0IFF1ZXJ5TWFuYWdlciBmcm9tIFwiLi9RdWVyeU1hbmFnZXIuanNcIjtcbmltcG9ydCBFdmVudERpc3BhdGNoZXIgZnJvbSBcIi4vRXZlbnREaXNwYXRjaGVyLmpzXCI7XG5pbXBvcnQgeyBjb21wb25lbnRQcm9wZXJ0eU5hbWUsIGdldE5hbWUgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG4vKipcbiAqIEBjbGFzcyBFbnRpdHlNYW5hZ2VyXG4gKi9cbmV4cG9ydCBjbGFzcyBFbnRpdHlNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlciA9IHdvcmxkLmNvbXBvbmVudHNNYW5hZ2VyO1xuXG4gICAgLy8gQWxsIHRoZSBlbnRpdGllcyBpbiB0aGlzIGluc3RhbmNlXG4gICAgdGhpcy5fZW50aXRpZXMgPSBbXTtcblxuICAgIC8vIE1hcCBiZXR3ZWVuIHRhZyBhbmQgZW50aXRpZXNcbiAgICB0aGlzLl90YWdzID0ge307XG5cbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIgPSBuZXcgUXVlcnlNYW5hZ2VyKHRoaXMpO1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyID0gbmV3IEV2ZW50RGlzcGF0Y2hlcigpO1xuICAgIHRoaXMuX2VudGl0eVBvb2wgPSBuZXcgT2JqZWN0UG9vbChFbnRpdHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBlbnRpdHlcbiAgICovXG4gIGNyZWF0ZUVudGl0eSgpIHtcbiAgICB2YXIgZW50aXR5ID0gdGhpcy5fZW50aXR5UG9vbC5hcXVpcmUoKTtcbiAgICBlbnRpdHkuX3dvcmxkID0gdGhpcztcbiAgICB0aGlzLl9lbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChFTlRJVFlfQ1JFQVRFRCwgZW50aXR5KTtcbiAgICByZXR1cm4gZW50aXR5O1xuICB9XG5cbiAgLy8gQ09NUE9ORU5UU1xuXG4gIC8qKlxuICAgKiBBZGQgYSBjb21wb25lbnQgdG8gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHdoZXJlIHRoZSBjb21wb25lbnQgd2lsbCBiZSBhZGRlZFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCB0byBiZSBhZGRlZCB0byB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZXMgT3B0aW9uYWwgdmFsdWVzIHRvIHJlcGxhY2UgdGhlIGRlZmF1bHQgYXR0cmlidXRlc1xuICAgKi9cbiAgZW50aXR5QWRkQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50LCB2YWx1ZXMpIHtcbiAgICBpZiAofmVudGl0eS5fQ29tcG9uZW50VHlwZXMuaW5kZXhPZihDb21wb25lbnQpKSByZXR1cm47XG5cbiAgICBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLnB1c2goQ29tcG9uZW50KTtcblxuICAgIHZhciBjb21wb25lbnRQb29sID0gdGhpcy53b3JsZC5jb21wb25lbnRzTWFuYWdlci5nZXRDb21wb25lbnRzUG9vbChcbiAgICAgIENvbXBvbmVudFxuICAgICk7XG4gICAgdmFyIGNvbXBvbmVudCA9IGNvbXBvbmVudFBvb2wuYXF1aXJlKCk7XG5cbiAgICBlbnRpdHkuX2NvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gY29tcG9uZW50O1xuXG4gICAgaWYgKHZhbHVlcykge1xuICAgICAgaWYgKGNvbXBvbmVudC5jb3B5KSB7XG4gICAgICAgIGNvbXBvbmVudC5jb3B5KHZhbHVlcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKHZhciBuYW1lIGluIHZhbHVlcykge1xuICAgICAgICAgIGNvbXBvbmVudFtuYW1lXSA9IHZhbHVlc1tuYW1lXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX3F1ZXJ5TWFuYWdlci5vbkVudGl0eUFkZGVkKGVudGl0eSwgQ29tcG9uZW50KTtcblxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoQ09NUE9ORU5UX0FEREVELCBlbnRpdHksIENvbXBvbmVudCk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgY29tcG9uZW50IGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHdoaWNoIHdpbGwgZ2V0IHJlbW92ZWQgdGhlIGNvbXBvbmVudFxuICAgKiBAcGFyYW0geyp9IENvbXBvbmVudCBDb21wb25lbnQgdG8gcmVtb3ZlIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgZW50aXR5UmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgdmFyIGluZGV4ID0gZW50aXR5Ll9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCk7XG4gICAgaWYgKCF+aW5kZXgpIHJldHVybjtcblxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoQ09NUE9ORU5UX1JFTU9WRSwgZW50aXR5LCBDb21wb25lbnQpO1xuXG4gICAgLy8gQ2hlY2sgZWFjaCBpbmRleGVkIHF1ZXJ5IHRvIHNlZSBpZiB3ZSBuZWVkIHRvIHJlbW92ZSBpdFxuICAgIHRoaXMuX3F1ZXJ5TWFuYWdlci5vbkVudGl0eVJlbW92ZWQoZW50aXR5LCBDb21wb25lbnQpO1xuXG4gICAgLy8gUmVtb3ZlIFQgbGlzdGluZyBvbiBlbnRpdHkgYW5kIHByb3BlcnR5IHJlZiwgdGhlbiBmcmVlIHRoZSBjb21wb25lbnQuXG4gICAgZW50aXR5Ll9Db21wb25lbnRUeXBlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIHZhciBwcm9wTmFtZSA9IGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpO1xuICAgIHZhciBjb21wb25lbnROYW1lID0gZ2V0TmFtZShDb21wb25lbnQpO1xuICAgIHZhciBjb21wb25lbnQgPSBlbnRpdHkuX2NvbXBvbmVudHNbY29tcG9uZW50TmFtZV07XG4gICAgZGVsZXRlIGVudGl0eS5fY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLl9jb21wb25lbnRQb29sW3Byb3BOYW1lXS5yZWxlYXNlKGNvbXBvbmVudCk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0aGUgY29tcG9uZW50cyBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSBmcm9tIHdoaWNoIHRoZSBjb21wb25lbnRzIHdpbGwgYmUgcmVtb3ZlZFxuICAgKi9cbiAgZW50aXR5UmVtb3ZlQWxsQ29tcG9uZW50cyhlbnRpdHkpIHtcbiAgICBsZXQgQ29tcG9uZW50cyA9IGVudGl0eS5fQ29tcG9uZW50VHlwZXM7XG5cbiAgICBmb3IgKGxldCBqID0gQ29tcG9uZW50cy5sZW5ndGggLSAxOyBqID49IDA7IGotLSkge1xuICAgICAgdmFyIEMgPSBDb21wb25lbnRzW2pdO1xuICAgICAgZW50aXR5LnJlbW92ZUNvbXBvbmVudChDKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBlbnRpdHkgZnJvbSB0aGlzIG1hbmFnZXIuIEl0IHdpbGwgY2xlYXIgYWxzbyBpdHMgY29tcG9uZW50cyBhbmQgdGFnc1xuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0byByZW1vdmUgZnJvbSB0aGUgbWFuYWdlclxuICAgKi9cbiAgcmVtb3ZlRW50aXR5KGVudGl0eSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuX2VudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcblxuICAgIGlmICghfmluZGV4KSB0aHJvdyBuZXcgRXJyb3IoXCJUcmllZCB0byByZW1vdmUgZW50aXR5IG5vdCBpbiBsaXN0XCIpO1xuXG4gICAgdGhpcy5lbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKGVudGl0eSk7XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBlbnRpdHkgbGlzdFxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoRU5USVRZX1JFTU9WRSwgZW50aXR5KTtcbiAgICB0aGlzLl9lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgLy8gUmVtb3ZlIGVudGl0eSBmcm9tIGFueSB0YWcgZ3JvdXBzIGFuZCBjbGVhciB0aGUgb24tZW50aXR5IHJlZlxuICAgIGVudGl0eS5fdGFncy5sZW5ndGggPSAwO1xuICAgIGZvciAodmFyIHRhZyBpbiB0aGlzLl90YWdzKSB7XG4gICAgICB2YXIgZW50aXRpZXMgPSB0aGlzLl90YWdzW3RhZ107XG4gICAgICB2YXIgbiA9IGVudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcbiAgICAgIGlmICh+bikgZW50aXRpZXMuc3BsaWNlKG4sIDEpO1xuICAgIH1cblxuICAgIC8vIFByZXZlbnQgYW55IGFjZWNzcyBhbmQgZnJlZVxuICAgIGVudGl0eS5fd29ybGQgPSBudWxsO1xuICAgIHRoaXMuX2VudGl0eVBvb2wucmVsZWFzZShlbnRpdHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbGwgZW50aXRpZXMgZnJvbSB0aGlzIG1hbmFnZXJcbiAgICovXG4gIHJlbW92ZUFsbEVudGl0aWVzKCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLl9lbnRpdGllcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdGhpcy5fZW50aXRpZXNbaV0uZGlzcG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRBR1NcblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0aGUgZW50aXRpZXMgdGhhdCBoYXMgdGhlIHNwZWNpZmllZCB0YWdcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZyBUYWcgdG8gZmlsdGVyIHRoZSBlbnRpdGllcyB0byBiZSByZW1vdmVkXG4gICAqL1xuICByZW1vdmVFbnRpdGllc0J5VGFnKHRhZykge1xuICAgIHZhciBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXTtcblxuICAgIGlmICghZW50aXRpZXMpIHJldHVybjtcblxuICAgIGZvciAodmFyIHggPSBlbnRpdGllcy5sZW5ndGggLSAxOyB4ID49IDA7IHgtLSkge1xuICAgICAgdmFyIGVudGl0eSA9IGVudGl0aWVzW3hdO1xuICAgICAgZW50aXR5LmRpc3Bvc2UoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkIHRhZyB0byBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hpY2ggd2lsbCBnZXQgdGhlIHRhZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byBhZGQgdG8gdGhlIGVudGl0eVxuICAgKi9cbiAgZW50aXR5QWRkVGFnKGVudGl0eSwgdGFnKSB7XG4gICAgdmFyIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddO1xuXG4gICAgaWYgKCFlbnRpdGllcykgZW50aXRpZXMgPSB0aGlzLl90YWdzW3RhZ10gPSBbXTtcblxuICAgIC8vIERvbid0IGFkZCBpZiBhbHJlYWR5IHRoZXJlXG4gICAgaWYgKH5lbnRpdGllcy5pbmRleE9mKGVudGl0eSkpIHJldHVybjtcblxuICAgIC8vIEFkZCB0byBvdXIgdGFnIGluZGV4IEFORCB0aGUgbGlzdCBvbiB0aGUgZW50aXR5XG4gICAgZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgIGVudGl0eS5fdGFncy5wdXNoKHRhZyk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgdGFnIGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRoYXQgd2lsbCBnZXQgcmVtb3ZlZCB0aGUgdGFnXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIHJlbW92ZVxuICAgKi9cbiAgZW50aXR5UmVtb3ZlVGFnKGVudGl0eSwgdGFnKSB7XG4gICAgdmFyIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddO1xuICAgIGlmICghZW50aXRpZXMpIHJldHVybjtcblxuICAgIHZhciBpbmRleCA9IGVudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgLy8gUmVtb3ZlIGZyb20gb3VyIGluZGV4IEFORCB0aGUgbGlzdCBvbiB0aGUgZW50aXR5XG4gICAgZW50aXRpZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICBlbnRpdHkuX3RhZ3Muc3BsaWNlKGVudGl0eS5fdGFncy5pbmRleE9mKHRhZyksIDEpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHF1ZXJ5IGJhc2VkIG9uIGEgbGlzdCBvZiBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBMaXN0IG9mIGNvbXBvbmVudHMgdGhhdCB3aWxsIGZvcm0gdGhlIHF1ZXJ5XG4gICAqL1xuICBxdWVyeUNvbXBvbmVudHMoQ29tcG9uZW50cykge1xuICAgIHJldHVybiB0aGlzLl9xdWVyeU1hbmFnZXIuZ2V0UXVlcnkoQ29tcG9uZW50cyk7XG4gIH1cblxuICAvLyBFWFRSQVNcblxuICAvKipcbiAgICogUmV0dXJuIG51bWJlciBvZiBlbnRpdGllc1xuICAgKi9cbiAgY291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2VudGl0aWVzLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc29tZSBzdGF0c1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge1xuICAgICAgbnVtRW50aXRpZXM6IHRoaXMuX2VudGl0aWVzLmxlbmd0aCxcbiAgICAgIG51bVF1ZXJpZXM6IE9iamVjdC5rZXlzKHRoaXMuX3F1ZXJ5TWFuYWdlci5fcXVlcmllcykubGVuZ3RoLFxuICAgICAgcXVlcmllczogdGhpcy5fcXVlcnlNYW5hZ2VyLnN0YXRzKCksXG4gICAgICBudW1Db21wb25lbnRQb29sOiBPYmplY3Qua2V5cyh0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLl9jb21wb25lbnRQb29sKVxuICAgICAgICAubGVuZ3RoLFxuICAgICAgY29tcG9uZW50UG9vbDoge30sXG4gICAgICBldmVudERpc3BhdGNoZXI6IHRoaXMuZXZlbnREaXNwYXRjaGVyLnN0YXRzXG4gICAgfTtcblxuICAgIGZvciAodmFyIGNuYW1lIGluIHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2wpIHtcbiAgICAgIHZhciBwb29sID0gdGhpcy5jb21wb25lbnRzTWFuYWdlci5fY29tcG9uZW50UG9vbFtjbmFtZV07XG4gICAgICBzdGF0cy5jb21wb25lbnRQb29sW2NuYW1lXSA9IHtcbiAgICAgICAgdXNlZDogcG9vbC50b3RhbFVzZWQoKSxcbiAgICAgICAgc2l6ZTogcG9vbC5jb3VudFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cblxuY29uc3QgRU5USVRZX0NSRUFURUQgPSBcIkVudGl0eU1hbmFnZXIjRU5USVRZX0NSRUFURVwiO1xuY29uc3QgRU5USVRZX1JFTU9WRSA9IFwiRW50aXR5TWFuYWdlciNFTlRJVFlfUkVNT1ZFXCI7XG5jb25zdCBDT01QT05FTlRfQURERUQgPSBcIkVudGl0eU1hbmFnZXIjQ09NUE9ORU5UX0FEREVEXCI7XG5jb25zdCBDT01QT05FTlRfUkVNT1ZFID0gXCJFbnRpdHlNYW5hZ2VyI0NPTVBPTkVOVF9SRU1PVkVcIjtcbiIsImltcG9ydCBPYmplY3RQb29sIGZyb20gXCIuL09iamVjdFBvb2wuanNcIjtcbmltcG9ydCB7IGNvbXBvbmVudFByb3BlcnR5TmFtZSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIENvbXBvbmVudE1hbmFnZXJcbiAqL1xuZXhwb3J0IGNsYXNzIENvbXBvbmVudE1hbmFnZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLkNvbXBvbmVudHMgPSB7fTtcbiAgICB0aGlzLlNpbmdsZXRvbkNvbXBvbmVudHMgPSB7fTtcbiAgICB0aGlzLl9jb21wb25lbnRQb29sID0ge307XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gcmVnaXN0ZXJcbiAgICovXG4gIHJlZ2lzdGVyQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBDb21wb25lbnQ7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzaW5nbGV0b24gY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlZ2lzdGVyIGFzIHNpbmdsZXRvblxuICAgKi9cbiAgcmVnaXN0ZXJTaW5nbGV0b25Db21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5TaW5nbGV0b25Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IENvbXBvbmVudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY29tcG9uZW50cyBwb29sXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgVHlwZSBvZiBjb21wb25lbnQgdHlwZSBmb3IgdGhlIHBvb2xcbiAgICovXG4gIGdldENvbXBvbmVudHNQb29sKENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnROYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG5cbiAgICBpZiAoIXRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0pIHtcbiAgICAgIHRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0gPSBuZXcgT2JqZWN0UG9vbChDb21wb25lbnQpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdO1xuICB9XG59XG4iLCJpbXBvcnQgeyBTeXN0ZW1NYW5hZ2VyIH0gZnJvbSBcIi4vU3lzdGVtTWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgRW50aXR5TWFuYWdlciB9IGZyb20gXCIuL0VudGl0eU1hbmFnZXIuanNcIjtcbmltcG9ydCB7IENvbXBvbmVudE1hbmFnZXIgfSBmcm9tIFwiLi9Db21wb25lbnRNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBjb21wb25lbnRQcm9wZXJ0eU5hbWUgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcblxuLyoqXG4gKiBAY2xhc3MgV29ybGRcbiAqL1xuZXhwb3J0IGNsYXNzIFdvcmxkIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlciA9IG5ldyBDb21wb25lbnRNYW5hZ2VyKHRoaXMpO1xuICAgIHRoaXMuZW50aXR5TWFuYWdlciA9IG5ldyBFbnRpdHlNYW5hZ2VyKHRoaXMpO1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlciA9IG5ldyBTeXN0ZW1NYW5hZ2VyKHRoaXMpO1xuXG4gICAgLy8gU3RvcmFnZSBmb3Igc2luZ2xldG9uIGNvbXBvbmVudHNcbiAgICB0aGlzLmNvbXBvbmVudHMgPSB7fTtcblxuICAgIHRoaXMuZXZlbnRRdWV1ZXMgPSB7fTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlciA9IG5ldyBFdmVudERpc3BhdGNoZXIoKTtcblxuICAgIGlmICh0eXBlb2YgQ3VzdG9tRXZlbnQgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHZhciBldmVudCA9IG5ldyBDdXN0b21FdmVudChcImVjc3ktd29ybGQtY3JlYXRlZFwiLCB7IGRldGFpbDogdGhpcyB9KTtcbiAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgICB9XG4gIH1cblxuICBlbWl0RXZlbnQoZXZlbnROYW1lLCBkYXRhKSB7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChldmVudE5hbWUsIGRhdGEpO1xuICB9XG5cbiAgYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzaW5nbGV0b24gY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgU2luZ2xldG9uIGNvbXBvbmVudFxuICAgKi9cbiAgcmVnaXN0ZXJTaW5nbGV0b25Db21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5yZWdpc3RlclNpbmdsZXRvbkNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIHRoaXMuY29tcG9uZW50c1tjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KV0gPSBuZXcgQ29tcG9uZW50KCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICAgKi9cbiAgcmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5yZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgc3lzdGVtXG4gICAqIEBwYXJhbSB7U3lzdGVtfSBTeXN0ZW1cbiAgICovXG4gIHJlZ2lzdGVyU3lzdGVtKFN5c3RlbSwgYXR0cmlidXRlcykge1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlci5yZWdpc3RlclN5c3RlbShTeXN0ZW0sIGF0dHJpYnV0ZXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgc3lzdGVtcyBwZXIgZnJhbWVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbHRhIERlbHRhIHRpbWUgc2luY2UgdGhlIGxhc3QgY2FsbFxuICAgKiBAcGFyYW0ge051bWJlcn0gdGltZSBFbGFwc2VkIHRpbWVcbiAgICovXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUpIHtcbiAgICB0aGlzLnN5c3RlbU1hbmFnZXIuZXhlY3V0ZShkZWx0YSwgdGltZSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGVudGl0eVxuICAgKi9cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLmVudGl0eU1hbmFnZXIuY3JlYXRlRW50aXR5KCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHNvbWUgc3RhdHNcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIGVudGl0aWVzOiB0aGlzLmVudGl0eU1hbmFnZXIuc3RhdHMoKSxcbiAgICAgIHN5c3RlbTogdGhpcy5zeXN0ZW1NYW5hZ2VyLnN0YXRzKClcbiAgICB9O1xuXG4gICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoc3RhdHMsIG51bGwsIDIpKTtcbiAgfVxufVxuIiwiLyoqXG4gKiBAY2xhc3MgU3lzdGVtXG4gKi9cbmltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgU3lzdGVtIHtcbiAgdG9KU09OKCkge1xuICAgIHZhciBqc29uID0ge1xuICAgICAgbmFtZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgZW5hYmxlZDogdGhpcy5lbmFibGVkLFxuICAgICAgZXhlY3V0ZVRpbWU6IHRoaXMuZXhlY3V0ZVRpbWUsXG4gICAgICBwcmlvcml0eTogdGhpcy5wcmlvcml0eSxcbiAgICAgIHF1ZXJpZXM6IHt9LFxuICAgICAgZXZlbnRzOiB7fVxuICAgIH07XG5cbiAgICBpZiAodGhpcy5jb25maWcpIHtcbiAgICAgIHZhciBxdWVyaWVzID0gdGhpcy5jb25maWcucXVlcmllcztcbiAgICAgIGZvciAobGV0IHF1ZXJ5TmFtZSBpbiBxdWVyaWVzKSB7XG4gICAgICAgIGxldCBxdWVyeSA9IHF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAganNvbi5xdWVyaWVzW3F1ZXJ5TmFtZV0gPSB7XG4gICAgICAgICAga2V5OiB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV0ua2V5XG4gICAgICAgIH07XG4gICAgICAgIGlmIChxdWVyeS5ldmVudHMpIHtcbiAgICAgICAgICBsZXQgZXZlbnRzID0gKGpzb24ucXVlcmllc1txdWVyeU5hbWVdW1wiZXZlbnRzXCJdID0ge30pO1xuICAgICAgICAgIGZvciAobGV0IGV2ZW50TmFtZSBpbiBxdWVyeS5ldmVudHMpIHtcbiAgICAgICAgICAgIGxldCBldmVudCA9IHF1ZXJ5LmV2ZW50c1tldmVudE5hbWVdO1xuICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0gPSB7XG4gICAgICAgICAgICAgIGV2ZW50TmFtZTogZXZlbnQuZXZlbnQsXG4gICAgICAgICAgICAgIG51bUVudGl0aWVzOiB0aGlzLmV2ZW50c1txdWVyeU5hbWVdW2V2ZW50TmFtZV0ubGVuZ3RoXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGV2ZW50LmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0uY29tcG9uZW50cyA9IGV2ZW50LmNvbXBvbmVudHMubWFwKGMgPT4gYy5uYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbGV0IGV2ZW50cyA9IHRoaXMuY29uZmlnLmV2ZW50cztcbiAgICAgIGZvciAobGV0IGV2ZW50TmFtZSBpbiBldmVudHMpIHtcbiAgICAgICAganNvbi5ldmVudHNbZXZlbnROYW1lXSA9IHtcbiAgICAgICAgICBldmVudE5hbWU6IGV2ZW50c1tldmVudE5hbWVdXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGpzb247XG4gIH1cblxuICBjb25zdHJ1Y3Rvcih3b3JsZCwgYXR0cmlidXRlcykge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgLy8gQHRvZG8gQmV0dGVyIG5hbWluZyA6KVxuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgICB0aGlzLnF1ZXJpZXMgPSB7fTtcblxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHRoaXMuZXZlbnRzID0ge307XG5cbiAgICB0aGlzLnByaW9yaXR5ID0gMDtcblxuICAgIC8vIFVzZWQgZm9yIHN0YXRzXG4gICAgdGhpcy5leGVjdXRlVGltZSA9IDA7XG5cbiAgICBpZiAoYXR0cmlidXRlcyAmJiBhdHRyaWJ1dGVzLnByaW9yaXR5KSB7XG4gICAgICB0aGlzLnByaW9yaXR5ID0gYXR0cmlidXRlcy5wcmlvcml0eTtcbiAgICB9XG5cbiAgICB0aGlzLmNvbmZpZyA9IHRoaXMuaW5pdCA/IHRoaXMuaW5pdCgpIDogbnVsbDtcblxuICAgIGlmICghdGhpcy5jb25maWcpIHJldHVybjtcbiAgICBpZiAodGhpcy5jb25maWcucXVlcmllcykge1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLmNvbmZpZy5xdWVyaWVzKSB7XG4gICAgICAgIHZhciBxdWVyeUNvbmZpZyA9IHRoaXMuY29uZmlnLnF1ZXJpZXNbbmFtZV07XG4gICAgICAgIHZhciBDb21wb25lbnRzID0gcXVlcnlDb25maWcuY29tcG9uZW50cztcbiAgICAgICAgaWYgKCFDb21wb25lbnRzIHx8IENvbXBvbmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiJ2NvbXBvbmVudHMnIGF0dHJpYnV0ZSBjYW4ndCBiZSBlbXB0eSBpbiBhIHF1ZXJ5XCIpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBxdWVyeSA9IHRoaXMud29ybGQuZW50aXR5TWFuYWdlci5xdWVyeUNvbXBvbmVudHMoQ29tcG9uZW50cyk7XG4gICAgICAgIHRoaXMuX3F1ZXJpZXNbbmFtZV0gPSBxdWVyeTtcbiAgICAgICAgdGhpcy5xdWVyaWVzW25hbWVdID0gcXVlcnkuZW50aXRpZXM7XG5cbiAgICAgICAgaWYgKHF1ZXJ5Q29uZmlnLmV2ZW50cykge1xuICAgICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0ge307XG4gICAgICAgICAgbGV0IGV2ZW50cyA9IHRoaXMuZXZlbnRzW25hbWVdO1xuICAgICAgICAgIGZvciAobGV0IGV2ZW50TmFtZSBpbiBxdWVyeUNvbmZpZy5ldmVudHMpIHtcbiAgICAgICAgICAgIGxldCBldmVudCA9IHF1ZXJ5Q29uZmlnLmV2ZW50c1tldmVudE5hbWVdO1xuICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0gPSBbXTtcblxuICAgICAgICAgICAgY29uc3QgZXZlbnRNYXBwaW5nID0ge1xuICAgICAgICAgICAgICBFbnRpdHlBZGRlZDogUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCxcbiAgICAgICAgICAgICAgRW50aXR5UmVtb3ZlZDogUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICAgICAgICBFbnRpdHlDaGFuZ2VkOiBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0NIQU5HRURcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChldmVudE1hcHBpbmdbZXZlbnQuZXZlbnRdKSB7XG4gICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgIGV2ZW50TWFwcGluZ1tldmVudC5ldmVudF0sXG4gICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgIGV2ZW50c1tldmVudE5hbWVdLnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmV2ZW50ID09PSBcIkNvbXBvbmVudENoYW5nZWRcIikge1xuICAgICAgICAgICAgICBxdWVyeS5yZWFjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAoZW50aXR5LCBjb21wb25lbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChldmVudC5jb21wb25lbnRzLmluZGV4T2YoY29tcG9uZW50LmNvbnN0cnVjdG9yKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0ucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb25maWcuZXZlbnRzKSB7XG4gICAgICBmb3IgKGxldCBuYW1lIGluIHRoaXMuY29uZmlnLmV2ZW50cykge1xuICAgICAgICB2YXIgZXZlbnQgPSB0aGlzLmNvbmZpZy5ldmVudHNbbmFtZV07XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0gW107XG4gICAgICAgIHRoaXMud29ybGQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgZGF0YSA9PiB7XG4gICAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0ucHVzaChkYXRhKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHBsYXkoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgfVxuXG4gIGNsZWFyRXZlbnRzKCkge1xuICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5ldmVudHMpIHtcbiAgICAgIHZhciBldmVudCA9IHRoaXMuZXZlbnRzW25hbWVdO1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdLmxlbmd0aCA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKG5hbWUgaW4gZXZlbnQpIHtcbiAgICAgICAgICBldmVudFtuYW1lXS5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBOb3QoQ29tcG9uZW50KSB7XG4gIHJldHVybiB7XG4gICAgb3BlcmF0b3I6IFwibm90XCIsXG4gICAgQ29tcG9uZW50OiBDb21wb25lbnRcbiAgfTtcbn1cbiIsImNsYXNzIEZsb2F0VmFsaWRhdG9yIHtcbiAgc3RhdGljIHZhbGlkYXRlKG4pIHtcbiAgICByZXR1cm4gTnVtYmVyKG4pID09PSBuICYmIG4gJSAxICE9PSAwO1xuICB9XG59XG5cbnZhciBTY2hlbWFUeXBlcyA9IHtcbiAgZmxvYXQ6IEZsb2F0VmFsaWRhdG9yXG4gIC8qXG4gIGFycmF5XG4gIGJvb2xcbiAgZnVuY1xuICBudW1iZXJcbiAgb2JqZWN0XG4gIHN0cmluZ1xuICBzeW1ib2xcblxuICBhbnlcbiAgYXJyYXlPZlxuICBlbGVtZW50XG4gIGVsZW1lbnRUeXBlXG4gIGluc3RhbmNlT2ZcbiAgbm9kZVxuICBvYmplY3RPZlxuICBvbmVPZlxuICBvbmVPZlR5cGVcbiAgc2hhcGVcbiAgZXhhY3RcbiovXG59O1xuXG5leHBvcnQgeyBTY2hlbWFUeXBlcyB9O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUFHQSxBQUFPLE1BQU0sYUFBYSxDQUFDO0VBQ3pCLFdBQVcsQ0FBQyxLQUFLLEVBQUU7SUFDakIsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDbEIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7R0FDcEI7Ozs7OztFQU1ELGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFO0lBQ2pDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUN0RCxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDbkIsT0FBTyxJQUFJLENBQUM7R0FDYjs7RUFFRCxXQUFXLEdBQUc7SUFDWixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUs7TUFDMUIsT0FBTyxDQUFDLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUM7S0FDaEMsQ0FBQyxDQUFDO0dBQ0o7Ozs7OztFQU1ELFlBQVksQ0FBQyxNQUFNLEVBQUU7SUFDbkIsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDekMsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLE9BQU87O0lBRXBCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztHQUMvQjs7Ozs7OztFQU9ELE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxF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
