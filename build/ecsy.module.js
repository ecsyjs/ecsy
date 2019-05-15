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
    //if (DEBUG) return wrapImmutableComponent(Component, component);
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

    entity._ComponentsMap[Component.name] = component;

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
    var component = entity._ComponentsMap[getName(Component)];
    //var component = entity[propName];
    //delete entity[propName];
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9FdmVudERpc3BhdGNoZXIuanMiLCIuLi9zcmMvVXRpbHMuanMiLCIuLi9zcmMvUXVlcnkuanMiLCIuLi9zcmMvUmVhY3RpdmVTeXN0ZW0uanMiLCIuLi9zcmMvU3lzdGVtTWFuYWdlci5qcyIsIi4uL3NyYy9FbnRpdHkuanMiLCIuLi9zcmMvT2JqZWN0UG9vbC5qcyIsIi4uL3NyYy9RdWVyeU1hbmFnZXIuanMiLCIuLi9zcmMvRW50aXR5TWFuYWdlci5qcyIsIi4uL3NyYy9Db21wb25lbnRNYW5hZ2VyLmpzIiwiLi4vc3JjL1dvcmxkLmpzIiwiLi4vc3JjL1N5c3RlbS5qcyIsIi4uL3NyYy9TY2hlbWFUeXBlcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCBjbGFzcyBFdmVudERpc3BhdGNoZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLl9saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLnN0YXRzID0ge1xuICAgICAgZmlyZWQ6IDAsXG4gICAgICBoYW5kbGVkOiAwXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBsaXN0ZW5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgdG8gdHJpZ2dlciB3aGVuIHRoZSBldmVudCBpcyBmaXJlZFxuICAgKi9cbiAgYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgbGV0IGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50TmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICB9XG5cbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihsaXN0ZW5lcikgPT09IC0xKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXS5wdXNoKGxpc3RlbmVyKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgYW4gZXZlbnQgbGlzdGVuZXIgaXMgYWxyZWFkeSBhZGRlZCB0byB0aGUgbGlzdCBvZiBsaXN0ZW5lcnNcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBjaGVja1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayBmb3IgdGhlIHNwZWNpZmllZCBldmVudFxuICAgKi9cbiAgaGFzRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdICE9PSB1bmRlZmluZWQgJiZcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdLmluZGV4T2YobGlzdGVuZXIpICE9PSAtMVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFuIGV2ZW50IGxpc3RlbmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50XG4gICAqL1xuICByZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICB2YXIgbGlzdGVuZXJBcnJheSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xuICAgIGlmIChsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBpbmRleCA9IGxpc3RlbmVyQXJyYXkuaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGxpc3RlbmVyQXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGlzcGF0Y2ggYW4gZXZlbnRcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBkaXNwYXRjaFxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IChPcHRpb25hbCkgRW50aXR5IHRvIGVtaXRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IGNvbXBvbmVudFxuICAgKi9cbiAgZGlzcGF0Y2hFdmVudChldmVudE5hbWUsIGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgdGhpcy5zdGF0cy5maXJlZCsrO1xuXG4gICAgdmFyIGxpc3RlbmVyQXJyYXkgPSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXTtcbiAgICBpZiAobGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgYXJyYXkgPSBsaXN0ZW5lckFycmF5LnNsaWNlKDApO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGFycmF5W2ldLmNhbGwodGhpcywgZW50aXR5LCBjb21wb25lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCBzdGF0cyBjb3VudGVyc1xuICAgKi9cbiAgcmVzZXRDb3VudGVycygpIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkID0gdGhpcy5zdGF0cy5oYW5kbGVkID0gMDtcbiAgfVxufVxuIiwiLyoqXG4gKiBSZXR1cm4gdGhlIG5hbWUgb2YgYSBjb21wb25lbnRcbiAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE5hbWUoQ29tcG9uZW50KSB7XG4gIHJldHVybiBDb21wb25lbnQubmFtZTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gYSB2YWxpZCBwcm9wZXJ0eSBuYW1lIGZvciB0aGUgQ29tcG9uZW50XG4gKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KSB7XG4gIHZhciBuYW1lID0gZ2V0TmFtZShDb21wb25lbnQpO1xuICByZXR1cm4gbmFtZS5jaGFyQXQoMCkudG9Mb3dlckNhc2UoKSArIG5hbWUuc2xpY2UoMSk7XG59XG5cbi8qKlxuICogR2V0IGEga2V5IGZyb20gYSBsaXN0IG9mIGNvbXBvbmVudHNcbiAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBBcnJheSBvZiBjb21wb25lbnRzIHRvIGdlbmVyYXRlIHRoZSBrZXlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1ZXJ5S2V5KENvbXBvbmVudHMpIHtcbiAgdmFyIG5hbWVzID0gW107XG4gIGZvciAodmFyIG4gPSAwOyBuIDwgQ29tcG9uZW50cy5sZW5ndGg7IG4rKykge1xuICAgIHZhciBUID0gQ29tcG9uZW50c1tuXTtcbiAgICBuYW1lcy5wdXNoKGdldE5hbWUoVCkpO1xuICB9XG5cbiAgcmV0dXJuIG5hbWVzXG4gICAgLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geC50b0xvd2VyQ2FzZSgpO1xuICAgIH0pXG4gICAgLnNvcnQoKVxuICAgIC5qb2luKFwiLVwiKTtcbn1cbiIsImltcG9ydCBFdmVudERpc3BhdGNoZXIgZnJvbSBcIi4vRXZlbnREaXNwYXRjaGVyLmpzXCI7XG5pbXBvcnQgeyBxdWVyeUtleSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFF1ZXJ5IHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBMaXN0IG9mIHR5cGVzIG9mIGNvbXBvbmVudHMgdG8gcXVlcnlcbiAgICovXG4gIGNvbnN0cnVjdG9yKENvbXBvbmVudHMsIG1hbmFnZXIpIHtcbiAgICB0aGlzLkNvbXBvbmVudHMgPSBDb21wb25lbnRzO1xuICAgIHRoaXMuZW50aXRpZXMgPSBbXTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlciA9IG5ldyBFdmVudERpc3BhdGNoZXIoKTtcblxuICAgIHRoaXMua2V5ID0gcXVlcnlLZXkoQ29tcG9uZW50cyk7XG5cbiAgICAvLyBGaWxsIHRoZSBxdWVyeSB3aXRoIHRoZSBleGlzdGluZyBlbnRpdGllc1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbWFuYWdlci5fZW50aXRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBlbnRpdHkgPSBtYW5hZ2VyLl9lbnRpdGllc1tpXTtcbiAgICAgIGlmIChlbnRpdHkuaGFzQWxsQ29tcG9uZW50cyhDb21wb25lbnRzKSkge1xuICAgICAgICB0aGlzLmVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHN0YXRzIGZvciB0aGlzIHF1ZXJ5XG4gICAqL1xuICBzdGF0cygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbnVtQ29tcG9uZW50czogdGhpcy5Db21wb25lbnRzLmxlbmd0aCxcbiAgICAgIG51bUVudGl0aWVzOiB0aGlzLmVudGl0aWVzLmxlbmd0aFxuICAgIH07XG4gIH1cbn1cblxuUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCA9IFwiUXVlcnkjRU5USVRZX0FEREVEXCI7XG5RdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQgPSBcIlF1ZXJ5I0VOVElUWV9SRU1PVkVEXCI7XG5RdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQgPSBcIlF1ZXJ5I0NPTVBPTkVOVF9DSEFOR0VEXCI7XG4iLCJpbXBvcnQgUXVlcnkgZnJvbSBcIi4vUXVlcnkuanNcIjtcblxuZXhwb3J0IGNsYXNzIFJlYWN0aXZlU3lzdGVtIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgICB0aGlzLnF1ZXJ5Q29tcG9uZW50cyA9IHRoaXMuaW5pdCA/IHRoaXMuaW5pdCgpIDogbnVsbDtcbiAgICB0aGlzLl9xdWVyaWVzID0ge307XG4gICAgdGhpcy5xdWVyaWVzID0ge307XG5cbiAgICB0aGlzLmNvdW50ZXJzID0ge1xuICAgICAgYWRkZWQ6IDAsXG4gICAgICByZW1vdmVkOiAwLFxuICAgICAgY2hhbmdlZDogMCxcbiAgICAgIGNvbXBvbmVudENoYW5nZWQ6IDBcbiAgICB9O1xuXG4gICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLnF1ZXJ5Q29tcG9uZW50cykge1xuICAgICAgdmFyIENvbXBvbmVudHMgPSB0aGlzLnF1ZXJ5Q29tcG9uZW50c1tuYW1lXTtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMud29ybGQuZW50aXR5TWFuYWdlci5xdWVyeUNvbXBvbmVudHMoQ29tcG9uZW50cyk7XG4gICAgICB0aGlzLl9xdWVyaWVzW25hbWVdID0gcXVlcnk7XG4gICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0gPSB7fTtcblxuICAgICAgaWYgKHRoaXMub25FbnRpdGllc0FkZGVkKSB7XG4gICAgICAgIHRoaXMucXVlcmllc1tuYW1lXS5hZGRlZCA9IFtdO1xuICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVELFxuICAgICAgICAgIGVudGl0eSA9PiB7XG4gICAgICAgICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0uYWRkZWQucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgdGhpcy5jb3VudGVycy5hZGRlZCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMub25FbnRpdGllc1JlbW92ZWQpIHtcbiAgICAgICAgdGhpcy5xdWVyaWVzW25hbWVdLnJlbW92ZWQgPSBbXTtcbiAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICAgIGVudGl0eSA9PiB7XG4gICAgICAgICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0ucmVtb3ZlZC5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICB0aGlzLmNvdW50ZXJzLnJlbW92ZWQrKztcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLm9uRW50aXRpZXNDaGFuZ2VkKSB7XG4gICAgICAgIHRoaXMucXVlcmllc1tuYW1lXS5jaGFuZ2VkID0gW107XG4gICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICBlbnRpdHkgPT4ge1xuICAgICAgICAgICAgdGhpcy5xdWVyaWVzW25hbWVdLmNoYW5nZWQucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgdGhpcy5jb3VudGVycy5jaGFuZ2VkKys7XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfVxuLypcbiAgICAgIEB0b2RvXG4gICAgICBpZiAodGhpcy5vbkNvbXBvbmVudENoYW5nZWQpIHtcbiAgICAgICAgdGhpcy5xdWVyaWVzW25hbWVdLmNvbXBvbmVudENoYW5nZWQgPSBbXTtcbiAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICAgIGVudGl0eSA9PiB7XG4gICAgICAgICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0uY29tcG9uZW50Q2hhbmdlZC5wdXNoKHtlbnRpdHk6IGVudGl0eSwgY29tcG9uZW50OiBjb21wb25lbnR9KTtcbiAgICAgICAgICAgIHRoaXMuY291bnRlcnMuY29tcG9uZW50Q2hhbmdlZCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH1cbiovXG4gICAgfVxuICB9XG5cbiAgY2xlYXJRdWVyaWVzKCkge1xuICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5xdWVyaWVzKSB7XG4gICAgICBsZXQgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbbmFtZV07XG4gICAgICBmb3IgKHZhciBldmVudCBpbiBxdWVyeSkge1xuICAgICAgICBxdWVyeVtldmVudF0ubGVuZ3RoID0gMDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb3VudGVycy5hZGRlZCA9IHRoaXMuY291bnRlcnMucmVtb3ZlZCA9IHRoaXMuY291bnRlcnMuY2hhbmdlZCA9IHRoaXMuY291bnRlcnMuY29tcG9uZW50Q2hhbmdlZCA9IDA7XG4gIH1cbn1cbiIsImltcG9ydCB7IFJlYWN0aXZlU3lzdGVtIH0gZnJvbSBcIi4vUmVhY3RpdmVTeXN0ZW0uanNcIjtcblxuZXhwb3J0IGNsYXNzIFN5c3RlbU1hbmFnZXIge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMuc3lzdGVtcyA9IFtdO1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIHN5c3RlbVxuICAgKiBAcGFyYW0ge1N5c3RlbX0gU3lzdGVtIFN5c3RlbSB0byByZWdpc3RlclxuICAgKi9cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtKSB7XG4gICAgdGhpcy5zeXN0ZW1zLnB1c2gobmV3IFN5c3RlbSh0aGlzLndvcmxkKSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgc3lzdGVtXG4gICAqIEBwYXJhbSB7U3lzdGVtfSBTeXN0ZW0gU3lzdGVtIHRvIHJlbW92ZVxuICAgKi9cbiAgcmVtb3ZlU3lzdGVtKFN5c3RlbSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuc3lzdGVtcy5pbmRleE9mKFN5c3RlbSk7XG4gICAgaWYgKCF+aW5kZXgpIHJldHVybjtcblxuICAgIHRoaXMuc3lzdGVtcy5zcGxpY2UoaW5kZXgsIDEpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBhbGwgdGhlIHN5c3RlbXMuIENhbGxlZCBwZXIgZnJhbWUuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBkZWx0YSBEZWx0YSB0aW1lIHNpbmNlIHRoZSBsYXN0IGZyYW1lXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lIEVsYXBzZWQgdGltZVxuICAgKi9cbiAgZXhlY3V0ZShkZWx0YSwgdGltZSkge1xuICAgIHRoaXMuc3lzdGVtcy5mb3JFYWNoKHN5c3RlbSA9PiB7XG4gICAgICBpZiAoc3lzdGVtLmVuYWJsZWQpIHtcbiAgICAgICAgaWYgKHN5c3RlbSBpbnN0YW5jZW9mIFJlYWN0aXZlU3lzdGVtKSB7XG4gICAgICAgICAgaWYgKHN5c3RlbS5vbkVudGl0aWVzQWRkZWQgJiYgc3lzdGVtLmNvdW50ZXJzLmFkZGVkKSB7XG4gICAgICAgICAgICBzeXN0ZW0ub25FbnRpdGllc0FkZGVkKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzeXN0ZW0ub25FbnRpdGllc1JlbW92ZWQgJiYgc3lzdGVtLmNvdW50ZXJzLnJlbW92ZWQpIHtcbiAgICAgICAgICAgIHN5c3RlbS5vbkVudGl0aWVzUmVtb3ZlZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc3lzdGVtLm9uRW50aXRpZXNDaGFuZ2VkICYmIHN5c3RlbS5jb3VudGVycy5jaGFuZ2VkKSB7XG4gICAgICAgICAgICBzeXN0ZW0ub25FbnRpdGllc0NoYW5nZWQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc3lzdGVtLmV4ZWN1dGUpIHtcbiAgICAgICAgICBzeXN0ZW0uZXhlY3V0ZShkZWx0YSwgdGltZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuc3lzdGVtcy5mb3JFYWNoKHN5c3RlbSA9PiB7XG4gICAgICBpZiAoc3lzdGVtIGluc3RhbmNlb2YgUmVhY3RpdmVTeXN0ZW0pIHtcbiAgICAgICAgc3lzdGVtLmNsZWFyUXVlcmllcygpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzdGF0c1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge1xuICAgICAgbnVtU3lzdGVtczogdGhpcy5zeXN0ZW1zLmxlbmd0aCxcbiAgICAgIHN5c3RlbXM6IHt9XG4gICAgfTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5zeXN0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc3lzdGVtID0gdGhpcy5zeXN0ZW1zW2ldO1xuICAgICAgdmFyIHN5c3RlbVN0YXRzID0gKHN0YXRzLnN5c3RlbXNbc3lzdGVtLmNvbnN0cnVjdG9yLm5hbWVdID0ge1xuICAgICAgICBxdWVyaWVzOiB7fVxuICAgICAgfSk7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHN5c3RlbS5jdHgpIHtcbiAgICAgICAgc3lzdGVtU3RhdHMucXVlcmllc1tuYW1lXSA9IHN5c3RlbS5jdHhbbmFtZV0uc3RhdHMoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuaW1wb3J0IHdyYXBJbW11dGFibGVDb21wb25lbnQgZnJvbSBcIi4vV3JhcEltbXV0YWJsZUNvbXBvbmVudC5qc1wiO1xuXG4vLyBAdG9kbyBUYWtlIHRoaXMgb3V0IGZyb20gdGhlcmUgb3IgdXNlIEVOVlxuY29uc3QgREVCVUcgPSB0cnVlO1xuXG4vLyBAdG9kbyByZXNldCBpdCBieSB3b3JsZD9cbnZhciBuZXh0SWQgPSAwO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFbnRpdHkge1xuICBjb25zdHJ1Y3RvcihtYW5hZ2VyKSB7XG4gICAgdGhpcy5fbWFuYWdlciA9IG1hbmFnZXIgfHwgbnVsbDtcblxuICAgIC8vIFVuaXF1ZSBJRCBmb3IgdGhpcyBlbnRpdHlcbiAgICB0aGlzLmlkID0gbmV4dElkKys7XG5cbiAgICAvLyBMaXN0IG9mIGNvbXBvbmVudHMgdHlwZXMgdGhlIGVudGl0eSBoYXNcbiAgICB0aGlzLl9Db21wb25lbnRzID0gW107XG5cbiAgICAvLyBJbnN0YW5jZSBvZiB0aGUgY29tcG9uZW50c1xuICAgIHRoaXMuX0NvbXBvbmVudHNNYXAgPSB7fTtcblxuICAgIC8vIExpc3Qgb2YgdGFncyB0aGlzIGVudGl0eSBoYXNcbiAgICB0aGlzLl90YWdzID0gW107XG5cbiAgICAvLyBRdWVyaWVzIHdoZXJlIHRoZSBlbnRpdHkgaXMgYWRkZWRcbiAgICB0aGlzLnF1ZXJpZXMgPSBbXTtcbiAgfVxuXG4gIC8vIENPTVBPTkVOVFNcblxuICAvKipcbiAgICogUmV0dXJuIGFuIGltbXV0YWJsZSByZWZlcmVuY2Ugb2YgYSBjb21wb25lbnRcbiAgICogTm90ZTogQSBwcm94eSB3aWxsIGJlIHVzZWQgb24gZGVidWcgbW9kZSwgYW5kIGl0IHdpbGwganVzdCBhZmZlY3RcbiAgICogICAgICAgdGhlIGZpcnN0IGxldmVsIGF0dHJpYnV0ZXMgb24gdGhlIG9iamVjdCwgaXQgd29uJ3Qgd29yayByZWN1cnNpdmVseS5cbiAgICogQHBhcmFtIHtDb21wb25lbnR9IFR5cGUgb2YgY29tcG9uZW50IHRvIGdldFxuICAgKiBAcmV0dXJuIHtDb21wb25lbnR9IEltbXV0YWJsZSBjb21wb25lbnQgcmVmZXJlbmNlXG4gICAqL1xuICBnZXRDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IHRoaXMuX0NvbXBvbmVudHNNYXBbQ29tcG9uZW50Lm5hbWVdO1xuICAgIC8vaWYgKERFQlVHKSByZXR1cm4gd3JhcEltbXV0YWJsZUNvbXBvbmVudChDb21wb25lbnQsIGNvbXBvbmVudCk7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBtdXRhYmxlIHJlZmVyZW5jZSBvZiBhIGNvbXBvbmVudC5cbiAgICogQHBhcmFtIHtDb21wb25lbnR9IFR5cGUgb2YgY29tcG9uZW50IHRvIGdldFxuICAgKiBAcmV0dXJuIHtDb21wb25lbnR9IE11dGFibGUgY29tcG9uZW50IHJlZmVyZW5jZVxuICAgKi9cbiAgZ2V0TXV0YWJsZUNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcy5fQ29tcG9uZW50c01hcFtDb21wb25lbnQubmFtZV07XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnF1ZXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMucXVlcmllc1tpXTtcbiAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBRdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQsXG4gICAgICAgIHRoaXMsXG4gICAgICAgIGNvbXBvbmVudFxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSBjb21wb25lbnQgdG8gdGhlIGVudGl0eVxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IHRvIGFkZCB0byB0aGlzIGVudGl0eVxuICAgKiBAcGFyYW0ge09iamVjdH0gT3B0aW9uYWwgdmFsdWVzIHRvIHJlcGxhY2UgdGhlIGRlZmF1bHQgYXR0cmlidXRlcyBvbiB0aGUgY29tcG9uZW50XG4gICAqL1xuICBhZGRDb21wb25lbnQoQ29tcG9uZW50LCB2YWx1ZXMpIHtcbiAgICB0aGlzLl9tYW5hZ2VyLmVudGl0eUFkZENvbXBvbmVudCh0aGlzLCBDb21wb25lbnQsIHZhbHVlcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgY29tcG9uZW50IGZyb20gdGhlIGVudGl0eVxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZUNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB0aGlzLl9tYW5hZ2VyLmVudGl0eVJlbW92ZUNvbXBvbmVudCh0aGlzLCBDb21wb25lbnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGEgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgdG8gY2hlY2tcbiAgICovXG4gIGhhc0NvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICByZXR1cm4gISF+dGhpcy5fQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCk7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhlIGVudGl0eSBoYXMgYSBsaXN0IG9mIGNvbXBvbmVudHNcbiAgICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIHRvIGNoZWNrXG4gICAqL1xuICBoYXNBbGxDb21wb25lbnRzKENvbXBvbmVudHMpIHtcbiAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0ID0gcmVzdWx0ICYmICEhfnRoaXMuX0NvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnRzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbGwgdGhlIGNvbXBvbmVudHMgZnJvbSB0aGUgZW50aXR5XG4gICAqL1xuICByZW1vdmVBbGxDb21wb25lbnRzKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW5hZ2VyLmVudGl0eVJlbW92ZUFsbENvbXBvbmVudHModGhpcyk7XG4gIH1cblxuICAvLyBUQUdTXG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGEgdGFnXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIGNoZWNrXG4gICAqL1xuICBoYXNUYWcodGFnKSB7XG4gICAgcmV0dXJuICEhfnRoaXMuX3RhZ3MuaW5kZXhPZih0YWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIHRhZyB0byB0aGlzIGVudGl0eVxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byBhZGQgdG8gdGhpcyBlbnRpdHlcbiAgICovXG4gIGFkZFRhZyh0YWcpIHtcbiAgICB0aGlzLl9tYW5hZ2VyLmVudGl0eUFkZFRhZyh0aGlzLCB0YWcpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIHRhZyBmcm9tIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZyBUYWcgdG8gcmVtb3ZlIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlVGFnKHRhZykge1xuICAgIHRoaXMuX21hbmFnZXIuZW50aXR5UmVtb3ZlVGFnKHRoaXMsIHRhZyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBFWFRSQVNcblxuICAvKipcbiAgICogSW5pdGlhbGl6ZSB0aGUgZW50aXR5LiBUbyBiZSB1c2VkIHdoZW4gcmV0dXJuaW5nIGFuIGVudGl0eSB0byB0aGUgcG9vbFxuICAgKi9cbiAgX19pbml0KCkge1xuICAgIHRoaXMuaWQgPSBuZXh0SWQrKztcbiAgICB0aGlzLl9tYW5hZ2VyID0gbnVsbDtcbiAgICB0aGlzLl9Db21wb25lbnRzLmxlbmd0aCA9IDA7XG4gICAgdGhpcy5fdGFncy5sZW5ndGggPSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIERpc3Bvc2UgdGhlIGVudGl0eSBmcm9tIHRoZSBtYW5hZ2VyXG4gICAqL1xuICBkaXNwb3NlKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW5hZ2VyLnJlbW92ZUVudGl0eSh0aGlzKTtcbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgT2JqZWN0UG9vbCB7XG4gIGNvbnN0cnVjdG9yKFQpIHtcbiAgICB0aGlzLmZyZWVMaXN0ID0gW107XG4gICAgdGhpcy5jb3VudCA9IDA7XG4gICAgdGhpcy5UID0gVDtcblxuICAgIHZhciBleHRyYUFyZ3MgPSBudWxsO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgZXh0cmFBcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIGV4dHJhQXJncy5zaGlmdCgpO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRlRWxlbWVudCA9IGV4dHJhQXJnc1xuICAgICAgPyAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBUKC4uLmV4dHJhQXJncyk7XG4gICAgICAgIH1cbiAgICAgIDogKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgVCgpO1xuICAgICAgICB9O1xuXG4gICAgdGhpcy5pbml0aWFsT2JqZWN0ID0gdGhpcy5jcmVhdGVFbGVtZW50KCk7XG4gIH1cblxuICBhcXVpcmUoKSB7XG4gICAgLy8gR3JvdyB0aGUgbGlzdCBieSAyMCVpc2ggaWYgd2UncmUgb3V0XG4gICAgaWYgKHRoaXMuZnJlZUxpc3QubGVuZ3RoIDw9IDApIHtcbiAgICAgIHRoaXMuZXhwYW5kKE1hdGgucm91bmQodGhpcy5jb3VudCAqIDAuMikgKyAxKTtcbiAgICB9XG5cbiAgICB2YXIgaXRlbSA9IHRoaXMuZnJlZUxpc3QucG9wKCk7XG5cbiAgICAvLyBXZSBjYW4gcHJvdmlkZSBleHBsaWNpdCBpbml0aW5nLCBvdGhlcndpc2Ugd2UgY29weSB0aGUgdmFsdWUgb2YgdGhlIGluaXRpYWwgY29tcG9uZW50XG4gICAgaWYgKGl0ZW0uX19pbml0KSBpdGVtLl9faW5pdCgpO1xuICAgIGVsc2UgaWYgKGl0ZW0uY29weSkgaXRlbS5jb3B5KHRoaXMuaW5pdGlhbE9iamVjdCk7XG5cbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuXG4gIHJlbGVhc2UoaXRlbSkge1xuICAgIHRoaXMuZnJlZUxpc3QucHVzaChpdGVtKTtcbiAgfVxuXG4gIGV4cGFuZChjb3VudCkge1xuICAgIGZvciAodmFyIG4gPSAwOyBuIDwgY291bnQ7IG4rKykge1xuICAgICAgdGhpcy5mcmVlTGlzdC5wdXNoKHRoaXMuY3JlYXRlRWxlbWVudCgpKTtcbiAgICB9XG4gICAgdGhpcy5jb3VudCArPSBjb3VudDtcbiAgfVxuXG4gIHRvdGFsU2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb3VudDtcbiAgfVxuXG4gIHRvdGFsRnJlZSgpIHtcbiAgICByZXR1cm4gdGhpcy5mcmVlTGlzdC5sZW5ndGg7XG4gIH1cblxuICB0b3RhbFVzZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuY291bnQgLSB0aGlzLmZyZWVMaXN0Lmxlbmd0aDtcbiAgfVxufVxuIiwiaW1wb3J0IFF1ZXJ5IGZyb20gXCIuL1F1ZXJ5LmpzXCI7XG5pbXBvcnQgeyBxdWVyeUtleSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFF1ZXJ5TWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKG1hbmFnZXIpIHtcbiAgICB0aGlzLl9tYW5hZ2VyID0gbWFuYWdlcjtcblxuICAgIC8vIFF1ZXJpZXMgaW5kZXhlZCBieSBhIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgY29tcG9uZW50cyBpdCBoYXNcbiAgICB0aGlzLl9xdWVyaWVzID0ge307XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2hlbiBhIGNvbXBvbmVudCBpcyBhZGRlZCB0byBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdGhhdCBqdXN0IGdvdCB0aGUgbmV3IGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCBhZGRlZCB0byB0aGUgZW50aXR5XG4gICAqL1xuICBvbkVudGl0eUFkZGVkKGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgLy8gQHRvZG8gVXNlIGJpdG1hc2sgZm9yIGNoZWNraW5nIGNvbXBvbmVudHM/XG5cbiAgICAvLyBDaGVjayBlYWNoIGluZGV4ZWQgcXVlcnkgdG8gc2VlIGlmIHdlIG5lZWQgdG8gYWRkIHRoaXMgZW50aXR5IHRvIHRoZSBsaXN0XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXTtcblxuICAgICAgLy8gQWRkIHRoZSBlbnRpdHkgb25seSBpZjpcbiAgICAgIC8vIENvbXBvbmVudCBpcyBpbiB0aGUgcXVlcnlcbiAgICAgIC8vIGFuZCBFbnRpdHkgaGFzIEFMTCB0aGUgY29tcG9uZW50cyBvZiB0aGUgcXVlcnlcbiAgICAgIC8vIGFuZCBFbnRpdHkgaXMgbm90IGFscmVhZHkgaW4gdGhlIHF1ZXJ5XG4gICAgICBpZiAoXG4gICAgICAgICF+cXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgfHxcbiAgICAgICAgIWVudGl0eS5oYXNBbGxDb21wb25lbnRzKHF1ZXJ5LkNvbXBvbmVudHMpIHx8XG4gICAgICAgIH5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSlcbiAgICAgIClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQsIGVudGl0eSk7XG5cbiAgICAgIGVudGl0eS5xdWVyaWVzLnB1c2gocXVlcnkpO1xuICAgICAgcXVlcnkuZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB3aGVuIGEgY29tcG9uZW50IGlzIHJlbW92ZWQgZnJvbSBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdG8gcmVtb3ZlIHRoZSBjb21wb25lbnQgZnJvbVxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZW1vdmUgZnJvbSB0aGUgZW50aXR5XG4gICAqL1xuICBvbkVudGl0eVJlbW92ZWQoZW50aXR5LCBDb21wb25lbnQpIHtcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdO1xuXG4gICAgICBpZiAoIX5xdWVyeS5Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSkgY29udGludWU7XG4gICAgICBpZiAoIWVudGl0eS5oYXNBbGxDb21wb25lbnRzKHF1ZXJ5LkNvbXBvbmVudHMpKSBjb250aW51ZTtcblxuICAgICAgdmFyIGluZGV4ID0gcXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuICAgICAgaWYgKH5pbmRleCkge1xuICAgICAgICBxdWVyeS5lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICAgIGluZGV4ID0gZW50aXR5LnF1ZXJpZXMuaW5kZXhPZihxdWVyeSk7XG4gICAgICAgIGVudGl0eS5xdWVyaWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoXG4gICAgICAgICAgUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICAgIGVudGl0eVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBxdWVyeSBmb3IgdGhlIHNwZWNpZmllZCBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRzIENvbXBvbmVudHMgdGhhdCB0aGUgcXVlcnkgc2hvdWxkIGhhdmVcbiAgICovXG4gIGdldFF1ZXJ5KENvbXBvbmVudHMpIHtcbiAgICB2YXIga2V5ID0gcXVlcnlLZXkoQ29tcG9uZW50cyk7XG4gICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1trZXldO1xuICAgIGlmICghcXVlcnkpIHtcbiAgICAgIHRoaXMuX3F1ZXJpZXNba2V5XSA9IHF1ZXJ5ID0gbmV3IFF1ZXJ5KENvbXBvbmVudHMsIHRoaXMuX21hbmFnZXIpO1xuICAgIH1cbiAgICByZXR1cm4gcXVlcnk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHNvbWUgc3RhdHMgZnJvbSB0aGlzIGNsYXNzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7fTtcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgc3RhdHNbcXVlcnlOYW1lXSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXS5zdGF0cygpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cbiIsImltcG9ydCBFbnRpdHkgZnJvbSBcIi4vRW50aXR5LmpzXCI7XG5pbXBvcnQgT2JqZWN0UG9vbCBmcm9tIFwiLi9PYmplY3RQb29sLmpzXCI7XG5pbXBvcnQgUXVlcnlNYW5hZ2VyIGZyb20gXCIuL1F1ZXJ5TWFuYWdlci5qc1wiO1xuaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcbmltcG9ydCB7IGNvbXBvbmVudFByb3BlcnR5TmFtZSwgZ2V0TmFtZSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBFbnRpdHlNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5fZW50aXRpZXMgPSBbXTtcbiAgICB0aGlzLl9jb21wb25lbnRQb29sID0gW107XG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyID0gbmV3IFF1ZXJ5TWFuYWdlcih0aGlzKTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlciA9IG5ldyBFdmVudERpc3BhdGNoZXIoKTtcbiAgICB0aGlzLl9lbnRpdHlQb29sID0gbmV3IE9iamVjdFBvb2woRW50aXR5KTtcbiAgICB0aGlzLl90YWdzID0ge307XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGVudGl0eVxuICAgKi9cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHZhciBlbnRpdHkgPSB0aGlzLl9lbnRpdHlQb29sLmFxdWlyZSgpO1xuICAgIGVudGl0eS5fbWFuYWdlciA9IHRoaXM7XG4gICAgdGhpcy5fZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoRU5USVRZX0NSRUFURUQsIGVudGl0eSk7XG4gICAgcmV0dXJuIGVudGl0eTtcbiAgfVxuXG4gIC8vIENPTVBPTkVOVFNcblxuICAvKipcbiAgICogQWRkIGEgY29tcG9uZW50IHRvIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB3aGVyZSB0aGUgY29tcG9uZW50IHdpbGwgYmUgYWRkZWRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gYmUgYWRkZWQgdG8gdGhlIGVudGl0eVxuICAgKiBAcGFyYW0ge09iamVjdH0gdmFsdWVzIE9wdGlvbmFsIHZhbHVlcyB0byByZXBsYWNlIHRoZSBkZWZhdWx0IGF0dHJpYnV0ZXNcbiAgICovXG4gIGVudGl0eUFkZENvbXBvbmVudChlbnRpdHksIENvbXBvbmVudCwgdmFsdWVzKSB7XG4gICAgaWYgKH5lbnRpdHkuX0NvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpKSByZXR1cm47XG5cbiAgICBlbnRpdHkuX0NvbXBvbmVudHMucHVzaChDb21wb25lbnQpO1xuXG4gICAgdmFyIGNvbXBvbmVudFBvb2wgPSB0aGlzLl9nZXRDb21wb25lbnRzUG9vbChDb21wb25lbnQpO1xuICAgIHZhciBjb21wb25lbnQgPSBjb21wb25lbnRQb29sLmFxdWlyZSgpO1xuXG4gICAgZW50aXR5Ll9Db21wb25lbnRzTWFwW0NvbXBvbmVudC5uYW1lXSA9IGNvbXBvbmVudDtcblxuICAgIGlmICh2YWx1ZXMpIHtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gdmFsdWVzKSB7XG4gICAgICAgIGNvbXBvbmVudFtuYW1lXSA9IHZhbHVlc1tuYW1lXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIub25FbnRpdHlBZGRlZChlbnRpdHksIENvbXBvbmVudCk7XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KENPTVBPTkVOVF9BRERFRCwgZW50aXR5LCBDb21wb25lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIGNvbXBvbmVudCBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB3aGljaCB3aWxsIGdldCByZW1vdmVkIHRoZSBjb21wb25lbnRcbiAgICogQHBhcmFtIHsqfSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIGVudGl0eVJlbW92ZUNvbXBvbmVudChlbnRpdHksIENvbXBvbmVudCkge1xuICAgIHZhciBpbmRleCA9IGVudGl0eS5fQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCk7XG4gICAgaWYgKCF+aW5kZXgpIHJldHVybjtcblxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoQ09NUE9ORU5UX1JFTU9WRSwgZW50aXR5LCBDb21wb25lbnQpO1xuXG4gICAgLy8gQ2hlY2sgZWFjaCBpbmRleGVkIHF1ZXJ5IHRvIHNlZSBpZiB3ZSBuZWVkIHRvIHJlbW92ZSBpdFxuICAgIHRoaXMuX3F1ZXJ5TWFuYWdlci5vbkVudGl0eVJlbW92ZWQoZW50aXR5LCBDb21wb25lbnQpO1xuXG4gICAgLy8gUmVtb3ZlIFQgbGlzdGluZyBvbiBlbnRpdHkgYW5kIHByb3BlcnR5IHJlZiwgdGhlbiBmcmVlIHRoZSBjb21wb25lbnQuXG4gICAgZW50aXR5Ll9Db21wb25lbnRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgdmFyIHByb3BOYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG4gICAgdmFyIGNvbXBvbmVudCA9IGVudGl0eS5fQ29tcG9uZW50c01hcFtnZXROYW1lKENvbXBvbmVudCldO1xuICAgIC8vdmFyIGNvbXBvbmVudCA9IGVudGl0eVtwcm9wTmFtZV07XG4gICAgLy9kZWxldGUgZW50aXR5W3Byb3BOYW1lXTtcbiAgICB0aGlzLl9jb21wb25lbnRQb29sW3Byb3BOYW1lXS5yZWxlYXNlKGNvbXBvbmVudCk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0aGUgY29tcG9uZW50cyBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSBmcm9tIHdoaWNoIHRoZSBjb21wb25lbnRzIHdpbGwgYmUgcmVtb3ZlZFxuICAgKi9cbiAgZW50aXR5UmVtb3ZlQWxsQ29tcG9uZW50cyhlbnRpdHkpIHtcbiAgICBsZXQgQ29tcG9uZW50cyA9IGVudGl0eS5fQ29tcG9uZW50cztcblxuICAgIGZvciAobGV0IGogPSBDb21wb25lbnRzLmxlbmd0aCAtIDE7IGogPj0gMDsgai0tKSB7XG4gICAgICB2YXIgQyA9IENvbXBvbmVudHNbal07XG4gICAgICBlbnRpdHkucmVtb3ZlQ29tcG9uZW50KEMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhlIGVudGl0eSBmcm9tIHRoaXMgbWFuYWdlci4gSXQgd2lsbCBjbGVhciBhbHNvIGl0cyBjb21wb25lbnRzIGFuZCB0YWdzXG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRvIHJlbW92ZSBmcm9tIHRoZSBtYW5hZ2VyXG4gICAqL1xuICByZW1vdmVFbnRpdHkoZW50aXR5KSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5fZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuXG4gICAgaWYgKCF+aW5kZXgpIHRocm93IG5ldyBFcnJvcihcIlRyaWVkIHRvIHJlbW92ZSBlbnRpdHkgbm90IGluIGxpc3RcIik7XG5cbiAgICB0aGlzLmVudGl0eVJlbW92ZUFsbENvbXBvbmVudHMoZW50aXR5KTtcblxuICAgIC8vIFJlbW92ZSBmcm9tIGVudGl0eSBsaXN0XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChFTlRJVFlfUkVNT1ZFLCBlbnRpdHkpO1xuICAgIHRoaXMuX2VudGl0aWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAvLyBSZW1vdmUgZW50aXR5IGZyb20gYW55IHRhZyBncm91cHMgYW5kIGNsZWFyIHRoZSBvbi1lbnRpdHkgcmVmXG4gICAgZW50aXR5Ll90YWdzLmxlbmd0aCA9IDA7XG4gICAgZm9yICh2YXIgdGFnIGluIHRoaXMuX3RhZ3MpIHtcbiAgICAgIHZhciBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXTtcbiAgICAgIHZhciBuID0gZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuICAgICAgaWYgKH5uKSBlbnRpdGllcy5zcGxpY2UobiwgMSk7XG4gICAgfVxuXG4gICAgLy8gUHJldmVudCBhbnkgYWNlY3NzIGFuZCBmcmVlXG4gICAgZW50aXR5Lm1hbmFnZXIgPSBudWxsO1xuICAgIHRoaXMuX2VudGl0eVBvb2wucmVsZWFzZShlbnRpdHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbGwgZW50aXRpZXMgZnJvbSB0aGlzIG1hbmFnZXJcbiAgICovXG4gIHJlbW92ZUFsbEVudGl0aWVzKCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLl9lbnRpdGllcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdGhpcy5fZW50aXRpZXNbaV0ucmVtb3ZlKCk7XG4gICAgfVxuICB9XG5cblxuICAvLyBUQUdTXG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbGwgdGhlIGVudGl0aWVzIHRoYXQgaGFzIHRoZSBzcGVjaWZpZWQgdGFnXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIGZpbHRlciB0aGUgZW50aXRpZXMgdG8gYmUgcmVtb3ZlZFxuICAgKi9cbiAgcmVtb3ZlRW50aXRpZXNCeVRhZyh0YWcpIHtcbiAgICB2YXIgZW50aXRpZXMgPSB0aGlzLl90YWdzW3RhZ107XG5cbiAgICBpZiAoIWVudGl0aWVzKSByZXR1cm47XG5cbiAgICBmb3IgKHZhciB4ID0gZW50aXRpZXMubGVuZ3RoIC0gMTsgeCA+PSAwOyB4LS0pIHtcbiAgICAgIHZhciBlbnRpdHkgPSBlbnRpdGllc1t4XTtcbiAgICAgIGVudGl0eS5yZW1vdmUoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkIHRhZyB0byBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hpY2ggd2lsbCBnZXQgdGhlIHRhZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byBhZGQgdG8gdGhlIGVudGl0eVxuICAgKi9cbiAgZW50aXR5QWRkVGFnKGVudGl0eSwgdGFnKSB7XG4gICAgdmFyIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddO1xuXG4gICAgaWYgKCFlbnRpdGllcykgZW50aXRpZXMgPSB0aGlzLl90YWdzW3RhZ10gPSBbXTtcblxuICAgIC8vIERvbid0IGFkZCBpZiBhbHJlYWR5IHRoZXJlXG4gICAgaWYgKH5lbnRpdGllcy5pbmRleE9mKGVudGl0eSkpIHJldHVybjtcblxuICAgIC8vIEFkZCB0byBvdXIgdGFnIGluZGV4IEFORCB0aGUgbGlzdCBvbiB0aGUgZW50aXR5XG4gICAgZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgIGVudGl0eS5fdGFncy5wdXNoKHRhZyk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgdGFnIGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRoYXQgd2lsbCBnZXQgcmVtb3ZlZCB0aGUgdGFnXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIHJlbW92ZVxuICAgKi9cbiAgZW50aXR5UmVtb3ZlVGFnKGVudGl0eSwgdGFnKSB7XG4gICAgdmFyIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddO1xuICAgIGlmICghZW50aXRpZXMpIHJldHVybjtcblxuICAgIHZhciBpbmRleCA9IGVudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgLy8gUmVtb3ZlIGZyb20gb3VyIGluZGV4IEFORCB0aGUgbGlzdCBvbiB0aGUgZW50aXR5XG4gICAgZW50aXRpZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICBlbnRpdHkuX3RhZ3Muc3BsaWNlKGVudGl0eS5fdGFncy5pbmRleE9mKHRhZyksIDEpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHF1ZXJ5IGJhc2VkIG9uIGEgbGlzdCBvZiBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBMaXN0IG9mIGNvbXBvbmVudHMgdGhhdCB3aWxsIGZvcm0gdGhlIHF1ZXJ5XG4gICAqL1xuICBxdWVyeUNvbXBvbmVudHMoQ29tcG9uZW50cykge1xuICAgIHJldHVybiB0aGlzLl9xdWVyeU1hbmFnZXIuZ2V0UXVlcnkoQ29tcG9uZW50cyk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGNvbXBvbmVudHMgcG9vbFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IFR5cGUgb2YgY29tcG9uZW50IHR5cGUgZm9yIHRoZSBwb29sXG4gICAqL1xuICBfZ2V0Q29tcG9uZW50c1Bvb2woQ29tcG9uZW50KSB7XG4gICAgdmFyIGNvbXBvbmVudE5hbWUgPSBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KTtcblxuICAgIGlmICghdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXSkge1xuICAgICAgdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXSA9IG5ldyBPYmplY3RQb29sKENvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV07XG4gIH1cblxuICAvLyBFWFRSQVNcblxuICAvKipcbiAgICogUmV0dXJuIG51bWJlciBvZiBlbnRpdGllc1xuICAgKi9cbiAgY291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2VudGl0aWVzLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc29tZSBzdGF0c1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge1xuICAgICAgbnVtRW50aXRpZXM6IHRoaXMuX2VudGl0aWVzLmxlbmd0aCxcbiAgICAgIG51bVF1ZXJpZXM6IE9iamVjdC5rZXlzKHRoaXMuX3F1ZXJ5TWFuYWdlci5fcXVlcmllcykubGVuZ3RoLFxuICAgICAgcXVlcmllczogdGhpcy5fcXVlcnlNYW5hZ2VyLnN0YXRzKCksXG4gICAgICBudW1Db21wb25lbnRQb29sOiBPYmplY3Qua2V5cyh0aGlzLl9jb21wb25lbnRQb29sKS5sZW5ndGgsXG4gICAgICBjb21wb25lbnRQb29sOiB7fSxcbiAgICAgIGV2ZW50RGlzcGF0Y2hlcjogdGhpcy5ldmVudERpc3BhdGNoZXIuc3RhdHNcbiAgICB9O1xuXG4gICAgZm9yICh2YXIgY25hbWUgaW4gdGhpcy5fY29tcG9uZW50UG9vbCkge1xuICAgICAgdmFyIHBvb2wgPSB0aGlzLl9jb21wb25lbnRQb29sW2NuYW1lXTtcbiAgICAgIHN0YXRzLmNvbXBvbmVudFBvb2xbY25hbWVdID0ge1xuICAgICAgICB1c2VkOiBwb29sLnRvdGFsVXNlZCgpLFxuICAgICAgICBzaXplOiBwb29sLmNvdW50XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuXG5jb25zdCBFTlRJVFlfQ1JFQVRFRCA9IFwiRW50aXR5TWFuYWdlciNFTlRJVFlfQ1JFQVRFXCI7XG5jb25zdCBFTlRJVFlfUkVNT1ZFID0gXCJFbnRpdHlNYW5hZ2VyI0VOVElUWV9SRU1PVkVcIjtcbmNvbnN0IENPTVBPTkVOVF9BRERFRCA9IFwiRW50aXR5TWFuYWdlciNDT01QT05FTlRfQURERURcIjtcbmNvbnN0IENPTVBPTkVOVF9SRU1PVkUgPSBcIkVudGl0eU1hbmFnZXIjQ09NUE9ORU5UX1JFTU9WRVwiO1xuIiwiZXhwb3J0IGNsYXNzIENvbXBvbmVudE1hbmFnZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLkNvbXBvbmVudHMgPSB7fTtcbiAgICB0aGlzLlNpbmdsZXRvbkNvbXBvbmVudHMgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZWdpc3RlclxuICAgKi9cbiAgcmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IENvbXBvbmVudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIHNpbmdsZXRvbiBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gcmVnaXN0ZXIgYXMgc2luZ2xldG9uXG4gICAqL1xuICByZWdpc3RlclNpbmdsZXRvbkNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB0aGlzLlNpbmdsZXRvbkNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gQ29tcG9uZW50O1xuICB9XG59XG4iLCJpbXBvcnQgeyBTeXN0ZW1NYW5hZ2VyIH0gZnJvbSBcIi4vU3lzdGVtTWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgRW50aXR5TWFuYWdlciB9IGZyb20gXCIuL0VudGl0eU1hbmFnZXIuanNcIjtcbmltcG9ydCB7IENvbXBvbmVudE1hbmFnZXIgfSBmcm9tIFwiLi9Db21wb25lbnRNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBjb21wb25lbnRQcm9wZXJ0eU5hbWUgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG5leHBvcnQgY2xhc3MgV29ybGQge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmVudGl0eU1hbmFnZXIgPSBuZXcgRW50aXR5TWFuYWdlcigpO1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlciA9IG5ldyBTeXN0ZW1NYW5hZ2VyKHRoaXMpO1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIgPSBuZXcgQ29tcG9uZW50TWFuYWdlcih0aGlzKTtcblxuICAgIC8vIFN0b3JhZ2UgZm9yIHNpbmdsZXRvbiBjb21wb25lbnRzXG4gICAgdGhpcy5jb21wb25lbnRzID0ge307XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzaW5nbGV0b24gY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgU2luZ2xldG9uIGNvbXBvbmVudFxuICAgKi9cbiAgcmVnaXN0ZXJTaW5nbGV0b25Db21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5yZWdpc3RlclNpbmdsZXRvbkNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIHRoaXMuY29tcG9uZW50c1tjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KV0gPSBuZXcgQ29tcG9uZW50KCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICAgKi9cbiAgcmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5yZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgc3lzdGVtXG4gICAqIEBwYXJhbSB7U3lzdGVtfSBTeXN0ZW1cbiAgICovXG4gIHJlZ2lzdGVyU3lzdGVtKFN5c3RlbSkge1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlci5yZWdpc3RlclN5c3RlbShTeXN0ZW0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgc3lzdGVtcyBwZXIgZnJhbWVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbHRhIERlbHRhIHRpbWUgc2luY2UgdGhlIGxhc3QgY2FsbFxuICAgKiBAcGFyYW0ge051bWJlcn0gdGltZSBFbGFwc2VkIHRpbWVcbiAgICovXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUpIHtcbiAgICB0aGlzLnN5c3RlbU1hbmFnZXIuZXhlY3V0ZShkZWx0YSwgdGltZSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGVudGl0eVxuICAgKi9cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLmVudGl0eU1hbmFnZXIuY3JlYXRlRW50aXR5KCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHNvbWUgc3RhdHNcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIGVudGl0aWVzOiB0aGlzLmVudGl0eU1hbmFnZXIuc3RhdHMoKSxcbiAgICAgIHN5c3RlbTogdGhpcy5zeXN0ZW1NYW5hZ2VyLnN0YXRzKClcbiAgICB9O1xuXG4gICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoc3RhdHMsIG51bGwsIDIpKTtcbiAgfVxufVxuIiwiZXhwb3J0IGNsYXNzIFN5c3RlbSB7XG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy53b3JsZCA9IHdvcmxkO1xuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG4gICAgdGhpcy5xdWVyeUNvbXBvbmVudHMgPSB0aGlzLmluaXQgPyB0aGlzLmluaXQoKSA6IG51bGw7XG4gICAgdGhpcy5fcXVlcmllcyA9IHt9O1xuICAgIHRoaXMucXVlcmllcyA9IHt9O1xuXG4gICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLnF1ZXJ5Q29tcG9uZW50cykge1xuICAgICAgdmFyIENvbXBvbmVudHMgPSB0aGlzLnF1ZXJ5Q29tcG9uZW50c1tuYW1lXTtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMud29ybGQuZW50aXR5TWFuYWdlci5xdWVyeUNvbXBvbmVudHMoQ29tcG9uZW50cyk7XG4gICAgICB0aGlzLl9xdWVyaWVzW25hbWVdID0gcXVlcnk7XG4gICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0gPSBxdWVyeS5lbnRpdGllcztcbiAgICB9XG4gIH1cbn1cbiIsImNsYXNzIEZsb2F0VmFsaWRhdG9yIHtcbiAgc3RhdGljIHZhbGlkYXRlKG4pIHtcbiAgICByZXR1cm4gTnVtYmVyKG4pID09PSBuICYmIG4gJSAxICE9PSAwO1xuICB9XG59XG5cbnZhciBTY2hlbWFUeXBlcyA9IHtcbiAgZmxvYXQ6IEZsb2F0VmFsaWRhdG9yXG4gIC8qXG4gIGFycmF5XG4gIGJvb2xcbiAgZnVuY1xuICBudW1iZXJcbiAgb2JqZWN0XG4gIHN0cmluZ1xuICBzeW1ib2xcblxuICBhbnlcbiAgYXJyYXlPZlxuICBlbGVtZW50XG4gIGVsZW1lbnRUeXBlXG4gIGluc3RhbmNlT2ZcbiAgbm9kZVxuICBvYmplY3RPZlxuICBvbmVPZlxuICBvbmVPZlR5cGVcbiAgc2hhcGVcbiAgZXhhY3RcbiovXG59O1xuXG5leHBvcnQgeyBTY2hlbWFUeXBlcyB9O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFlLE1BQU0sZUFBZSxDQUFDO0VBQ25DLFdBQVcsR0FBRztJQUNaLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDO0lBQ3JCLElBQUksQ0FBQyxLQUFLLEdBQUc7TUFDWCxLQUFLLEVBQUUsQ0FBQztNQUNSLE9BQU8sRUFBRSxDQUFDO0tBQ1gsQ0FBQztHQUNIOzs7Ozs7O0VBT0QsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRTtJQUNwQyxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQ2hDLElBQUksU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLFNBQVMsRUFBRTtNQUN0QyxTQUFTLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO0tBQzNCOztJQUVELElBQUksU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtNQUNqRCxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0tBQ3JDO0dBQ0Y7Ozs7Ozs7RUFPRCxnQkFBZ0IsQ0FBQyxTQUFT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
