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
    names.push(getName(T));
  }

  return names
    .map(function(x) {
      return x.toLowerCase();
    })
    .sort()
    .join("-");
}

class Query {
  /**
   * @param {Array(Component)} Components List of types of components to query
   */
  constructor(Components, manager) {
    this.Components = Components;
    this.entities = [];
    this.eventDispatcher = new EventDispatcher();

    this.key = queryKey(Components);

    // Fill the query with the existing entities
    for (var i = 0; i < manager._entities.length; i++) {
      var entity = manager._entities[i];
      if (entity.hasAllComponents(Components)) {
        this.entities.push(entity);
      }
    }
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

class ReactiveSystem {
  constructor(world) {
    this.world = world;
    this.enabled = true;
    this.queryComponents = this.init ? this.init() : null;
    this._queries = {};
    this.queries = {};

    this.counters = {
      added: 0,
      removed: 0,
      changed: 0,
      componentChanged: 0
    };

    for (var name in this.queryComponents) {
      var Components = this.queryComponents[name];
      var query = this.world.entityManager.queryComponents(Components);
      this._queries[name] = query;
      this.queries[name] = {};

      if (this.onEntitiesAdded) {
        this.queries[name].added = [];
        query.eventDispatcher.addEventListener(
          Query.prototype.ENTITY_ADDED,
          entity => {
            this.queries[name].added.push(entity);
            this.counters.added++;
          }
        );
      }

      if (this.onEntitiesRemoved) {
        this.queries[name].removed = [];
        query.eventDispatcher.addEventListener(
          Query.prototype.ENTITY_REMOVED,
          entity => {
            this.queries[name].removed.push(entity);
            this.counters.removed++;
          }
        );
      }

      if (this.onEntitiesChanged) {
        this.queries[name].changed = [];
        query.eventDispatcher.addEventListener(
          Query.prototype.COMPONENT_CHANGED,
          entity => {
            this.queries[name].changed.push(entity);
            this.counters.changed++;
          }
        );
      }
/*
      @todo
      if (this.onComponentChanged) {
        this.queries[name].componentChanged = [];
        query.eventDispatcher.addEventListener(
          Query.prototype.COMPONENT_CHANGED,
          entity => {
            this.queries[name].componentChanged.push({entity: entity, component: component});
            this.counters.componentChanged++;
          }
        );
      }
*/
    }
  }

  clearQueries() {
    for (var name in this.queries) {
      let query = this.queries[name];
      for (var event in query) {
        query[event].length = 0;
      }
    }
    this.counters.added = this.counters.removed = this.counters.changed = this.counters.componentChanged = 0;
  }
}

class SystemManager {
  constructor(world) {
    this.systems = [];
    this.world = world;
  }

  /**
   * Register a system
   * @param {System} System System to register
   */
  registerSystem(System) {
    this.systems.push(new System(this.world));
    return this;
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
        if (system instanceof ReactiveSystem) {
          if (system.onEntitiesAdded && system.counters.added) {
            system.onEntitiesAdded();
          }
          if (system.onEntitiesRemoved && system.counters.removed) {
            system.onEntitiesRemoved();
          }
          if (system.onEntitiesChanged && system.counters.changed) {
            system.onEntitiesChanged();
          }
        } else if (system.execute) {
          system.execute(delta, time);
        }
      }
    });

    this.systems.forEach(system => {
      if (system instanceof ReactiveSystem) {
        system.clearQueries();
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

const proxyMap = new WeakMap();

const proxyHandler = {
  set(target, prop) {
    throw new Error(
      `Tried to write to "${target.constructor.name}#${String(
        prop
      )}" on immutable component. Use .getMutableComponent() to write to a component.`
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

class Entity {
  constructor(manager) {
    this._manager = manager || null;

    // Unique ID for this entity
    this.id = nextId++;

    // List of components types the entity has
    this._Components = [];

    // Instance of the components
    this._ComponentsMap = {};

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
    var component = this._ComponentsMap[Component.name];
    return wrapImmutableComponent(Component, component);
    return component;
  }

  /**
   * Return a mutable reference of a component.
   * @param {Component} Type of component to get
   * @return {Component} Mutable component reference
   */
  getMutableComponent(Component) {
    var component = this._ComponentsMap[Component.name];
    for (var i = 0; i < this.queries.length; i++) {
      var query = this.queries[i];
      query.eventDispatcher.dispatchEvent(
        Query.prototype.COMPONENT_CHANGED,
        this,
        component
      );
    }
    return component;
  }

  /**
   * Add a component to the entity
   * @param {Component} Component to add to this entity
   * @param {Object} Optional values to replace the default attributes on the component
   */
  addComponent(Component, values) {
    this._manager.entityAddComponent(this, Component, values);
    return this;
  }

  /**
   * Remove a component from the entity
   * @param {Component} Component to remove from the entity
   */
  removeComponent(Component) {
    this._manager.entityRemoveComponent(this, Component);
    return this;
  }

  /**
   * Check if the entity has a component
   * @param {Component} Component to check
   */
  hasComponent(Component) {
    return !!~this._Components.indexOf(Component);
  }

  /**
   * Check if the entity has a list of components
   * @param {Array(Component)} Components to check
   */
  hasAllComponents(Components) {
    var result = true;

    for (var i = 0; i < Components.length; i++) {
      result = result && !!~this._Components.indexOf(Components[i]);
    }

    return result;
  }

  /**
   * Remove all the components from the entity
   */
  removeAllComponents() {
    return this._manager.entityRemoveAllComponents(this);
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
    this._manager.entityAddTag(this, tag);
    return this;
  }

  /**
   * Remove a tag from the entity
   * @param {String} tag Tag to remove from the entity
   */
  removeTag(tag) {
    this._manager.entityRemoveTag(this, tag);
    return this;
  }

  // EXTRAS

  /**
   * Initialize the entity. To be used when returning an entity to the pool
   */
  __init() {
    this.id = nextId++;
    this._manager = null;
    this._Components.length = 0;
    this._tags.length = 0;
  }

  /**
   * Dispose the entity from the manager
   */
  dispose() {
    return this._manager.removeEntity(this);
  }
}

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

class QueryManager {
  constructor(manager) {
    this._manager = manager;

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

      // Add the entity only if:
      // Component is in the query
      // and Entity has ALL the components of the query
      // and Entity is not already in the query
      if (
        !~query.Components.indexOf(Component) ||
        !entity.hasAllComponents(query.Components) ||
        ~query.entities.indexOf(entity)
      )
        continue;

      query.eventDispatcher.dispatchEvent(Query.prototype.ENTITY_ADDED, entity);

      entity.queries.push(query);
      query.entities.push(entity);
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

      if (!~query.Components.indexOf(Component)) continue;
      if (!entity.hasAllComponents(query.Components)) continue;

      var index = query.entities.indexOf(entity);
      if (~index) {
        query.entities.splice(index, 1);

        index = entity.queries.indexOf(query);
        entity.queries.splice(index, 1);

        query.eventDispatcher.dispatchEvent(
          Query.prototype.ENTITY_REMOVED,
          entity
        );
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
      this._queries[key] = query = new Query(Components, this._manager);
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

class EntityManager {
  constructor() {
    this._entities = [];
    this._componentPool = [];
    this._queryManager = new QueryManager(this);
    this.eventDispatcher = new EventDispatcher();
    this._entityPool = new ObjectPool(Entity);
    this._tags = {};
  }

  /**
   * Create a new entity
   */
  createEntity() {
    var entity = this._entityPool.aquire();
    entity._manager = this;
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
    if (~entity._Components.indexOf(Component)) return;

    entity._Components.push(Component);

    var componentPool = this._getComponentsPool(Component);
    var component = componentPool.aquire();
    var componentName = componentPropertyName(Component);

    entity._ComponentsMap[Component.name] = component;

    entity[componentName] = component;
    if (values) {
      for (var name in values) {
        component[name] = values[name];
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
    var index = entity._Components.indexOf(Component);
    if (!~index) return;

    this.eventDispatcher.dispatchEvent(COMPONENT_REMOVE, entity, Component);

    // Check each indexed query to see if we need to remove it
    this._queryManager.onEntityRemoved(entity, Component);

    // Remove T listing on entity and property ref, then free the component.
    entity._Components.splice(index, 1);
    var propName = componentPropertyName(Component);
    var component = entity[propName];
    delete entity[propName];
    this._componentPool[propName].release(component);
  }

  /**
   * Remove all the components from an entity
   * @param {Entity} entity Entity from which the components will be removed
   */
  entityRemoveAllComponents(entity) {
    let Components = entity._Components;

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
    entity.manager = null;
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

  /**
   * Get components pool
   * @param {Component} Component Type of component type for the pool
   */
  _getComponentsPool(Component) {
    var componentName = componentPropertyName(Component);

    if (!this._componentPool[componentName]) {
      this._componentPool[componentName] = new ObjectPool(Component);
    }

    return this._componentPool[componentName];
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
      numComponentPool: Object.keys(this._componentPool).length,
      componentPool: {},
      eventDispatcher: this.eventDispatcher.stats
    };

    for (var cname in this._componentPool) {
      var pool = this._componentPool[cname];
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

class ComponentManager {
  constructor() {
    this.Components = {};
    this.SingletonComponents = {};
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
}

class World {
  constructor() {
    this.entityManager = new EntityManager();
    this.systemManager = new SystemManager(this);
    this.componentsManager = new ComponentManager(this);

    // Storage for singleton components
    this.components = {};
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
  registerSystem(System) {
    this.systemManager.registerSystem(System);
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

class System {
  constructor(world) {
    this.world = world;
    this.enabled = true;
    this.queryComponents = this.init ? this.init() : null;
    this._queries = {};
    this.queries = {};

    for (var name in this.queryComponents) {
      var Components = this.queryComponents[name];
      var query = this.world.entityManager.queryComponents(Components);
      this._queries[name] = query;
      this.queries[name] = query.entities;
    }
  }
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

export { ReactiveSystem, SchemaTypes, System, World };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9FdmVudERpc3BhdGNoZXIuanMiLCIuLi9zcmMvVXRpbHMuanMiLCIuLi9zcmMvUXVlcnkuanMiLCIuLi9zcmMvUmVhY3RpdmVTeXN0ZW0uanMiLCIuLi9zcmMvU3lzdGVtTWFuYWdlci5qcyIsIi4uL3NyYy9XcmFwSW1tdXRhYmxlQ29tcG9uZW50LmpzIiwiLi4vc3JjL0VudGl0eS5qcyIsIi4uL3NyYy9PYmplY3RQb29sLmpzIiwiLi4vc3JjL1F1ZXJ5TWFuYWdlci5qcyIsIi4uL3NyYy9FbnRpdHlNYW5hZ2VyLmpzIiwiLi4vc3JjL0NvbXBvbmVudE1hbmFnZXIuanMiLCIuLi9zcmMvV29ybGQuanMiLCIuLi9zcmMvU3lzdGVtLmpzIiwiLi4vc3JjL1NjaGVtYVR5cGVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IGNsYXNzIEV2ZW50RGlzcGF0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuX2xpc3RlbmVycyA9IHt9O1xuICAgIHRoaXMuc3RhdHMgPSB7XG4gICAgICBmaXJlZDogMCxcbiAgICAgIGhhbmRsZWQ6IDBcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhbiBldmVudCBsaXN0ZW5lclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGxpc3RlblxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayB0byB0cmlnZ2VyIHdoZW4gdGhlIGV2ZW50IGlzIGZpcmVkXG4gICAqL1xuICBhZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICBsZXQgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnROYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgIH1cblxuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnROYW1lXS5pbmRleE9mKGxpc3RlbmVyKSA9PT0gLTEpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudE5hbWVdLnB1c2gobGlzdGVuZXIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBhbiBldmVudCBsaXN0ZW5lciBpcyBhbHJlYWR5IGFkZGVkIHRvIHRoZSBsaXN0IG9mIGxpc3RlbmVyc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGNoZWNrXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50XG4gICAqL1xuICBoYXNFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihsaXN0ZW5lcikgIT09IC0xXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byByZW1vdmVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnRcbiAgICovXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIHZhciBsaXN0ZW5lckFycmF5ID0gdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV07XG4gICAgaWYgKGxpc3RlbmVyQXJyYXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGluZGV4ID0gbGlzdGVuZXJBcnJheS5pbmRleE9mKGxpc3RlbmVyKTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgbGlzdGVuZXJBcnJheS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNwYXRjaCBhbiBldmVudFxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGRpc3BhdGNoXG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgKE9wdGlvbmFsKSBFbnRpdHkgdG8gZW1pdFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XG4gICAqL1xuICBkaXNwYXRjaEV2ZW50KGV2ZW50TmFtZSwgZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkKys7XG5cbiAgICB2YXIgbGlzdGVuZXJBcnJheSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xuICAgIGlmIChsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBhcnJheSA9IGxpc3RlbmVyQXJyYXkuc2xpY2UoMCk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJyYXlbaV0uY2FsbCh0aGlzLCBlbnRpdHksIGNvbXBvbmVudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHN0YXRzIGNvdW50ZXJzXG4gICAqL1xuICByZXNldENvdW50ZXJzKCkge1xuICAgIHRoaXMuc3RhdHMuZmlyZWQgPSB0aGlzLnN0YXRzLmhhbmRsZWQgPSAwO1xuICB9XG59XG4iLCIvKipcbiAqIFJldHVybiB0aGUgbmFtZSBvZiBhIGNvbXBvbmVudFxuICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TmFtZShDb21wb25lbnQpIHtcbiAgcmV0dXJuIENvbXBvbmVudC5uYW1lO1xufVxuXG4vKipcbiAqIFJldHVybiBhIHZhbGlkIHByb3BlcnR5IG5hbWUgZm9yIHRoZSBDb21wb25lbnRcbiAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpIHtcbiAgdmFyIG5hbWUgPSBnZXROYW1lKENvbXBvbmVudCk7XG4gIHJldHVybiBuYW1lLmNoYXJBdCgwKS50b0xvd2VyQ2FzZSgpICsgbmFtZS5zbGljZSgxKTtcbn1cblxuLyoqXG4gKiBHZXQgYSBrZXkgZnJvbSBhIGxpc3Qgb2YgY29tcG9uZW50c1xuICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIEFycmF5IG9mIGNvbXBvbmVudHMgdG8gZ2VuZXJhdGUgdGhlIGtleVxuICovXG5leHBvcnQgZnVuY3Rpb24gcXVlcnlLZXkoQ29tcG9uZW50cykge1xuICB2YXIgbmFtZXMgPSBbXTtcbiAgZm9yICh2YXIgbiA9IDA7IG4gPCBDb21wb25lbnRzLmxlbmd0aDsgbisrKSB7XG4gICAgdmFyIFQgPSBDb21wb25lbnRzW25dO1xuICAgIG5hbWVzLnB1c2goZ2V0TmFtZShUKSk7XG4gIH1cblxuICByZXR1cm4gbmFtZXNcbiAgICAubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB4LnRvTG93ZXJDYXNlKCk7XG4gICAgfSlcbiAgICAuc29ydCgpXG4gICAgLmpvaW4oXCItXCIpO1xufVxuIiwiaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcbmltcG9ydCB7IHF1ZXJ5S2V5IH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUXVlcnkge1xuICAvKipcbiAgICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIExpc3Qgb2YgdHlwZXMgb2YgY29tcG9uZW50cyB0byBxdWVyeVxuICAgKi9cbiAgY29uc3RydWN0b3IoQ29tcG9uZW50cywgbWFuYWdlcikge1xuICAgIHRoaXMuQ29tcG9uZW50cyA9IENvbXBvbmVudHM7XG4gICAgdGhpcy5lbnRpdGllcyA9IFtdO1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyID0gbmV3IEV2ZW50RGlzcGF0Y2hlcigpO1xuXG4gICAgdGhpcy5rZXkgPSBxdWVyeUtleShDb21wb25lbnRzKTtcblxuICAgIC8vIEZpbGwgdGhlIHF1ZXJ5IHdpdGggdGhlIGV4aXN0aW5nIGVudGl0aWVzXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtYW5hZ2VyLl9lbnRpdGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGVudGl0eSA9IG1hbmFnZXIuX2VudGl0aWVzW2ldO1xuICAgICAgaWYgKGVudGl0eS5oYXNBbGxDb21wb25lbnRzKENvbXBvbmVudHMpKSB7XG4gICAgICAgIHRoaXMuZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc3RhdHMgZm9yIHRoaXMgcXVlcnlcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBudW1Db21wb25lbnRzOiB0aGlzLkNvbXBvbmVudHMubGVuZ3RoLFxuICAgICAgbnVtRW50aXRpZXM6IHRoaXMuZW50aXRpZXMubGVuZ3RoXG4gICAgfTtcbiAgfVxufVxuXG5RdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVEID0gXCJRdWVyeSNFTlRJVFlfQURERURcIjtcblF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfUkVNT1ZFRCA9IFwiUXVlcnkjRU5USVRZX1JFTU9WRURcIjtcblF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCA9IFwiUXVlcnkjQ09NUE9ORU5UX0NIQU5HRURcIjtcbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgUmVhY3RpdmVTeXN0ZW0ge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuICAgIHRoaXMucXVlcnlDb21wb25lbnRzID0gdGhpcy5pbml0ID8gdGhpcy5pbml0KCkgOiBudWxsO1xuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgICB0aGlzLnF1ZXJpZXMgPSB7fTtcblxuICAgIHRoaXMuY291bnRlcnMgPSB7XG4gICAgICBhZGRlZDogMCxcbiAgICAgIHJlbW92ZWQ6IDAsXG4gICAgICBjaGFuZ2VkOiAwLFxuICAgICAgY29tcG9uZW50Q2hhbmdlZDogMFxuICAgIH07XG5cbiAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMucXVlcnlDb21wb25lbnRzKSB7XG4gICAgICB2YXIgQ29tcG9uZW50cyA9IHRoaXMucXVlcnlDb21wb25lbnRzW25hbWVdO1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy53b3JsZC5lbnRpdHlNYW5hZ2VyLnF1ZXJ5Q29tcG9uZW50cyhDb21wb25lbnRzKTtcbiAgICAgIHRoaXMuX3F1ZXJpZXNbbmFtZV0gPSBxdWVyeTtcbiAgICAgIHRoaXMucXVlcmllc1tuYW1lXSA9IHt9O1xuXG4gICAgICBpZiAodGhpcy5vbkVudGl0aWVzQWRkZWQpIHtcbiAgICAgICAgdGhpcy5xdWVyaWVzW25hbWVdLmFkZGVkID0gW107XG4gICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQsXG4gICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgIHRoaXMucXVlcmllc1tuYW1lXS5hZGRlZC5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICB0aGlzLmNvdW50ZXJzLmFkZGVkKys7XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5vbkVudGl0aWVzUmVtb3ZlZCkge1xuICAgICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0ucmVtb3ZlZCA9IFtdO1xuICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICBRdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQsXG4gICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgIHRoaXMucXVlcmllc1tuYW1lXS5yZW1vdmVkLnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgIHRoaXMuY291bnRlcnMucmVtb3ZlZCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMub25FbnRpdGllc0NoYW5nZWQpIHtcbiAgICAgICAgdGhpcy5xdWVyaWVzW25hbWVdLmNoYW5nZWQgPSBbXTtcbiAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICAgIGVudGl0eSA9PiB7XG4gICAgICAgICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0uY2hhbmdlZC5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICB0aGlzLmNvdW50ZXJzLmNoYW5nZWQrKztcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG4vKlxuICAgICAgQHRvZG9cbiAgICAgIGlmICh0aGlzLm9uQ29tcG9uZW50Q2hhbmdlZCkge1xuICAgICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0uY29tcG9uZW50Q2hhbmdlZCA9IFtdO1xuICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICBRdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQsXG4gICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgIHRoaXMucXVlcmllc1tuYW1lXS5jb21wb25lbnRDaGFuZ2VkLnB1c2goe2VudGl0eTogZW50aXR5LCBjb21wb25lbnQ6IGNvbXBvbmVudH0pO1xuICAgICAgICAgICAgdGhpcy5jb3VudGVycy5jb21wb25lbnRDaGFuZ2VkKys7XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfVxuKi9cbiAgICB9XG4gIH1cblxuICBjbGVhclF1ZXJpZXMoKSB7XG4gICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLnF1ZXJpZXMpIHtcbiAgICAgIGxldCBxdWVyeSA9IHRoaXMucXVlcmllc1tuYW1lXTtcbiAgICAgIGZvciAodmFyIGV2ZW50IGluIHF1ZXJ5KSB7XG4gICAgICAgIHF1ZXJ5W2V2ZW50XS5sZW5ndGggPSAwO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvdW50ZXJzLmFkZGVkID0gdGhpcy5jb3VudGVycy5yZW1vdmVkID0gdGhpcy5jb3VudGVycy5jaGFuZ2VkID0gdGhpcy5jb3VudGVycy5jb21wb25lbnRDaGFuZ2VkID0gMDtcbiAgfVxufVxuIiwiaW1wb3J0IHsgUmVhY3RpdmVTeXN0ZW0gfSBmcm9tIFwiLi9SZWFjdGl2ZVN5c3RlbS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgU3lzdGVtTWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy5zeXN0ZW1zID0gW107XG4gICAgdGhpcy53b3JsZCA9IHdvcmxkO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgc3lzdGVtXG4gICAqIEBwYXJhbSB7U3lzdGVtfSBTeXN0ZW0gU3lzdGVtIHRvIHJlZ2lzdGVyXG4gICAqL1xuICByZWdpc3RlclN5c3RlbShTeXN0ZW0pIHtcbiAgICB0aGlzLnN5c3RlbXMucHVzaChuZXcgU3lzdGVtKHRoaXMud29ybGQpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBzeXN0ZW1cbiAgICogQHBhcmFtIHtTeXN0ZW19IFN5c3RlbSBTeXN0ZW0gdG8gcmVtb3ZlXG4gICAqL1xuICByZW1vdmVTeXN0ZW0oU3lzdGVtKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5zeXN0ZW1zLmluZGV4T2YoU3lzdGVtKTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgdGhpcy5zeXN0ZW1zLnNwbGljZShpbmRleCwgMSk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIGFsbCB0aGUgc3lzdGVtcy4gQ2FsbGVkIHBlciBmcmFtZS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbHRhIERlbHRhIHRpbWUgc2luY2UgdGhlIGxhc3QgZnJhbWVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHRpbWUgRWxhcHNlZCB0aW1lXG4gICAqL1xuICBleGVjdXRlKGRlbHRhLCB0aW1lKSB7XG4gICAgdGhpcy5zeXN0ZW1zLmZvckVhY2goc3lzdGVtID0+IHtcbiAgICAgIGlmIChzeXN0ZW0uZW5hYmxlZCkge1xuICAgICAgICBpZiAoc3lzdGVtIGluc3RhbmNlb2YgUmVhY3RpdmVTeXN0ZW0pIHtcbiAgICAgICAgICBpZiAoc3lzdGVtLm9uRW50aXRpZXNBZGRlZCAmJiBzeXN0ZW0uY291bnRlcnMuYWRkZWQpIHtcbiAgICAgICAgICAgIHN5c3RlbS5vbkVudGl0aWVzQWRkZWQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHN5c3RlbS5vbkVudGl0aWVzUmVtb3ZlZCAmJiBzeXN0ZW0uY291bnRlcnMucmVtb3ZlZCkge1xuICAgICAgICAgICAgc3lzdGVtLm9uRW50aXRpZXNSZW1vdmVkKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzeXN0ZW0ub25FbnRpdGllc0NoYW5nZWQgJiYgc3lzdGVtLmNvdW50ZXJzLmNoYW5nZWQpIHtcbiAgICAgICAgICAgIHN5c3RlbS5vbkVudGl0aWVzQ2hhbmdlZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChzeXN0ZW0uZXhlY3V0ZSkge1xuICAgICAgICAgIHN5c3RlbS5leGVjdXRlKGRlbHRhLCB0aW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5zeXN0ZW1zLmZvckVhY2goc3lzdGVtID0+IHtcbiAgICAgIGlmIChzeXN0ZW0gaW5zdGFuY2VvZiBSZWFjdGl2ZVN5c3RlbSkge1xuICAgICAgICBzeXN0ZW0uY2xlYXJRdWVyaWVzKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHN0YXRzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBudW1TeXN0ZW1zOiB0aGlzLnN5c3RlbXMubGVuZ3RoLFxuICAgICAgc3lzdGVtczoge31cbiAgICB9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnN5c3RlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBzeXN0ZW0gPSB0aGlzLnN5c3RlbXNbaV07XG4gICAgICB2YXIgc3lzdGVtU3RhdHMgPSAoc3RhdHMuc3lzdGVtc1tzeXN0ZW0uY29uc3RydWN0b3IubmFtZV0gPSB7XG4gICAgICAgIHF1ZXJpZXM6IHt9XG4gICAgICB9KTtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gc3lzdGVtLmN0eCkge1xuICAgICAgICBzeXN0ZW1TdGF0cy5xdWVyaWVzW25hbWVdID0gc3lzdGVtLmN0eFtuYW1lXS5zdGF0cygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuIiwiY29uc3QgcHJveHlNYXAgPSBuZXcgV2Vha01hcCgpO1xuXG5jb25zdCBwcm94eUhhbmRsZXIgPSB7XG4gIHNldCh0YXJnZXQsIHByb3ApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgVHJpZWQgdG8gd3JpdGUgdG8gXCIke3RhcmdldC5jb25zdHJ1Y3Rvci5uYW1lfSMke1N0cmluZyhcbiAgICAgICAgcHJvcFxuICAgICAgKX1cIiBvbiBpbW11dGFibGUgY29tcG9uZW50LiBVc2UgLmdldE11dGFibGVDb21wb25lbnQoKSB0byB3cml0ZSB0byBhIGNvbXBvbmVudC5gXG4gICAgKTtcbiAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gd3JhcEltbXV0YWJsZUNvbXBvbmVudChULCBjb21wb25lbnQpIHtcbiAgaWYgKGNvbXBvbmVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGxldCB3cmFwcGVkQ29tcG9uZW50ID0gcHJveHlNYXAuZ2V0KGNvbXBvbmVudCk7XG5cbiAgaWYgKCF3cmFwcGVkQ29tcG9uZW50KSB7XG4gICAgd3JhcHBlZENvbXBvbmVudCA9IG5ldyBQcm94eShjb21wb25lbnQsIHByb3h5SGFuZGxlcik7XG4gICAgcHJveHlNYXAuc2V0KGNvbXBvbmVudCwgd3JhcHBlZENvbXBvbmVudCk7XG4gIH1cblxuICByZXR1cm4gd3JhcHBlZENvbXBvbmVudDtcbn1cbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuaW1wb3J0IHdyYXBJbW11dGFibGVDb21wb25lbnQgZnJvbSBcIi4vV3JhcEltbXV0YWJsZUNvbXBvbmVudC5qc1wiO1xuXG4vLyBAdG9kbyBUYWtlIHRoaXMgb3V0IGZyb20gdGhlcmUgb3IgdXNlIEVOVlxuY29uc3QgREVCVUcgPSB0cnVlO1xuXG4vLyBAdG9kbyByZXNldCBpdCBieSB3b3JsZD9cbnZhciBuZXh0SWQgPSAwO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFbnRpdHkge1xuICBjb25zdHJ1Y3RvcihtYW5hZ2VyKSB7XG4gICAgdGhpcy5fbWFuYWdlciA9IG1hbmFnZXIgfHwgbnVsbDtcblxuICAgIC8vIFVuaXF1ZSBJRCBmb3IgdGhpcyBlbnRpdHlcbiAgICB0aGlzLmlkID0gbmV4dElkKys7XG5cbiAgICAvLyBMaXN0IG9mIGNvbXBvbmVudHMgdHlwZXMgdGhlIGVudGl0eSBoYXNcbiAgICB0aGlzLl9Db21wb25lbnRzID0gW107XG5cbiAgICAvLyBJbnN0YW5jZSBvZiB0aGUgY29tcG9uZW50c1xuICAgIHRoaXMuX0NvbXBvbmVudHNNYXAgPSB7fTtcblxuICAgIC8vIExpc3Qgb2YgdGFncyB0aGlzIGVudGl0eSBoYXNcbiAgICB0aGlzLl90YWdzID0gW107XG5cbiAgICAvLyBRdWVyaWVzIHdoZXJlIHRoZSBlbnRpdHkgaXMgYWRkZWRcbiAgICB0aGlzLnF1ZXJpZXMgPSBbXTtcbiAgfVxuXG4gIC8vIENPTVBPTkVOVFNcblxuICAvKipcbiAgICogUmV0dXJuIGFuIGltbXV0YWJsZSByZWZlcmVuY2Ugb2YgYSBjb21wb25lbnRcbiAgICogTm90ZTogQSBwcm94eSB3aWxsIGJlIHVzZWQgb24gZGVidWcgbW9kZSwgYW5kIGl0IHdpbGwganVzdCBhZmZlY3RcbiAgICogICAgICAgdGhlIGZpcnN0IGxldmVsIGF0dHJpYnV0ZXMgb24gdGhlIG9iamVjdCwgaXQgd29uJ3Qgd29yayByZWN1cnNpdmVseS5cbiAgICogQHBhcmFtIHtDb21wb25lbnR9IFR5cGUgb2YgY29tcG9uZW50IHRvIGdldFxuICAgKiBAcmV0dXJuIHtDb21wb25lbnR9IEltbXV0YWJsZSBjb21wb25lbnQgcmVmZXJlbmNlXG4gICAqL1xuICBnZXRDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IHRoaXMuX0NvbXBvbmVudHNNYXBbQ29tcG9uZW50Lm5hbWVdO1xuICAgIGlmIChERUJVRykgcmV0dXJuIHdyYXBJbW11dGFibGVDb21wb25lbnQoQ29tcG9uZW50LCBjb21wb25lbnQpO1xuICAgIHJldHVybiBjb21wb25lbnQ7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGEgbXV0YWJsZSByZWZlcmVuY2Ugb2YgYSBjb21wb25lbnQuXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBUeXBlIG9mIGNvbXBvbmVudCB0byBnZXRcbiAgICogQHJldHVybiB7Q29tcG9uZW50fSBNdXRhYmxlIGNvbXBvbmVudCByZWZlcmVuY2VcbiAgICovXG4gIGdldE11dGFibGVDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IHRoaXMuX0NvbXBvbmVudHNNYXBbQ29tcG9uZW50Lm5hbWVdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5xdWVyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaV07XG4gICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICB0aGlzLFxuICAgICAgICBjb21wb25lbnRcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBjb21wb25lbnQ7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgY29tcG9uZW50IHRvIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCB0byBhZGQgdG8gdGhpcyBlbnRpdHlcbiAgICogQHBhcmFtIHtPYmplY3R9IE9wdGlvbmFsIHZhbHVlcyB0byByZXBsYWNlIHRoZSBkZWZhdWx0IGF0dHJpYnV0ZXMgb24gdGhlIGNvbXBvbmVudFxuICAgKi9cbiAgYWRkQ29tcG9uZW50KENvbXBvbmVudCwgdmFsdWVzKSB7XG4gICAgdGhpcy5fbWFuYWdlci5lbnRpdHlBZGRDb21wb25lbnQodGhpcywgQ29tcG9uZW50LCB2YWx1ZXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIGNvbXBvbmVudCBmcm9tIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCB0byByZW1vdmUgZnJvbSB0aGUgZW50aXR5XG4gICAqL1xuICByZW1vdmVDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5fbWFuYWdlci5lbnRpdHlSZW1vdmVDb21wb25lbnQodGhpcywgQ29tcG9uZW50KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGUgZW50aXR5IGhhcyBhIGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IHRvIGNoZWNrXG4gICAqL1xuICBoYXNDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgcmV0dXJuICEhfnRoaXMuX0NvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGEgbGlzdCBvZiBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyB0byBjaGVja1xuICAgKi9cbiAgaGFzQWxsQ29tcG9uZW50cyhDb21wb25lbnRzKSB7XG4gICAgdmFyIHJlc3VsdCA9IHRydWU7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IENvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdCAmJiAhIX50aGlzLl9Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50c1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRoZSBjb21wb25lbnRzIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlQWxsQ29tcG9uZW50cygpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFuYWdlci5lbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKHRoaXMpO1xuICB9XG5cbiAgLy8gVEFHU1xuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGUgZW50aXR5IGhhcyBhIHRhZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byBjaGVja1xuICAgKi9cbiAgaGFzVGFnKHRhZykge1xuICAgIHJldHVybiAhIX50aGlzLl90YWdzLmluZGV4T2YodGFnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSB0YWcgdG8gdGhpcyBlbnRpdHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZyBUYWcgdG8gYWRkIHRvIHRoaXMgZW50aXR5XG4gICAqL1xuICBhZGRUYWcodGFnKSB7XG4gICAgdGhpcy5fbWFuYWdlci5lbnRpdHlBZGRUYWcodGhpcywgdGFnKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSB0YWcgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZVRhZyh0YWcpIHtcbiAgICB0aGlzLl9tYW5hZ2VyLmVudGl0eVJlbW92ZVRhZyh0aGlzLCB0YWcpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gRVhUUkFTXG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgdGhlIGVudGl0eS4gVG8gYmUgdXNlZCB3aGVuIHJldHVybmluZyBhbiBlbnRpdHkgdG8gdGhlIHBvb2xcbiAgICovXG4gIF9faW5pdCgpIHtcbiAgICB0aGlzLmlkID0gbmV4dElkKys7XG4gICAgdGhpcy5fbWFuYWdlciA9IG51bGw7XG4gICAgdGhpcy5fQ29tcG9uZW50cy5sZW5ndGggPSAwO1xuICAgIHRoaXMuX3RhZ3MubGVuZ3RoID0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNwb3NlIHRoZSBlbnRpdHkgZnJvbSB0aGUgbWFuYWdlclxuICAgKi9cbiAgZGlzcG9zZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFuYWdlci5yZW1vdmVFbnRpdHkodGhpcyk7XG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIE9iamVjdFBvb2wge1xuICBjb25zdHJ1Y3RvcihUKSB7XG4gICAgdGhpcy5mcmVlTGlzdCA9IFtdO1xuICAgIHRoaXMuY291bnQgPSAwO1xuICAgIHRoaXMuVCA9IFQ7XG5cbiAgICB2YXIgZXh0cmFBcmdzID0gbnVsbDtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGV4dHJhQXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICBleHRyYUFyZ3Muc2hpZnQoKTtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0ZUVsZW1lbnQgPSBleHRyYUFyZ3NcbiAgICAgID8gKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgVCguLi5leHRyYUFyZ3MpO1xuICAgICAgICB9XG4gICAgICA6ICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFQoKTtcbiAgICAgICAgfTtcblxuICAgIHRoaXMuaW5pdGlhbE9iamVjdCA9IHRoaXMuY3JlYXRlRWxlbWVudCgpO1xuICB9XG5cbiAgYXF1aXJlKCkge1xuICAgIC8vIEdyb3cgdGhlIGxpc3QgYnkgMjAlaXNoIGlmIHdlJ3JlIG91dFxuICAgIGlmICh0aGlzLmZyZWVMaXN0Lmxlbmd0aCA8PSAwKSB7XG4gICAgICB0aGlzLmV4cGFuZChNYXRoLnJvdW5kKHRoaXMuY291bnQgKiAwLjIpICsgMSk7XG4gICAgfVxuXG4gICAgdmFyIGl0ZW0gPSB0aGlzLmZyZWVMaXN0LnBvcCgpO1xuXG4gICAgLy8gV2UgY2FuIHByb3ZpZGUgZXhwbGljaXQgaW5pdGluZywgb3RoZXJ3aXNlIHdlIGNvcHkgdGhlIHZhbHVlIG9mIHRoZSBpbml0aWFsIGNvbXBvbmVudFxuICAgIGlmIChpdGVtLl9faW5pdCkgaXRlbS5fX2luaXQoKTtcbiAgICBlbHNlIGlmIChpdGVtLmNvcHkpIGl0ZW0uY29weSh0aGlzLmluaXRpYWxPYmplY3QpO1xuXG4gICAgcmV0dXJuIGl0ZW07XG4gIH1cblxuICByZWxlYXNlKGl0ZW0pIHtcbiAgICB0aGlzLmZyZWVMaXN0LnB1c2goaXRlbSk7XG4gIH1cblxuICBleHBhbmQoY291bnQpIHtcbiAgICBmb3IgKHZhciBuID0gMDsgbiA8IGNvdW50OyBuKyspIHtcbiAgICAgIHRoaXMuZnJlZUxpc3QucHVzaCh0aGlzLmNyZWF0ZUVsZW1lbnQoKSk7XG4gICAgfVxuICAgIHRoaXMuY291bnQgKz0gY291bnQ7XG4gIH1cblxuICB0b3RhbFNpemUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY291bnQ7XG4gIH1cblxuICB0b3RhbEZyZWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuZnJlZUxpc3QubGVuZ3RoO1xuICB9XG5cbiAgdG90YWxVc2VkKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50IC0gdGhpcy5mcmVlTGlzdC5sZW5ndGg7XG4gIH1cbn1cbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuaW1wb3J0IHsgcXVlcnlLZXkgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBRdWVyeU1hbmFnZXIge1xuICBjb25zdHJ1Y3RvcihtYW5hZ2VyKSB7XG4gICAgdGhpcy5fbWFuYWdlciA9IG1hbmFnZXI7XG5cbiAgICAvLyBRdWVyaWVzIGluZGV4ZWQgYnkgYSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIGNvbXBvbmVudHMgaXQgaGFzXG4gICAgdGhpcy5fcXVlcmllcyA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdoZW4gYSBjb21wb25lbnQgaXMgYWRkZWQgdG8gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRoYXQganVzdCBnb3QgdGhlIG5ldyBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgYWRkZWQgdG8gdGhlIGVudGl0eVxuICAgKi9cbiAgb25FbnRpdHlBZGRlZChlbnRpdHksIENvbXBvbmVudCkge1xuICAgIC8vIEB0b2RvIFVzZSBiaXRtYXNrIGZvciBjaGVja2luZyBjb21wb25lbnRzP1xuXG4gICAgLy8gQ2hlY2sgZWFjaCBpbmRleGVkIHF1ZXJ5IHRvIHNlZSBpZiB3ZSBuZWVkIHRvIGFkZCB0aGlzIGVudGl0eSB0byB0aGUgbGlzdFxuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIC8vIEFkZCB0aGUgZW50aXR5IG9ubHkgaWY6XG4gICAgICAvLyBDb21wb25lbnQgaXMgaW4gdGhlIHF1ZXJ5XG4gICAgICAvLyBhbmQgRW50aXR5IGhhcyBBTEwgdGhlIGNvbXBvbmVudHMgb2YgdGhlIHF1ZXJ5XG4gICAgICAvLyBhbmQgRW50aXR5IGlzIG5vdCBhbHJlYWR5IGluIHRoZSBxdWVyeVxuICAgICAgaWYgKFxuICAgICAgICAhfnF1ZXJ5LkNvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpIHx8XG4gICAgICAgICFlbnRpdHkuaGFzQWxsQ29tcG9uZW50cyhxdWVyeS5Db21wb25lbnRzKSB8fFxuICAgICAgICB+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpXG4gICAgICApXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChRdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVELCBlbnRpdHkpO1xuXG4gICAgICBlbnRpdHkucXVlcmllcy5wdXNoKHF1ZXJ5KTtcbiAgICAgIHF1ZXJ5LmVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2hlbiBhIGNvbXBvbmVudCBpcyByZW1vdmVkIGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRvIHJlbW92ZSB0aGUgY29tcG9uZW50IGZyb21cbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gcmVtb3ZlIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgb25FbnRpdHlSZW1vdmVkKGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXTtcblxuICAgICAgaWYgKCF+cXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkpIGNvbnRpbnVlO1xuICAgICAgaWYgKCFlbnRpdHkuaGFzQWxsQ29tcG9uZW50cyhxdWVyeS5Db21wb25lbnRzKSkgY29udGludWU7XG5cbiAgICAgIHZhciBpbmRleCA9IHF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcbiAgICAgIGlmICh+aW5kZXgpIHtcbiAgICAgICAgcXVlcnkuZW50aXRpZXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgICAgICBpbmRleCA9IGVudGl0eS5xdWVyaWVzLmluZGV4T2YocXVlcnkpO1xuICAgICAgICBlbnRpdHkucXVlcmllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfUkVNT1ZFRCxcbiAgICAgICAgICBlbnRpdHlcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgcXVlcnkgZm9yIHRoZSBzcGVjaWZpZWQgY29tcG9uZW50c1xuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50cyBDb21wb25lbnRzIHRoYXQgdGhlIHF1ZXJ5IHNob3VsZCBoYXZlXG4gICAqL1xuICBnZXRRdWVyeShDb21wb25lbnRzKSB7XG4gICAgdmFyIGtleSA9IHF1ZXJ5S2V5KENvbXBvbmVudHMpO1xuICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNba2V5XTtcbiAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICB0aGlzLl9xdWVyaWVzW2tleV0gPSBxdWVyeSA9IG5ldyBRdWVyeShDb21wb25lbnRzLCB0aGlzLl9tYW5hZ2VyKTtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzb21lIHN0YXRzIGZyb20gdGhpcyBjbGFzc1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge307XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHN0YXRzW3F1ZXJ5TmFtZV0gPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV0uc3RhdHMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG4iLCJpbXBvcnQgRW50aXR5IGZyb20gXCIuL0VudGl0eS5qc1wiO1xuaW1wb3J0IE9iamVjdFBvb2wgZnJvbSBcIi4vT2JqZWN0UG9vbC5qc1wiO1xuaW1wb3J0IFF1ZXJ5TWFuYWdlciBmcm9tIFwiLi9RdWVyeU1hbmFnZXIuanNcIjtcbmltcG9ydCBFdmVudERpc3BhdGNoZXIgZnJvbSBcIi4vRXZlbnREaXNwYXRjaGVyLmpzXCI7XG5pbXBvcnQgeyBjb21wb25lbnRQcm9wZXJ0eU5hbWUgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG5leHBvcnQgY2xhc3MgRW50aXR5TWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuX2VudGl0aWVzID0gW107XG4gICAgdGhpcy5fY29tcG9uZW50UG9vbCA9IFtdO1xuICAgIHRoaXMuX3F1ZXJ5TWFuYWdlciA9IG5ldyBRdWVyeU1hbmFnZXIodGhpcyk7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG4gICAgdGhpcy5fZW50aXR5UG9vbCA9IG5ldyBPYmplY3RQb29sKEVudGl0eSk7XG4gICAgdGhpcy5fdGFncyA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBlbnRpdHlcbiAgICovXG4gIGNyZWF0ZUVudGl0eSgpIHtcbiAgICB2YXIgZW50aXR5ID0gdGhpcy5fZW50aXR5UG9vbC5hcXVpcmUoKTtcbiAgICBlbnRpdHkuX21hbmFnZXIgPSB0aGlzO1xuICAgIHRoaXMuX2VudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KEVOVElUWV9DUkVBVEVELCBlbnRpdHkpO1xuICAgIHJldHVybiBlbnRpdHk7XG4gIH1cblxuICAvLyBDT01QT05FTlRTXG5cbiAgLyoqXG4gICAqIEFkZCBhIGNvbXBvbmVudCB0byBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hlcmUgdGhlIGNvbXBvbmVudCB3aWxsIGJlIGFkZGVkXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIGJlIGFkZGVkIHRvIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtPYmplY3R9IHZhbHVlcyBPcHRpb25hbCB2YWx1ZXMgdG8gcmVwbGFjZSB0aGUgZGVmYXVsdCBhdHRyaWJ1dGVzXG4gICAqL1xuICBlbnRpdHlBZGRDb21wb25lbnQoZW50aXR5LCBDb21wb25lbnQsIHZhbHVlcykge1xuICAgIGlmICh+ZW50aXR5Ll9Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSkgcmV0dXJuO1xuXG4gICAgZW50aXR5Ll9Db21wb25lbnRzLnB1c2goQ29tcG9uZW50KTtcblxuICAgIHZhciBjb21wb25lbnRQb29sID0gdGhpcy5fZ2V0Q29tcG9uZW50c1Bvb2woQ29tcG9uZW50KTtcbiAgICB2YXIgY29tcG9uZW50ID0gY29tcG9uZW50UG9vbC5hcXVpcmUoKTtcbiAgICB2YXIgY29tcG9uZW50TmFtZSA9IGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpO1xuXG4gICAgZW50aXR5Ll9Db21wb25lbnRzTWFwW0NvbXBvbmVudC5uYW1lXSA9IGNvbXBvbmVudDtcblxuICAgIGVudGl0eVtjb21wb25lbnROYW1lXSA9IGNvbXBvbmVudDtcbiAgICBpZiAodmFsdWVzKSB7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHZhbHVlcykge1xuICAgICAgICBjb21wb25lbnRbbmFtZV0gPSB2YWx1ZXNbbmFtZV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5QWRkZWQoZW50aXR5LCBDb21wb25lbnQpO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChDT01QT05FTlRfQURERUQsIGVudGl0eSwgQ29tcG9uZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBjb21wb25lbnQgZnJvbSBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hpY2ggd2lsbCBnZXQgcmVtb3ZlZCB0aGUgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Kn0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZW1vdmUgZnJvbSB0aGUgZW50aXR5XG4gICAqL1xuICBlbnRpdHlSZW1vdmVDb21wb25lbnQoZW50aXR5LCBDb21wb25lbnQpIHtcbiAgICB2YXIgaW5kZXggPSBlbnRpdHkuX0NvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KENPTVBPTkVOVF9SRU1PVkUsIGVudGl0eSwgQ29tcG9uZW50KTtcblxuICAgIC8vIENoZWNrIGVhY2ggaW5kZXhlZCBxdWVyeSB0byBzZWUgaWYgd2UgbmVlZCB0byByZW1vdmUgaXRcbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIub25FbnRpdHlSZW1vdmVkKGVudGl0eSwgQ29tcG9uZW50KTtcblxuICAgIC8vIFJlbW92ZSBUIGxpc3Rpbmcgb24gZW50aXR5IGFuZCBwcm9wZXJ0eSByZWYsIHRoZW4gZnJlZSB0aGUgY29tcG9uZW50LlxuICAgIGVudGl0eS5fQ29tcG9uZW50cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIHZhciBwcm9wTmFtZSA9IGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpO1xuICAgIHZhciBjb21wb25lbnQgPSBlbnRpdHlbcHJvcE5hbWVdO1xuICAgIGRlbGV0ZSBlbnRpdHlbcHJvcE5hbWVdO1xuICAgIHRoaXMuX2NvbXBvbmVudFBvb2xbcHJvcE5hbWVdLnJlbGVhc2UoY29tcG9uZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRoZSBjb21wb25lbnRzIGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IGZyb20gd2hpY2ggdGhlIGNvbXBvbmVudHMgd2lsbCBiZSByZW1vdmVkXG4gICAqL1xuICBlbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKGVudGl0eSkge1xuICAgIGxldCBDb21wb25lbnRzID0gZW50aXR5Ll9Db21wb25lbnRzO1xuXG4gICAgZm9yIChsZXQgaiA9IENvbXBvbmVudHMubGVuZ3RoIC0gMTsgaiA+PSAwOyBqLS0pIHtcbiAgICAgIHZhciBDID0gQ29tcG9uZW50c1tqXTtcbiAgICAgIGVudGl0eS5yZW1vdmVDb21wb25lbnQoQyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0aGUgZW50aXR5IGZyb20gdGhpcyBtYW5hZ2VyLiBJdCB3aWxsIGNsZWFyIGFsc28gaXRzIGNvbXBvbmVudHMgYW5kIHRhZ3NcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdG8gcmVtb3ZlIGZyb20gdGhlIG1hbmFnZXJcbiAgICovXG4gIHJlbW92ZUVudGl0eShlbnRpdHkpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLl9lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG5cbiAgICBpZiAoIX5pbmRleCkgdGhyb3cgbmV3IEVycm9yKFwiVHJpZWQgdG8gcmVtb3ZlIGVudGl0eSBub3QgaW4gbGlzdFwiKTtcblxuICAgIHRoaXMuZW50aXR5UmVtb3ZlQWxsQ29tcG9uZW50cyhlbnRpdHkpO1xuXG4gICAgLy8gUmVtb3ZlIGZyb20gZW50aXR5IGxpc3RcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KEVOVElUWV9SRU1PVkUsIGVudGl0eSk7XG4gICAgdGhpcy5fZW50aXRpZXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgIC8vIFJlbW92ZSBlbnRpdHkgZnJvbSBhbnkgdGFnIGdyb3VwcyBhbmQgY2xlYXIgdGhlIG9uLWVudGl0eSByZWZcbiAgICBlbnRpdHkuX3RhZ3MubGVuZ3RoID0gMDtcbiAgICBmb3IgKHZhciB0YWcgaW4gdGhpcy5fdGFncykge1xuICAgICAgdmFyIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddO1xuICAgICAgdmFyIG4gPSBlbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgICBpZiAofm4pIGVudGl0aWVzLnNwbGljZShuLCAxKTtcbiAgICB9XG5cbiAgICAvLyBQcmV2ZW50IGFueSBhY2Vjc3MgYW5kIGZyZWVcbiAgICBlbnRpdHkubWFuYWdlciA9IG51bGw7XG4gICAgdGhpcy5fZW50aXR5UG9vbC5yZWxlYXNlKGVudGl0eSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCBlbnRpdGllcyBmcm9tIHRoaXMgbWFuYWdlclxuICAgKi9cbiAgcmVtb3ZlQWxsRW50aXRpZXMoKSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMuX2VudGl0aWVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB0aGlzLl9lbnRpdGllc1tpXS5yZW1vdmUoKTtcbiAgICB9XG4gIH1cblxuXG4gIC8vIFRBR1NcblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0aGUgZW50aXRpZXMgdGhhdCBoYXMgdGhlIHNwZWNpZmllZCB0YWdcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZyBUYWcgdG8gZmlsdGVyIHRoZSBlbnRpdGllcyB0byBiZSByZW1vdmVkXG4gICAqL1xuICByZW1vdmVFbnRpdGllc0J5VGFnKHRhZykge1xuICAgIHZhciBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXTtcblxuICAgIGlmICghZW50aXRpZXMpIHJldHVybjtcblxuICAgIGZvciAodmFyIHggPSBlbnRpdGllcy5sZW5ndGggLSAxOyB4ID49IDA7IHgtLSkge1xuICAgICAgdmFyIGVudGl0eSA9IGVudGl0aWVzW3hdO1xuICAgICAgZW50aXR5LnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgdGFnIHRvIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB3aGljaCB3aWxsIGdldCB0aGUgdGFnXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIGFkZCB0byB0aGUgZW50aXR5XG4gICAqL1xuICBlbnRpdHlBZGRUYWcoZW50aXR5LCB0YWcpIHtcbiAgICB2YXIgZW50aXRpZXMgPSB0aGlzLl90YWdzW3RhZ107XG5cbiAgICBpZiAoIWVudGl0aWVzKSBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXSA9IFtdO1xuXG4gICAgLy8gRG9uJ3QgYWRkIGlmIGFscmVhZHkgdGhlcmVcbiAgICBpZiAofmVudGl0aWVzLmluZGV4T2YoZW50aXR5KSkgcmV0dXJuO1xuXG4gICAgLy8gQWRkIHRvIG91ciB0YWcgaW5kZXggQU5EIHRoZSBsaXN0IG9uIHRoZSBlbnRpdHlcbiAgICBlbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgZW50aXR5Ll90YWdzLnB1c2godGFnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSB0YWcgZnJvbSBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdGhhdCB3aWxsIGdldCByZW1vdmVkIHRoZSB0YWdcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZyBUYWcgdG8gcmVtb3ZlXG4gICAqL1xuICBlbnRpdHlSZW1vdmVUYWcoZW50aXR5LCB0YWcpIHtcbiAgICB2YXIgZW50aXRpZXMgPSB0aGlzLl90YWdzW3RhZ107XG4gICAgaWYgKCFlbnRpdGllcykgcmV0dXJuO1xuXG4gICAgdmFyIGluZGV4ID0gZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBvdXIgaW5kZXggQU5EIHRoZSBsaXN0IG9uIHRoZSBlbnRpdHlcbiAgICBlbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIGVudGl0eS5fdGFncy5zcGxpY2UoZW50aXR5Ll90YWdzLmluZGV4T2YodGFnKSwgMSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgcXVlcnkgYmFzZWQgb24gYSBsaXN0IG9mIGNvbXBvbmVudHNcbiAgICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIExpc3Qgb2YgY29tcG9uZW50cyB0aGF0IHdpbGwgZm9ybSB0aGUgcXVlcnlcbiAgICovXG4gIHF1ZXJ5Q29tcG9uZW50cyhDb21wb25lbnRzKSB7XG4gICAgcmV0dXJuIHRoaXMuX3F1ZXJ5TWFuYWdlci5nZXRRdWVyeShDb21wb25lbnRzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY29tcG9uZW50cyBwb29sXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgVHlwZSBvZiBjb21wb25lbnQgdHlwZSBmb3IgdGhlIHBvb2xcbiAgICovXG4gIF9nZXRDb21wb25lbnRzUG9vbChDb21wb25lbnQpIHtcbiAgICB2YXIgY29tcG9uZW50TmFtZSA9IGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpO1xuXG4gICAgaWYgKCF0aGlzLl9jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdKSB7XG4gICAgICB0aGlzLl9jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdID0gbmV3IE9iamVjdFBvb2woQ29tcG9uZW50KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXTtcbiAgfVxuXG4gIC8vIEVYVFJBU1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gbnVtYmVyIG9mIGVudGl0aWVzXG4gICAqL1xuICBjb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZW50aXRpZXMubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzb21lIHN0YXRzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBudW1FbnRpdGllczogdGhpcy5fZW50aXRpZXMubGVuZ3RoLFxuICAgICAgbnVtUXVlcmllczogT2JqZWN0LmtleXModGhpcy5fcXVlcnlNYW5hZ2VyLl9xdWVyaWVzKS5sZW5ndGgsXG4gICAgICBxdWVyaWVzOiB0aGlzLl9xdWVyeU1hbmFnZXIuc3RhdHMoKSxcbiAgICAgIG51bUNvbXBvbmVudFBvb2w6IE9iamVjdC5rZXlzKHRoaXMuX2NvbXBvbmVudFBvb2wpLmxlbmd0aCxcbiAgICAgIGNvbXBvbmVudFBvb2w6IHt9LFxuICAgICAgZXZlbnREaXNwYXRjaGVyOiB0aGlzLmV2ZW50RGlzcGF0Y2hlci5zdGF0c1xuICAgIH07XG5cbiAgICBmb3IgKHZhciBjbmFtZSBpbiB0aGlzLl9jb21wb25lbnRQb29sKSB7XG4gICAgICB2YXIgcG9vbCA9IHRoaXMuX2NvbXBvbmVudFBvb2xbY25hbWVdO1xuICAgICAgc3RhdHMuY29tcG9uZW50UG9vbFtjbmFtZV0gPSB7XG4gICAgICAgIHVzZWQ6IHBvb2wudG90YWxVc2VkKCksXG4gICAgICAgIHNpemU6IHBvb2wuY291bnRcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG5cbmNvbnN0IEVOVElUWV9DUkVBVEVEID0gXCJFbnRpdHlNYW5hZ2VyI0VOVElUWV9DUkVBVEVcIjtcbmNvbnN0IEVOVElUWV9SRU1PVkUgPSBcIkVudGl0eU1hbmFnZXIjRU5USVRZX1JFTU9WRVwiO1xuY29uc3QgQ09NUE9ORU5UX0FEREVEID0gXCJFbnRpdHlNYW5hZ2VyI0NPTVBPTkVOVF9BRERFRFwiO1xuY29uc3QgQ09NUE9ORU5UX1JFTU9WRSA9IFwiRW50aXR5TWFuYWdlciNDT01QT05FTlRfUkVNT1ZFXCI7XG4iLCJleHBvcnQgY2xhc3MgQ29tcG9uZW50TWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuQ29tcG9uZW50cyA9IHt9O1xuICAgIHRoaXMuU2luZ2xldG9uQ29tcG9uZW50cyA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlZ2lzdGVyXG4gICAqL1xuICByZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB0aGlzLkNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gQ29tcG9uZW50O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgc2luZ2xldG9uIGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZWdpc3RlciBhcyBzaW5nbGV0b25cbiAgICovXG4gIHJlZ2lzdGVyU2luZ2xldG9uQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuU2luZ2xldG9uQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBDb21wb25lbnQ7XG4gIH1cbn1cbiIsImltcG9ydCB7IFN5c3RlbU1hbmFnZXIgfSBmcm9tIFwiLi9TeXN0ZW1NYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBFbnRpdHlNYW5hZ2VyIH0gZnJvbSBcIi4vRW50aXR5TWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgQ29tcG9uZW50TWFuYWdlciB9IGZyb20gXCIuL0NvbXBvbmVudE1hbmFnZXIuanNcIjtcbmltcG9ydCB7IGNvbXBvbmVudFByb3BlcnR5TmFtZSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBXb3JsZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuZW50aXR5TWFuYWdlciA9IG5ldyBFbnRpdHlNYW5hZ2VyKCk7XG4gICAgdGhpcy5zeXN0ZW1NYW5hZ2VyID0gbmV3IFN5c3RlbU1hbmFnZXIodGhpcyk7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlciA9IG5ldyBDb21wb25lbnRNYW5hZ2VyKHRoaXMpO1xuXG4gICAgLy8gU3RvcmFnZSBmb3Igc2luZ2xldG9uIGNvbXBvbmVudHNcbiAgICB0aGlzLmNvbXBvbmVudHMgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIHNpbmdsZXRvbiBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBTaW5nbGV0b24gY29tcG9uZW50XG4gICAqL1xuICByZWdpc3RlclNpbmdsZXRvbkNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLnJlZ2lzdGVyU2luZ2xldG9uQ29tcG9uZW50KENvbXBvbmVudCk7XG4gICAgdGhpcy5jb21wb25lbnRzW2NvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpXSA9IG5ldyBDb21wb25lbnQoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50XG4gICAqL1xuICByZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLnJlZ2lzdGVyQ29tcG9uZW50KENvbXBvbmVudCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzeXN0ZW1cbiAgICogQHBhcmFtIHtTeXN0ZW19IFN5c3RlbVxuICAgKi9cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtKSB7XG4gICAgdGhpcy5zeXN0ZW1NYW5hZ2VyLnJlZ2lzdGVyU3lzdGVtKFN5c3RlbSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRoZSBzeXN0ZW1zIHBlciBmcmFtZVxuICAgKiBAcGFyYW0ge051bWJlcn0gZGVsdGEgRGVsdGEgdGltZSBzaW5jZSB0aGUgbGFzdCBjYWxsXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lIEVsYXBzZWQgdGltZVxuICAgKi9cbiAgZXhlY3V0ZShkZWx0YSwgdGltZSkge1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlci5leGVjdXRlKGRlbHRhLCB0aW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgZW50aXR5XG4gICAqL1xuICBjcmVhdGVFbnRpdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50aXR5TWFuYWdlci5jcmVhdGVFbnRpdHkoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgc29tZSBzdGF0c1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge1xuICAgICAgZW50aXRpZXM6IHRoaXMuZW50aXR5TWFuYWdlci5zdGF0cygpLFxuICAgICAgc3lzdGVtOiB0aGlzLnN5c3RlbU1hbmFnZXIuc3RhdHMoKVxuICAgIH07XG5cbiAgICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeShzdGF0cywgbnVsbCwgMikpO1xuICB9XG59XG4iLCJleHBvcnQgY2xhc3MgU3lzdGVtIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgICB0aGlzLnF1ZXJ5Q29tcG9uZW50cyA9IHRoaXMuaW5pdCA/IHRoaXMuaW5pdCgpIDogbnVsbDtcbiAgICB0aGlzLl9xdWVyaWVzID0ge307XG4gICAgdGhpcy5xdWVyaWVzID0ge307XG5cbiAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMucXVlcnlDb21wb25lbnRzKSB7XG4gICAgICB2YXIgQ29tcG9uZW50cyA9IHRoaXMucXVlcnlDb21wb25lbnRzW25hbWVdO1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy53b3JsZC5lbnRpdHlNYW5hZ2VyLnF1ZXJ5Q29tcG9uZW50cyhDb21wb25lbnRzKTtcbiAgICAgIHRoaXMuX3F1ZXJpZXNbbmFtZV0gPSBxdWVyeTtcbiAgICAgIHRoaXMucXVlcmllc1tuYW1lXSA9IHF1ZXJ5LmVudGl0aWVzO1xuICAgIH1cbiAgfVxufVxuIiwiY2xhc3MgRmxvYXRWYWxpZGF0b3Ige1xuICBzdGF0aWMgdmFsaWRhdGUobikge1xuICAgIHJldHVybiBOdW1iZXIobikgPT09IG4gJiYgbiAlIDEgIT09IDA7XG4gIH1cbn1cblxudmFyIFNjaGVtYVR5cGVzID0ge1xuICBmbG9hdDogRmxvYXRWYWxpZGF0b3JcbiAgLypcbiAgYXJyYXlcbiAgYm9vbFxuICBmdW5jXG4gIG51bWJlclxuICBvYmplY3RcbiAgc3RyaW5nXG4gIHN5bWJvbFxuXG4gIGFueVxuICBhcnJheU9mXG4gIGVsZW1lbnRcbiAgZWxlbWVudFR5cGVcbiAgaW5zdGFuY2VPZlxuICBub2RlXG4gIG9iamVjdE9mXG4gIG9uZU9mXG4gIG9uZU9mVHlwZVxuICBzaGFwZVxuICBleGFjdFxuKi9cbn07XG5cbmV4cG9ydCB7IFNjaGVtYVR5cGVzIH07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQWUsTUFBTSxlQUFlLENBQUM7RUFDbkMsV0FBVyxHQUFHO0lBQ1osSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7SUFDckIsSUFBSSxDQUFDLEtBQUssR0FBRztNQUNYLEtBQUssRUFBRSxDQUFDO01BQ1IsT0FBTyxFQUFFLENBQUM7S0FDWCxDQUFDO0dBQ0g7Ozs7Ozs7RUFPRCxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFO0lBQ3BDLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDaEMsSUFBSSxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssU0FBUyxFQUFFO01BQ3RDLFNBQVMsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUM7S0FDM0I7O0lBRUQsSUFBSSxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO01BQ2pELFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDckM7R0FDRjs7Ozs7OztFQU9ELGdCQUFnQixDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUU7SUFDcEM7TUFDRSxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxLQUFLLFNBQVM7TUFDeEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO01BQ25EO0dBQ0g7Ozs7Ozs7RUFPRCxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFF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
