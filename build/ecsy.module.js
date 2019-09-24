class SystemManager {
  constructor(world) {
    this._systems = [];
    this._executeSystems = []; // Systems that have `execute` method
    this.world = world;
  }

  /**
   * Register a system
   * @param {System} System System to register
   */
  registerSystem(System, attributes) {
    var system = new System(this.world, attributes);
    if (system.init) system.init();
    system.order = this._systems.length;
    this._systems.push(system);
    if (system.execute) this._executeSystems.push(system);
    this.sortSystems();
    return this;
  }

  sortSystems() {
    this._executeSystems.sort((a, b) => {
      return a.priority - b.priority || a.order - b.order;
    });
  }

  /**
   * Return a registered system based on its class
   * @param {System} System
   */
  getSystem(System) {
    return this._systems.find(s => s instanceof System);
  }

  /**
   * Return all the systems registered
   */
  getSystems() {
    return this._systems;
  }

  /**
   * Remove a system
   * @param {System} System System to remove
   */
  removeSystem(System) {
    var index = this._systems.indexOf(System);
    if (!~index) return;

    this._systems.splice(index, 1);
  }

  /**
   * Update all the systems. Called per frame.
   * @param {Number} delta Delta time since the last frame
   * @param {Number} time Elapsed time
   */
  execute(delta, time) {
    this._executeSystems.forEach(system => {
      if (system.enabled && system.initialized) {
        if (system.canExecute()) {
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
      numSystems: this._systems.length,
      systems: {}
    };

    for (var i = 0; i < this._systems.length; i++) {
      var system = this._systems[i];
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
 * @private
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
 * @private
 */
function getName(Component) {
  return Component.name;
}

/**
 * Return a valid property name for the Component
 * @param {Component} Component
 * @private
 */
function componentPropertyName(Component) {
  var name = getName(Component);
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Get a key from a list of components
 * @param {Array(Component)} Components Array of components to generate the key
 * @private
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
    let index = this.entities.indexOf(entity);
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
    return (
      entity.hasAllComponents(this.Components) &&
      !entity.hasAnyComponents(this.NotComponents)
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

var nextId = 0;

class Entity {
  constructor(world) {
    this._world = world || null;

    // Unique ID for this entity
    this.id = nextId++;

    // List of components types the entity has
    this._ComponentTypes = [];

    // Instance of the components
    this._components = {};

    this._componentsToRemove = {};

    // Queries where the entity is added
    this.queries = [];

    // Used for deferred removal
    this._ComponentTypesToRemove = [];

    this.alive = false;
  }

  // COMPONENTS

  getComponent(Component) {
    var component = this._components[Component.name];
    return  component;
  }

  getRemovedComponent(Component) {
    return this._componentsToRemove[Component.name];
  }

  getComponents() {
    return this._components;
  }

  getComponentsToRemove() {
    return this._componentsToRemove;
  }

  getComponentTypes() {
    return this._ComponentTypes;
  }

  getMutableComponent(Component) {
    var component = this._components[Component.name];
    for (var i = 0; i < this.queries.length; i++) {
      var query = this.queries[i];
      // @todo accelerate this check. Maybe having query._Components as an object
      if (query.reactive && query.Components.indexOf(Component) !== -1) {
        query.eventDispatcher.dispatchEvent(
          Query.prototype.COMPONENT_CHANGED,
          this,
          component
        );
      }
    }
    return component;
  }

  addComponent(Component, values) {
    this._world.entityAddComponent(this, Component, values);
    return this;
  }

  removeComponent(Component, forceRemove) {
    this._world.entityRemoveComponent(this, Component, forceRemove);
    return this;
  }

  hasComponent(Component) {
    return !!~this._ComponentTypes.indexOf(Component);
  }

  hasRemovedComponent(Component) {
    return !!~this._ComponentTypesToRemove.indexOf(Component);
  }

  hasAllComponents(Components) {
    for (var i = 0; i < Components.length; i++) {
      if (!this.hasComponent(Components[i])) return false;
    }
    return true;
  }

  hasAnyComponents(Components) {
    for (var i = 0; i < Components.length; i++) {
      if (this.hasComponent(Components[i])) return true;
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
 * @private
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
        query.addEntity(entity);
        continue;
      }

      if (
        !!~query.Components.indexOf(Component) &&
        !!~query.entities.indexOf(entity) &&
        !query.match(entity)
      ) {
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

class SystemStateComponent {}

/**
 * @private
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

    this.numStateComponents = 0;
  }

  /**
   * Create a new entity
   */
  createEntity() {
    var entity = this._entityPool.aquire();
    entity.alive = true;
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

    if (Component.__proto__ === SystemStateComponent) {
      this.numStateComponents++;
    }

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

      var componentName = getName(Component);
      entity._componentsToRemove[componentName] =
        entity._components[componentName];
      delete entity._components[componentName];
    }

    // Check each indexed query to see if we need to remove it
    this._queryManager.onEntityComponentRemoved(entity, Component);

    if (Component.__proto__ === SystemStateComponent) {
      this.numStateComponents--;

      // Check if the entity was a ghost waiting for the last system state component to be removed
      if (this.numStateComponents === 0 && !entity.alive) {
        entity.remove();
      }
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

    if (this.numStateComponents === 0) {
      // Remove from entity list
      this.eventDispatcher.dispatchEvent(ENTITY_REMOVED, entity);
      this._queryManager.onEntityRemoved(entity);
      if (immediately === true) {
        this._releaseEntity(entity, index);
      } else {
        this.entitiesToRemove.push(entity);
      }
    }

    this.entityRemoveAllComponents(entity, immediately);
  }

  _releaseEntity(entity, index) {
    this._entities.splice(index, 1);

    // Prevent any access and free
    entity._world = null;
    this._entityPool.release(entity);
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

        var propName = componentPropertyName(Component);
        var componentName = getName(Component);
        var component = entity._componentsToRemove[componentName];
        delete entity._componentsToRemove[componentName];
        this.componentsManager._componentPool[propName].release(component);
        //this.world.componentsManager.componentRemovedFromEntity(Component);

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

class ComponentManager {
  constructor() {
    this.Components = {};
    this._componentPool = {};
    this.numComponents = {};
  }

  registerComponent(Component) {
    this.Components[Component.name] = Component;
    this.numComponents[Component.name] = 0;
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

class World {
  constructor() {
    this.componentsManager = new ComponentManager(this);
    this.entityManager = new EntityManager(this);
    this.systemManager = new SystemManager(this);

    this.enabled = true;

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

  registerComponent(Component) {
    this.componentsManager.registerComponent(Component);
    return this;
  }

  registerSystem(System, attributes) {
    this.systemManager.registerSystem(System, attributes);
    return this;
  }

  getSystem(SystemClass) {
    return this.systemManager.getSystem(SystemClass);
  }

  getSystems() {
    return this.systemManager.getSystems();
  }

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

  createEntity() {
    return this.entityManager.createEntity();
  }

  stats() {
    var stats = {
      entities: this.entityManager.stats(),
      system: this.systemManager.stats()
    };

    console.log(JSON.stringify(stats, null, 2));
  }
}

class System {
  canExecute() {
    if (this._mandatoryQueries.length === 0) return true;

    for (let i = 0; i < this._mandatoryQueries.length; i++) {
      var query = this._mandatoryQueries[i];
      if (query.entities.length === 0) {
        return false;
      }
    }

    return true;
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

    this._mandatoryQueries = [];

    this.initialized = true;

    if (this.constructor.queries) {
      for (var queryName in this.constructor.queries) {
        var queryConfig = this.constructor.queries[queryName];
        var Components = queryConfig.components;
        if (!Components || Components.length === 0) {
          throw new Error("'components' attribute can't be empty in a query");
        }
        var query = this.world.entityManager.queryComponents(Components);
        this._queries[queryName] = query;
        if (queryConfig.mandatory === true) {
          this._mandatoryQueries.push(query);
        }
        this.queries[queryName] = {
          results: query.entities
        };

        // Reactive configuration added/removed/changed
        var validEvents = ["added", "removed", "changed"];

        const eventMapping = {
          added: Query.prototype.ENTITY_ADDED,
          removed: Query.prototype.ENTITY_REMOVED,
          changed: Query.prototype.COMPONENT_CHANGED // Query.prototype.ENTITY_CHANGED
        };

        if (queryConfig.listen) {
          validEvents.forEach(eventName => {
            // Is the event enabled on this system's query?
            if (queryConfig.listen[eventName]) {
              let event = queryConfig.listen[eventName];

              if (eventName === "changed") {
                query.reactive = true;
                if (event === true) {
                  // Any change on the entity from the components in the query
                  let eventList = (this.queries[queryName][eventName] = []);
                  query.eventDispatcher.addEventListener(
                    Query.prototype.COMPONENT_CHANGED,
                    entity => {
                      // Avoid duplicates
                      if (eventList.indexOf(entity) === -1) {
                        eventList.push(entity);
                      }
                    }
                  );
                } else if (Array.isArray(event)) {
                  let eventList = (this.queries[queryName][eventName] = []);
                  query.eventDispatcher.addEventListener(
                    Query.prototype.COMPONENT_CHANGED,
                    (entity, changedComponent) => {
                      // Avoid duplicates
                      if (
                        event.indexOf(changedComponent.constructor) !== -1 &&
                        eventList.indexOf(entity) === -1
                      ) {
                        eventList.push(entity);
                      }
                    }
                  );
                }
              } else {
                let eventList = (this.queries[queryName][eventName] = []);

                query.eventDispatcher.addEventListener(
                  eventMapping[eventName],
                  entity => {
                    // @fixme overhead?
                    if (eventList.indexOf(entity) === -1)
                      eventList.push(entity);
                  }
                );
              }
            }
          });
        }

        /*
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
        */
      }
    }
    /*
    if (this.config.events) {
      for (let eventName in this.config.events) {
        var event = this.config.events[eventName];
        this.events[eventName] = [];
        this.world.addEventListener(event, data => {
          this.events[eventName].push(data);
        });
      }
    }
    */
  }

  stop() {
    this.enabled = false;
  }

  play() {
    this.enabled = true;
  }

  // @question rename to clear queues?
  clearEvents() {
    for (let queryName in this.queries) {
      var query = this.queries[queryName];
      if (query.added) query.added.length = 0;
      if (query.removed) query.removed.length = 0;
      if (query.changed) {
        if (Array.isArray(query.changed)) {
          query.changed.length = 0;
        } else {
          for (name in query.changed) {
            query.changed[name].length = 0;
          }
        }
      }
      // @todo add changed
    }

    // @question Standard events TBD?
    for (var name in this.events) {
      this.events[name].length = 0;
    }
  }

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
      var queries = this.queries;
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

/**
 * Standard types
 */
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

var standardTypes = {
  number: Types.Number,
  boolean: Types.Boolean,
  string: Types.String
};

/**
 * Try to infer the type of the value
 * @param {*} value
 * @return {String} Type of the attribute
 * @private
 */
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

function createComponentClass(schema, name) {
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
  } else {
    Component.prototype.copy = function(src) {
      for (let key in schema) {
        if (src[key]) {
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

export { Component, Not, System, SystemStateComponent, TagComponent, Types, World, createComponentClass, createType };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9TeXN0ZW1NYW5hZ2VyLmpzIiwiLi4vc3JjL0V2ZW50RGlzcGF0Y2hlci5qcyIsIi4uL3NyYy9VdGlscy5qcyIsIi4uL3NyYy9RdWVyeS5qcyIsIi4uL3NyYy9FbnRpdHkuanMiLCIuLi9zcmMvT2JqZWN0UG9vbC5qcyIsIi4uL3NyYy9RdWVyeU1hbmFnZXIuanMiLCIuLi9zcmMvU3lzdGVtU3RhdGVDb21wb25lbnQuanMiLCIuLi9zcmMvRW50aXR5TWFuYWdlci5qcyIsIi4uL3NyYy9EdW1teU9iamVjdFBvb2wuanMiLCIuLi9zcmMvQ29tcG9uZW50TWFuYWdlci5qcyIsIi4uL3NyYy9Xb3JsZC5qcyIsIi4uL3NyYy9TeXN0ZW0uanMiLCIuLi9zcmMvQ29tcG9uZW50LmpzIiwiLi4vc3JjL1RhZ0NvbXBvbmVudC5qcyIsIi4uL3NyYy9DcmVhdGVUeXBlLmpzIiwiLi4vc3JjL1N0YW5kYXJkVHlwZXMuanMiLCIuLi9zcmMvSW5mZXJUeXBlLmpzIiwiLi4vc3JjL0NyZWF0ZUNvbXBvbmVudENsYXNzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjbGFzcyBTeXN0ZW1NYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLl9zeXN0ZW1zID0gW107XG4gICAgdGhpcy5fZXhlY3V0ZVN5c3RlbXMgPSBbXTsgLy8gU3lzdGVtcyB0aGF0IGhhdmUgYGV4ZWN1dGVgIG1ldGhvZFxuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIHN5c3RlbVxuICAgKiBAcGFyYW0ge1N5c3RlbX0gU3lzdGVtIFN5c3RlbSB0byByZWdpc3RlclxuICAgKi9cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtLCBhdHRyaWJ1dGVzKSB7XG4gICAgdmFyIHN5c3RlbSA9IG5ldyBTeXN0ZW0odGhpcy53b3JsZCwgYXR0cmlidXRlcyk7XG4gICAgaWYgKHN5c3RlbS5pbml0KSBzeXN0ZW0uaW5pdCgpO1xuICAgIHN5c3RlbS5vcmRlciA9IHRoaXMuX3N5c3RlbXMubGVuZ3RoO1xuICAgIHRoaXMuX3N5c3RlbXMucHVzaChzeXN0ZW0pO1xuICAgIGlmIChzeXN0ZW0uZXhlY3V0ZSkgdGhpcy5fZXhlY3V0ZVN5c3RlbXMucHVzaChzeXN0ZW0pO1xuICAgIHRoaXMuc29ydFN5c3RlbXMoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHNvcnRTeXN0ZW1zKCkge1xuICAgIHRoaXMuX2V4ZWN1dGVTeXN0ZW1zLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIHJldHVybiBhLnByaW9yaXR5IC0gYi5wcmlvcml0eSB8fCBhLm9yZGVyIC0gYi5vcmRlcjtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSByZWdpc3RlcmVkIHN5c3RlbSBiYXNlZCBvbiBpdHMgY2xhc3NcbiAgICogQHBhcmFtIHtTeXN0ZW19IFN5c3RlbVxuICAgKi9cbiAgZ2V0U3lzdGVtKFN5c3RlbSkge1xuICAgIHJldHVybiB0aGlzLl9zeXN0ZW1zLmZpbmQocyA9PiBzIGluc3RhbmNlb2YgU3lzdGVtKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYWxsIHRoZSBzeXN0ZW1zIHJlZ2lzdGVyZWRcbiAgICovXG4gIGdldFN5c3RlbXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N5c3RlbXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgc3lzdGVtXG4gICAqIEBwYXJhbSB7U3lzdGVtfSBTeXN0ZW0gU3lzdGVtIHRvIHJlbW92ZVxuICAgKi9cbiAgcmVtb3ZlU3lzdGVtKFN5c3RlbSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuX3N5c3RlbXMuaW5kZXhPZihTeXN0ZW0pO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICB0aGlzLl9zeXN0ZW1zLnNwbGljZShpbmRleCwgMSk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIGFsbCB0aGUgc3lzdGVtcy4gQ2FsbGVkIHBlciBmcmFtZS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbHRhIERlbHRhIHRpbWUgc2luY2UgdGhlIGxhc3QgZnJhbWVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHRpbWUgRWxhcHNlZCB0aW1lXG4gICAqL1xuICBleGVjdXRlKGRlbHRhLCB0aW1lKSB7XG4gICAgdGhpcy5fZXhlY3V0ZVN5c3RlbXMuZm9yRWFjaChzeXN0ZW0gPT4ge1xuICAgICAgaWYgKHN5c3RlbS5lbmFibGVkICYmIHN5c3RlbS5pbml0aWFsaXplZCkge1xuICAgICAgICBpZiAoc3lzdGVtLmNhbkV4ZWN1dGUoKSkge1xuICAgICAgICAgIGxldCBzdGFydFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICBzeXN0ZW0uZXhlY3V0ZShkZWx0YSwgdGltZSk7XG4gICAgICAgICAgc3lzdGVtLmV4ZWN1dGVUaW1lID0gcGVyZm9ybWFuY2Uubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICAgIH1cbiAgICAgICAgc3lzdGVtLmNsZWFyRXZlbnRzKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHN0YXRzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBudW1TeXN0ZW1zOiB0aGlzLl9zeXN0ZW1zLmxlbmd0aCxcbiAgICAgIHN5c3RlbXM6IHt9XG4gICAgfTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fc3lzdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN5c3RlbSA9IHRoaXMuX3N5c3RlbXNbaV07XG4gICAgICB2YXIgc3lzdGVtU3RhdHMgPSAoc3RhdHMuc3lzdGVtc1tzeXN0ZW0uY29uc3RydWN0b3IubmFtZV0gPSB7XG4gICAgICAgIHF1ZXJpZXM6IHt9XG4gICAgICB9KTtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gc3lzdGVtLmN0eCkge1xuICAgICAgICBzeXN0ZW1TdGF0cy5xdWVyaWVzW25hbWVdID0gc3lzdGVtLmN0eFtuYW1lXS5zdGF0cygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuIiwiLyoqXG4gKiBAcHJpdmF0ZVxuICogQGNsYXNzIEV2ZW50RGlzcGF0Y2hlclxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFdmVudERpc3BhdGNoZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLl9saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLnN0YXRzID0ge1xuICAgICAgZmlyZWQ6IDAsXG4gICAgICBoYW5kbGVkOiAwXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBsaXN0ZW5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgdG8gdHJpZ2dlciB3aGVuIHRoZSBldmVudCBpcyBmaXJlZFxuICAgKi9cbiAgYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgbGV0IGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50TmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICB9XG5cbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihsaXN0ZW5lcikgPT09IC0xKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXS5wdXNoKGxpc3RlbmVyKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgYW4gZXZlbnQgbGlzdGVuZXIgaXMgYWxyZWFkeSBhZGRlZCB0byB0aGUgbGlzdCBvZiBsaXN0ZW5lcnNcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBjaGVja1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayBmb3IgdGhlIHNwZWNpZmllZCBldmVudFxuICAgKi9cbiAgaGFzRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdICE9PSB1bmRlZmluZWQgJiZcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdLmluZGV4T2YobGlzdGVuZXIpICE9PSAtMVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFuIGV2ZW50IGxpc3RlbmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50XG4gICAqL1xuICByZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICB2YXIgbGlzdGVuZXJBcnJheSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xuICAgIGlmIChsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBpbmRleCA9IGxpc3RlbmVyQXJyYXkuaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGxpc3RlbmVyQXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGlzcGF0Y2ggYW4gZXZlbnRcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBkaXNwYXRjaFxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IChPcHRpb25hbCkgRW50aXR5IHRvIGVtaXRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IGNvbXBvbmVudFxuICAgKi9cbiAgZGlzcGF0Y2hFdmVudChldmVudE5hbWUsIGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgdGhpcy5zdGF0cy5maXJlZCsrO1xuXG4gICAgdmFyIGxpc3RlbmVyQXJyYXkgPSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXTtcbiAgICBpZiAobGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgYXJyYXkgPSBsaXN0ZW5lckFycmF5LnNsaWNlKDApO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGFycmF5W2ldLmNhbGwodGhpcywgZW50aXR5LCBjb21wb25lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCBzdGF0cyBjb3VudGVyc1xuICAgKi9cbiAgcmVzZXRDb3VudGVycygpIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkID0gdGhpcy5zdGF0cy5oYW5kbGVkID0gMDtcbiAgfVxufVxuIiwiLyoqXG4gKiBSZXR1cm4gdGhlIG5hbWUgb2YgYSBjb21wb25lbnRcbiAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXROYW1lKENvbXBvbmVudCkge1xuICByZXR1cm4gQ29tcG9uZW50Lm5hbWU7XG59XG5cbi8qKlxuICogUmV0dXJuIGEgdmFsaWQgcHJvcGVydHkgbmFtZSBmb3IgdGhlIENvbXBvbmVudFxuICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpIHtcbiAgdmFyIG5hbWUgPSBnZXROYW1lKENvbXBvbmVudCk7XG4gIHJldHVybiBuYW1lLmNoYXJBdCgwKS50b0xvd2VyQ2FzZSgpICsgbmFtZS5zbGljZSgxKTtcbn1cblxuLyoqXG4gKiBHZXQgYSBrZXkgZnJvbSBhIGxpc3Qgb2YgY29tcG9uZW50c1xuICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIEFycmF5IG9mIGNvbXBvbmVudHMgdG8gZ2VuZXJhdGUgdGhlIGtleVxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1ZXJ5S2V5KENvbXBvbmVudHMpIHtcbiAgdmFyIG5hbWVzID0gW107XG4gIGZvciAodmFyIG4gPSAwOyBuIDwgQ29tcG9uZW50cy5sZW5ndGg7IG4rKykge1xuICAgIHZhciBUID0gQ29tcG9uZW50c1tuXTtcbiAgICBpZiAodHlwZW9mIFQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIHZhciBvcGVyYXRvciA9IFQub3BlcmF0b3IgPT09IFwibm90XCIgPyBcIiFcIiA6IFQub3BlcmF0b3I7XG4gICAgICBuYW1lcy5wdXNoKG9wZXJhdG9yICsgZ2V0TmFtZShULkNvbXBvbmVudCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lcy5wdXNoKGdldE5hbWUoVCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lc1xuICAgIC5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHgudG9Mb3dlckNhc2UoKTtcbiAgICB9KVxuICAgIC5zb3J0KClcbiAgICAuam9pbihcIi1cIik7XG59XG4iLCJpbXBvcnQgRXZlbnREaXNwYXRjaGVyIGZyb20gXCIuL0V2ZW50RGlzcGF0Y2hlci5qc1wiO1xuaW1wb3J0IHsgcXVlcnlLZXkgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBRdWVyeSB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgTGlzdCBvZiB0eXBlcyBvZiBjb21wb25lbnRzIHRvIHF1ZXJ5XG4gICAqL1xuICBjb25zdHJ1Y3RvcihDb21wb25lbnRzLCBtYW5hZ2VyKSB7XG4gICAgdGhpcy5Db21wb25lbnRzID0gW107XG4gICAgdGhpcy5Ob3RDb21wb25lbnRzID0gW107XG5cbiAgICBDb21wb25lbnRzLmZvckVhY2goY29tcG9uZW50ID0+IHtcbiAgICAgIGlmICh0eXBlb2YgY29tcG9uZW50ID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHRoaXMuTm90Q29tcG9uZW50cy5wdXNoKGNvbXBvbmVudC5Db21wb25lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5Db21wb25lbnRzLnB1c2goY29tcG9uZW50KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICh0aGlzLkNvbXBvbmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjcmVhdGUgYSBxdWVyeSB3aXRob3V0IGNvbXBvbmVudHNcIik7XG4gICAgfVxuXG4gICAgdGhpcy5lbnRpdGllcyA9IFtdO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG5cbiAgICAvLyBUaGlzIHF1ZXJ5IGlzIGJlaW5nIHVzZWQgYnkgYSByZWFjdGl2ZSBzeXN0ZW1cbiAgICB0aGlzLnJlYWN0aXZlID0gZmFsc2U7XG5cbiAgICB0aGlzLmtleSA9IHF1ZXJ5S2V5KENvbXBvbmVudHMpO1xuXG4gICAgLy8gRmlsbCB0aGUgcXVlcnkgd2l0aCB0aGUgZXhpc3RpbmcgZW50aXRpZXNcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hbmFnZXIuX2VudGl0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZW50aXR5ID0gbWFuYWdlci5fZW50aXRpZXNbaV07XG4gICAgICBpZiAodGhpcy5tYXRjaChlbnRpdHkpKSB7XG4gICAgICAgIC8vIEB0b2RvID8/PyB0aGlzLmFkZEVudGl0eShlbnRpdHkpOyA9PiBwcmV2ZW50aW5nIHRoZSBldmVudCB0byBiZSBnZW5lcmF0ZWRcbiAgICAgICAgZW50aXR5LnF1ZXJpZXMucHVzaCh0aGlzKTtcbiAgICAgICAgdGhpcy5lbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBlbnRpdHkgdG8gdGhpcyBxdWVyeVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5XG4gICAqL1xuICBhZGRFbnRpdHkoZW50aXR5KSB7XG4gICAgZW50aXR5LnF1ZXJpZXMucHVzaCh0aGlzKTtcbiAgICB0aGlzLmVudGl0aWVzLnB1c2goZW50aXR5KTtcblxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCwgZW50aXR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgZW50aXR5IGZyb20gdGhpcyBxdWVyeVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5XG4gICAqL1xuICByZW1vdmVFbnRpdHkoZW50aXR5KSB7XG4gICAgbGV0IGluZGV4ID0gdGhpcy5lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgaWYgKH5pbmRleCkge1xuICAgICAgdGhpcy5lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICBpbmRleCA9IGVudGl0eS5xdWVyaWVzLmluZGV4T2YodGhpcyk7XG4gICAgICBlbnRpdHkucXVlcmllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBRdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQsXG4gICAgICAgIGVudGl0eVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBtYXRjaChlbnRpdHkpIHtcbiAgICByZXR1cm4gKFxuICAgICAgZW50aXR5Lmhhc0FsbENvbXBvbmVudHModGhpcy5Db21wb25lbnRzKSAmJlxuICAgICAgIWVudGl0eS5oYXNBbnlDb21wb25lbnRzKHRoaXMuTm90Q29tcG9uZW50cylcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzdGF0cyBmb3IgdGhpcyBxdWVyeVxuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG51bUNvbXBvbmVudHM6IHRoaXMuQ29tcG9uZW50cy5sZW5ndGgsXG4gICAgICBudW1FbnRpdGllczogdGhpcy5lbnRpdGllcy5sZW5ndGhcbiAgICB9O1xuICB9XG59XG5cblF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQgPSBcIlF1ZXJ5I0VOVElUWV9BRERFRFwiO1xuUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVEID0gXCJRdWVyeSNFTlRJVFlfUkVNT1ZFRFwiO1xuUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VEID0gXCJRdWVyeSNDT01QT05FTlRfQ0hBTkdFRFwiO1xuIiwiaW1wb3J0IFF1ZXJ5IGZyb20gXCIuL1F1ZXJ5LmpzXCI7XG5pbXBvcnQgd3JhcEltbXV0YWJsZUNvbXBvbmVudCBmcm9tIFwiLi9XcmFwSW1tdXRhYmxlQ29tcG9uZW50LmpzXCI7XG5cbi8vIEB0b2RvIFRha2UgdGhpcyBvdXQgZnJvbSB0aGVyZSBvciB1c2UgRU5WXG5jb25zdCBERUJVRyA9IGZhbHNlO1xuXG52YXIgbmV4dElkID0gMDtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRW50aXR5IHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLl93b3JsZCA9IHdvcmxkIHx8IG51bGw7XG5cbiAgICAvLyBVbmlxdWUgSUQgZm9yIHRoaXMgZW50aXR5XG4gICAgdGhpcy5pZCA9IG5leHRJZCsrO1xuXG4gICAgLy8gTGlzdCBvZiBjb21wb25lbnRzIHR5cGVzIHRoZSBlbnRpdHkgaGFzXG4gICAgdGhpcy5fQ29tcG9uZW50VHlwZXMgPSBbXTtcblxuICAgIC8vIEluc3RhbmNlIG9mIHRoZSBjb21wb25lbnRzXG4gICAgdGhpcy5fY29tcG9uZW50cyA9IHt9O1xuXG4gICAgdGhpcy5fY29tcG9uZW50c1RvUmVtb3ZlID0ge307XG5cbiAgICAvLyBRdWVyaWVzIHdoZXJlIHRoZSBlbnRpdHkgaXMgYWRkZWRcbiAgICB0aGlzLnF1ZXJpZXMgPSBbXTtcblxuICAgIC8vIFVzZWQgZm9yIGRlZmVycmVkIHJlbW92YWxcbiAgICB0aGlzLl9Db21wb25lbnRUeXBlc1RvUmVtb3ZlID0gW107XG5cbiAgICB0aGlzLmFsaXZlID0gZmFsc2U7XG4gIH1cblxuICAvLyBDT01QT05FTlRTXG5cbiAgZ2V0Q29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXTtcbiAgICByZXR1cm4gREVCVUcgPyB3cmFwSW1tdXRhYmxlQ29tcG9uZW50KENvbXBvbmVudCwgY29tcG9uZW50KSA6IGNvbXBvbmVudDtcbiAgfVxuXG4gIGdldFJlbW92ZWRDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudHNUb1JlbW92ZVtDb21wb25lbnQubmFtZV07XG4gIH1cblxuICBnZXRDb21wb25lbnRzKCkge1xuICAgIHJldHVybiB0aGlzLl9jb21wb25lbnRzO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50c1RvUmVtb3ZlKCkge1xuICAgIHJldHVybiB0aGlzLl9jb21wb25lbnRzVG9SZW1vdmU7XG4gIH1cblxuICBnZXRDb21wb25lbnRUeXBlcygpIHtcbiAgICByZXR1cm4gdGhpcy5fQ29tcG9uZW50VHlwZXM7XG4gIH1cblxuICBnZXRNdXRhYmxlQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucXVlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW2ldO1xuICAgICAgLy8gQHRvZG8gYWNjZWxlcmF0ZSB0aGlzIGNoZWNrLiBNYXliZSBoYXZpbmcgcXVlcnkuX0NvbXBvbmVudHMgYXMgYW4gb2JqZWN0XG4gICAgICBpZiAocXVlcnkucmVhY3RpdmUgJiYgcXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgIT09IC0xKSB7XG4gICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgIGNvbXBvbmVudFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY29tcG9uZW50O1xuICB9XG5cbiAgYWRkQ29tcG9uZW50KENvbXBvbmVudCwgdmFsdWVzKSB7XG4gICAgdGhpcy5fd29ybGQuZW50aXR5QWRkQ29tcG9uZW50KHRoaXMsIENvbXBvbmVudCwgdmFsdWVzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHJlbW92ZUNvbXBvbmVudChDb21wb25lbnQsIGZvcmNlUmVtb3ZlKSB7XG4gICAgdGhpcy5fd29ybGQuZW50aXR5UmVtb3ZlQ29tcG9uZW50KHRoaXMsIENvbXBvbmVudCwgZm9yY2VSZW1vdmUpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgaGFzQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHJldHVybiAhIX50aGlzLl9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCk7XG4gIH1cblxuICBoYXNSZW1vdmVkQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHJldHVybiAhIX50aGlzLl9Db21wb25lbnRUeXBlc1RvUmVtb3ZlLmluZGV4T2YoQ29tcG9uZW50KTtcbiAgfVxuXG4gIGhhc0FsbENvbXBvbmVudHMoQ29tcG9uZW50cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCF0aGlzLmhhc0NvbXBvbmVudChDb21wb25lbnRzW2ldKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGhhc0FueUNvbXBvbmVudHMoQ29tcG9uZW50cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuaGFzQ29tcG9uZW50KENvbXBvbmVudHNbaV0pKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbGwgdGhlIGNvbXBvbmVudHMgZnJvbSB0aGUgZW50aXR5XG4gICAqL1xuICByZW1vdmVBbGxDb21wb25lbnRzKGZvcmNlUmVtb3ZlKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dvcmxkLmVudGl0eVJlbW92ZUFsbENvbXBvbmVudHModGhpcywgZm9yY2VSZW1vdmUpO1xuICB9XG5cbiAgLy8gRVhUUkFTXG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgdGhlIGVudGl0eS4gVG8gYmUgdXNlZCB3aGVuIHJldHVybmluZyBhbiBlbnRpdHkgdG8gdGhlIHBvb2xcbiAgICovXG4gIHJlc2V0KCkge1xuICAgIHRoaXMuaWQgPSBuZXh0SWQrKztcbiAgICB0aGlzLl93b3JsZCA9IG51bGw7XG4gICAgdGhpcy5fQ29tcG9uZW50VHlwZXMubGVuZ3RoID0gMDtcbiAgICB0aGlzLnF1ZXJpZXMubGVuZ3RoID0gMDtcbiAgICB0aGlzLl9jb21wb25lbnRzID0ge307XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBlbnRpdHkgZnJvbSB0aGUgd29ybGRcbiAgICovXG4gIHJlbW92ZShmb3JjZVJlbW92ZSkge1xuICAgIHJldHVybiB0aGlzLl93b3JsZC5yZW1vdmVFbnRpdHkodGhpcywgZm9yY2VSZW1vdmUpO1xuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBPYmplY3RQb29sIHtcbiAgLy8gQHRvZG8gQWRkIGluaXRpYWwgc2l6ZVxuICBjb25zdHJ1Y3RvcihULCBpbml0aWFsU2l6ZSkge1xuICAgIHRoaXMuZnJlZUxpc3QgPSBbXTtcbiAgICB0aGlzLmNvdW50ID0gMDtcbiAgICB0aGlzLlQgPSBUO1xuXG4gICAgdmFyIGV4dHJhQXJncyA9IG51bGw7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICBleHRyYUFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgZXh0cmFBcmdzLnNoaWZ0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5jcmVhdGVFbGVtZW50ID0gZXh0cmFBcmdzXG4gICAgICA/ICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFQoLi4uZXh0cmFBcmdzKTtcbiAgICAgICAgfVxuICAgICAgOiAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBUKCk7XG4gICAgICAgIH07XG5cbiAgICBpZiAodHlwZW9mIGluaXRpYWxTaXplICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICB0aGlzLmV4cGFuZChpbml0aWFsU2l6ZSk7XG4gICAgfVxuICB9XG5cbiAgYXF1aXJlKCkge1xuICAgIC8vIEdyb3cgdGhlIGxpc3QgYnkgMjAlaXNoIGlmIHdlJ3JlIG91dFxuICAgIGlmICh0aGlzLmZyZWVMaXN0Lmxlbmd0aCA8PSAwKSB7XG4gICAgICB0aGlzLmV4cGFuZChNYXRoLnJvdW5kKHRoaXMuY291bnQgKiAwLjIpICsgMSk7XG4gICAgfVxuXG4gICAgdmFyIGl0ZW0gPSB0aGlzLmZyZWVMaXN0LnBvcCgpO1xuXG4gICAgcmV0dXJuIGl0ZW07XG4gIH1cblxuICByZWxlYXNlKGl0ZW0pIHtcbiAgICBpdGVtLnJlc2V0KCk7XG4gICAgdGhpcy5mcmVlTGlzdC5wdXNoKGl0ZW0pO1xuICB9XG5cbiAgZXhwYW5kKGNvdW50KSB7XG4gICAgZm9yICh2YXIgbiA9IDA7IG4gPCBjb3VudDsgbisrKSB7XG4gICAgICB0aGlzLmZyZWVMaXN0LnB1c2godGhpcy5jcmVhdGVFbGVtZW50KCkpO1xuICAgIH1cbiAgICB0aGlzLmNvdW50ICs9IGNvdW50O1xuICB9XG5cbiAgdG90YWxTaXplKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50O1xuICB9XG5cbiAgdG90YWxGcmVlKCkge1xuICAgIHJldHVybiB0aGlzLmZyZWVMaXN0Lmxlbmd0aDtcbiAgfVxuXG4gIHRvdGFsVXNlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5jb3VudCAtIHRoaXMuZnJlZUxpc3QubGVuZ3RoO1xuICB9XG59XG4iLCJpbXBvcnQgUXVlcnkgZnJvbSBcIi4vUXVlcnkuanNcIjtcbmltcG9ydCB7IHF1ZXJ5S2V5IH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcblxuLyoqXG4gKiBAcHJpdmF0ZVxuICogQGNsYXNzIFF1ZXJ5TWFuYWdlclxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBRdWVyeU1hbmFnZXIge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMuX3dvcmxkID0gd29ybGQ7XG5cbiAgICAvLyBRdWVyaWVzIGluZGV4ZWQgYnkgYSB1bmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIGNvbXBvbmVudHMgaXQgaGFzXG4gICAgdGhpcy5fcXVlcmllcyA9IHt9O1xuICB9XG5cbiAgb25FbnRpdHlSZW1vdmVkKGVudGl0eSkge1xuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV07XG4gICAgICBpZiAoZW50aXR5LnF1ZXJpZXMuaW5kZXhPZihxdWVyeSkgIT09IC0xKSB7XG4gICAgICAgIHF1ZXJ5LnJlbW92ZUVudGl0eShlbnRpdHkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB3aGVuIGEgY29tcG9uZW50IGlzIGFkZGVkIHRvIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0aGF0IGp1c3QgZ290IHRoZSBuZXcgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IGFkZGVkIHRvIHRoZSBlbnRpdHlcbiAgICovXG4gIG9uRW50aXR5Q29tcG9uZW50QWRkZWQoZW50aXR5LCBDb21wb25lbnQpIHtcbiAgICAvLyBAdG9kbyBVc2UgYml0bWFzayBmb3IgY2hlY2tpbmcgY29tcG9uZW50cz9cblxuICAgIC8vIENoZWNrIGVhY2ggaW5kZXhlZCBxdWVyeSB0byBzZWUgaWYgd2UgbmVlZCB0byBhZGQgdGhpcyBlbnRpdHkgdG8gdGhlIGxpc3RcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdO1xuXG4gICAgICBpZiAoXG4gICAgICAgICEhfnF1ZXJ5Lk5vdENvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpICYmXG4gICAgICAgIH5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSlcbiAgICAgICkge1xuICAgICAgICBxdWVyeS5yZW1vdmVFbnRpdHkoZW50aXR5KTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCB0aGUgZW50aXR5IG9ubHkgaWY6XG4gICAgICAvLyBDb21wb25lbnQgaXMgaW4gdGhlIHF1ZXJ5XG4gICAgICAvLyBhbmQgRW50aXR5IGhhcyBBTEwgdGhlIGNvbXBvbmVudHMgb2YgdGhlIHF1ZXJ5XG4gICAgICAvLyBhbmQgRW50aXR5IGlzIG5vdCBhbHJlYWR5IGluIHRoZSBxdWVyeVxuICAgICAgaWYgKFxuICAgICAgICAhfnF1ZXJ5LkNvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpIHx8XG4gICAgICAgICFxdWVyeS5tYXRjaChlbnRpdHkpIHx8XG4gICAgICAgIH5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSlcbiAgICAgIClcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIHF1ZXJ5LmFkZEVudGl0eShlbnRpdHkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB3aGVuIGEgY29tcG9uZW50IGlzIHJlbW92ZWQgZnJvbSBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdG8gcmVtb3ZlIHRoZSBjb21wb25lbnQgZnJvbVxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZW1vdmUgZnJvbSB0aGUgZW50aXR5XG4gICAqL1xuICBvbkVudGl0eUNvbXBvbmVudFJlbW92ZWQoZW50aXR5LCBDb21wb25lbnQpIHtcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdO1xuXG4gICAgICBpZiAoXG4gICAgICAgICEhfnF1ZXJ5Lk5vdENvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpICYmXG4gICAgICAgICF+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpICYmXG4gICAgICAgIHF1ZXJ5Lm1hdGNoKGVudGl0eSlcbiAgICAgICkge1xuICAgICAgICBxdWVyeS5hZGRFbnRpdHkoZW50aXR5KTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChcbiAgICAgICAgISF+cXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgICAgISF+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpICYmXG4gICAgICAgICFxdWVyeS5tYXRjaChlbnRpdHkpXG4gICAgICApIHtcbiAgICAgICAgcXVlcnkucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBxdWVyeSBmb3IgdGhlIHNwZWNpZmllZCBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRzIENvbXBvbmVudHMgdGhhdCB0aGUgcXVlcnkgc2hvdWxkIGhhdmVcbiAgICovXG4gIGdldFF1ZXJ5KENvbXBvbmVudHMpIHtcbiAgICB2YXIga2V5ID0gcXVlcnlLZXkoQ29tcG9uZW50cyk7XG4gICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1trZXldO1xuICAgIGlmICghcXVlcnkpIHtcbiAgICAgIHRoaXMuX3F1ZXJpZXNba2V5XSA9IHF1ZXJ5ID0gbmV3IFF1ZXJ5KENvbXBvbmVudHMsIHRoaXMuX3dvcmxkKTtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzb21lIHN0YXRzIGZyb20gdGhpcyBjbGFzc1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge307XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHN0YXRzW3F1ZXJ5TmFtZV0gPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV0uc3RhdHMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG4iLCJleHBvcnQgY2xhc3MgU3lzdGVtU3RhdGVDb21wb25lbnQge31cbiIsImltcG9ydCBFbnRpdHkgZnJvbSBcIi4vRW50aXR5LmpzXCI7XG5pbXBvcnQgT2JqZWN0UG9vbCBmcm9tIFwiLi9PYmplY3RQb29sLmpzXCI7XG5pbXBvcnQgUXVlcnlNYW5hZ2VyIGZyb20gXCIuL1F1ZXJ5TWFuYWdlci5qc1wiO1xuaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcbmltcG9ydCB7IGNvbXBvbmVudFByb3BlcnR5TmFtZSwgZ2V0TmFtZSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5pbXBvcnQgeyBTeXN0ZW1TdGF0ZUNvbXBvbmVudCB9IGZyb20gXCIuL1N5c3RlbVN0YXRlQ29tcG9uZW50LmpzXCI7XG5cbi8qKlxuICogQHByaXZhdGVcbiAqIEBjbGFzcyBFbnRpdHlNYW5hZ2VyXG4gKi9cbmV4cG9ydCBjbGFzcyBFbnRpdHlNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlciA9IHdvcmxkLmNvbXBvbmVudHNNYW5hZ2VyO1xuXG4gICAgLy8gQWxsIHRoZSBlbnRpdGllcyBpbiB0aGlzIGluc3RhbmNlXG4gICAgdGhpcy5fZW50aXRpZXMgPSBbXTtcblxuICAgIHRoaXMuX3F1ZXJ5TWFuYWdlciA9IG5ldyBRdWVyeU1hbmFnZXIodGhpcyk7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG4gICAgdGhpcy5fZW50aXR5UG9vbCA9IG5ldyBPYmplY3RQb29sKEVudGl0eSk7XG5cbiAgICAvLyBEZWZlcnJlZCBkZWxldGlvblxuICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlID0gW107XG4gICAgdGhpcy5lbnRpdGllc1RvUmVtb3ZlID0gW107XG5cbiAgICB0aGlzLm51bVN0YXRlQ29tcG9uZW50cyA9IDA7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGVudGl0eVxuICAgKi9cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHZhciBlbnRpdHkgPSB0aGlzLl9lbnRpdHlQb29sLmFxdWlyZSgpO1xuICAgIGVudGl0eS5hbGl2ZSA9IHRydWU7XG4gICAgZW50aXR5Ll93b3JsZCA9IHRoaXM7XG4gICAgdGhpcy5fZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoRU5USVRZX0NSRUFURUQsIGVudGl0eSk7XG4gICAgcmV0dXJuIGVudGl0eTtcbiAgfVxuXG4gIC8vIENPTVBPTkVOVFNcblxuICAvKipcbiAgICogQWRkIGEgY29tcG9uZW50IHRvIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB3aGVyZSB0aGUgY29tcG9uZW50IHdpbGwgYmUgYWRkZWRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gYmUgYWRkZWQgdG8gdGhlIGVudGl0eVxuICAgKiBAcGFyYW0ge09iamVjdH0gdmFsdWVzIE9wdGlvbmFsIHZhbHVlcyB0byByZXBsYWNlIHRoZSBkZWZhdWx0IGF0dHJpYnV0ZXNcbiAgICovXG4gIGVudGl0eUFkZENvbXBvbmVudChlbnRpdHksIENvbXBvbmVudCwgdmFsdWVzKSB7XG4gICAgaWYgKH5lbnRpdHkuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KSkgcmV0dXJuO1xuXG4gICAgZW50aXR5Ll9Db21wb25lbnRUeXBlcy5wdXNoKENvbXBvbmVudCk7XG5cbiAgICBpZiAoQ29tcG9uZW50Ll9fcHJvdG9fXyA9PT0gU3lzdGVtU3RhdGVDb21wb25lbnQpIHtcbiAgICAgIHRoaXMubnVtU3RhdGVDb21wb25lbnRzKys7XG4gICAgfVxuXG4gICAgdmFyIGNvbXBvbmVudFBvb2wgPSB0aGlzLndvcmxkLmNvbXBvbmVudHNNYW5hZ2VyLmdldENvbXBvbmVudHNQb29sKFxuICAgICAgQ29tcG9uZW50XG4gICAgKTtcbiAgICB2YXIgY29tcG9uZW50ID0gY29tcG9uZW50UG9vbC5hcXVpcmUoKTtcblxuICAgIGVudGl0eS5fY29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBjb21wb25lbnQ7XG5cbiAgICBpZiAodmFsdWVzKSB7XG4gICAgICBpZiAoY29tcG9uZW50LmNvcHkpIHtcbiAgICAgICAgY29tcG9uZW50LmNvcHkodmFsdWVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4gdmFsdWVzKSB7XG4gICAgICAgICAgY29tcG9uZW50W25hbWVdID0gdmFsdWVzW25hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5Q29tcG9uZW50QWRkZWQoZW50aXR5LCBDb21wb25lbnQpO1xuICAgIHRoaXMud29ybGQuY29tcG9uZW50c01hbmFnZXIuY29tcG9uZW50QWRkZWRUb0VudGl0eShDb21wb25lbnQpO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChDT01QT05FTlRfQURERUQsIGVudGl0eSwgQ29tcG9uZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBjb21wb25lbnQgZnJvbSBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hpY2ggd2lsbCBnZXQgcmVtb3ZlZCB0aGUgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Kn0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZW1vdmUgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7Qm9vbH0gaW1tZWRpYXRlbHkgSWYgeW91IHdhbnQgdG8gcmVtb3ZlIHRoZSBjb21wb25lbnQgaW1tZWRpYXRlbHkgaW5zdGVhZCBvZiBkZWZlcnJlZCAoRGVmYXVsdCBpcyBmYWxzZSlcbiAgICovXG4gIGVudGl0eVJlbW92ZUNvbXBvbmVudChlbnRpdHksIENvbXBvbmVudCwgaW1tZWRpYXRlbHkpIHtcbiAgICB2YXIgaW5kZXggPSBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChDT01QT05FTlRfUkVNT1ZFLCBlbnRpdHksIENvbXBvbmVudCk7XG5cbiAgICBpZiAoaW1tZWRpYXRlbHkpIHtcbiAgICAgIHRoaXMuX2VudGl0eVJlbW92ZUNvbXBvbmVudFN5bmMoZW50aXR5LCBDb21wb25lbnQsIGluZGV4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGVudGl0eS5fQ29tcG9uZW50VHlwZXNUb1JlbW92ZS5sZW5ndGggPT09IDApXG4gICAgICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlLnB1c2goZW50aXR5KTtcblxuICAgICAgZW50aXR5Ll9Db21wb25lbnRUeXBlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgZW50aXR5Ll9Db21wb25lbnRUeXBlc1RvUmVtb3ZlLnB1c2goQ29tcG9uZW50KTtcblxuICAgICAgdmFyIGNvbXBvbmVudE5hbWUgPSBnZXROYW1lKENvbXBvbmVudCk7XG4gICAgICBlbnRpdHkuX2NvbXBvbmVudHNUb1JlbW92ZVtjb21wb25lbnROYW1lXSA9XG4gICAgICAgIGVudGl0eS5fY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcbiAgICAgIGRlbGV0ZSBlbnRpdHkuX2NvbXBvbmVudHNbY29tcG9uZW50TmFtZV07XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgZWFjaCBpbmRleGVkIHF1ZXJ5IHRvIHNlZSBpZiB3ZSBuZWVkIHRvIHJlbW92ZSBpdFxuICAgIHRoaXMuX3F1ZXJ5TWFuYWdlci5vbkVudGl0eUNvbXBvbmVudFJlbW92ZWQoZW50aXR5LCBDb21wb25lbnQpO1xuXG4gICAgaWYgKENvbXBvbmVudC5fX3Byb3RvX18gPT09IFN5c3RlbVN0YXRlQ29tcG9uZW50KSB7XG4gICAgICB0aGlzLm51bVN0YXRlQ29tcG9uZW50cy0tO1xuXG4gICAgICAvLyBDaGVjayBpZiB0aGUgZW50aXR5IHdhcyBhIGdob3N0IHdhaXRpbmcgZm9yIHRoZSBsYXN0IHN5c3RlbSBzdGF0ZSBjb21wb25lbnQgdG8gYmUgcmVtb3ZlZFxuICAgICAgaWYgKHRoaXMubnVtU3RhdGVDb21wb25lbnRzID09PSAwICYmICFlbnRpdHkuYWxpdmUpIHtcbiAgICAgICAgZW50aXR5LnJlbW92ZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9lbnRpdHlSZW1vdmVDb21wb25lbnRTeW5jKGVudGl0eSwgQ29tcG9uZW50LCBpbmRleCkge1xuICAgIC8vIFJlbW92ZSBUIGxpc3Rpbmcgb24gZW50aXR5IGFuZCBwcm9wZXJ0eSByZWYsIHRoZW4gZnJlZSB0aGUgY29tcG9uZW50LlxuICAgIGVudGl0eS5fQ29tcG9uZW50VHlwZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB2YXIgcHJvcE5hbWUgPSBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KTtcbiAgICB2YXIgY29tcG9uZW50TmFtZSA9IGdldE5hbWUoQ29tcG9uZW50KTtcbiAgICB2YXIgY29tcG9uZW50ID0gZW50aXR5Ll9jb21wb25lbnRzW2NvbXBvbmVudE5hbWVdO1xuICAgIGRlbGV0ZSBlbnRpdHkuX2NvbXBvbmVudHNbY29tcG9uZW50TmFtZV07XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5fY29tcG9uZW50UG9vbFtwcm9wTmFtZV0ucmVsZWFzZShjb21wb25lbnQpO1xuICAgIHRoaXMud29ybGQuY29tcG9uZW50c01hbmFnZXIuY29tcG9uZW50UmVtb3ZlZEZyb21FbnRpdHkoQ29tcG9uZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRoZSBjb21wb25lbnRzIGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IGZyb20gd2hpY2ggdGhlIGNvbXBvbmVudHMgd2lsbCBiZSByZW1vdmVkXG4gICAqL1xuICBlbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKGVudGl0eSwgaW1tZWRpYXRlbHkpIHtcbiAgICBsZXQgQ29tcG9uZW50cyA9IGVudGl0eS5fQ29tcG9uZW50VHlwZXM7XG5cbiAgICBmb3IgKGxldCBqID0gQ29tcG9uZW50cy5sZW5ndGggLSAxOyBqID49IDA7IGotLSkge1xuICAgICAgaWYgKENvbXBvbmVudHNbal0uX19wcm90b19fICE9PSBTeXN0ZW1TdGF0ZUNvbXBvbmVudClcbiAgICAgICAgdGhpcy5lbnRpdHlSZW1vdmVDb21wb25lbnQoZW50aXR5LCBDb21wb25lbnRzW2pdLCBpbW1lZGlhdGVseSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0aGUgZW50aXR5IGZyb20gdGhpcyBtYW5hZ2VyLiBJdCB3aWxsIGNsZWFyIGFsc28gaXRzIGNvbXBvbmVudHNcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdG8gcmVtb3ZlIGZyb20gdGhlIG1hbmFnZXJcbiAgICogQHBhcmFtIHtCb29sfSBpbW1lZGlhdGVseSBJZiB5b3Ugd2FudCB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBpbW1lZGlhdGVseSBpbnN0ZWFkIG9mIGRlZmVycmVkIChEZWZhdWx0IGlzIGZhbHNlKVxuICAgKi9cbiAgcmVtb3ZlRW50aXR5KGVudGl0eSwgaW1tZWRpYXRlbHkpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLl9lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG5cbiAgICBpZiAoIX5pbmRleCkgdGhyb3cgbmV3IEVycm9yKFwiVHJpZWQgdG8gcmVtb3ZlIGVudGl0eSBub3QgaW4gbGlzdFwiKTtcblxuICAgIGVudGl0eS5hbGl2ZSA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMubnVtU3RhdGVDb21wb25lbnRzID09PSAwKSB7XG4gICAgICAvLyBSZW1vdmUgZnJvbSBlbnRpdHkgbGlzdFxuICAgICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChFTlRJVFlfUkVNT1ZFRCwgZW50aXR5KTtcbiAgICAgIHRoaXMuX3F1ZXJ5TWFuYWdlci5vbkVudGl0eVJlbW92ZWQoZW50aXR5KTtcbiAgICAgIGlmIChpbW1lZGlhdGVseSA9PT0gdHJ1ZSkge1xuICAgICAgICB0aGlzLl9yZWxlYXNlRW50aXR5KGVudGl0eSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5lbnRpdGllc1RvUmVtb3ZlLnB1c2goZW50aXR5KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmVudGl0eVJlbW92ZUFsbENvbXBvbmVudHMoZW50aXR5LCBpbW1lZGlhdGVseSk7XG4gIH1cblxuICBfcmVsZWFzZUVudGl0eShlbnRpdHksIGluZGV4KSB7XG4gICAgdGhpcy5fZW50aXRpZXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgIC8vIFByZXZlbnQgYW55IGFjY2VzcyBhbmQgZnJlZVxuICAgIGVudGl0eS5fd29ybGQgPSBudWxsO1xuICAgIHRoaXMuX2VudGl0eVBvb2wucmVsZWFzZShlbnRpdHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbGwgZW50aXRpZXMgZnJvbSB0aGlzIG1hbmFnZXJcbiAgICovXG4gIHJlbW92ZUFsbEVudGl0aWVzKCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLl9lbnRpdGllcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdGhpcy5yZW1vdmVFbnRpdHkodGhpcy5fZW50aXRpZXNbaV0pO1xuICAgIH1cbiAgfVxuXG4gIHByb2Nlc3NEZWZlcnJlZFJlbW92YWwoKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmVudGl0aWVzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBlbnRpdHkgPSB0aGlzLmVudGl0aWVzVG9SZW1vdmVbaV07XG4gICAgICBsZXQgaW5kZXggPSB0aGlzLl9lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgICB0aGlzLl9yZWxlYXNlRW50aXR5KGVudGl0eSwgaW5kZXgpO1xuICAgIH1cbiAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUubGVuZ3RoID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBlbnRpdHkgPSB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZVtpXTtcbiAgICAgIHdoaWxlIChlbnRpdHkuX0NvbXBvbmVudFR5cGVzVG9SZW1vdmUubGVuZ3RoID4gMCkge1xuICAgICAgICBsZXQgQ29tcG9uZW50ID0gZW50aXR5Ll9Db21wb25lbnRUeXBlc1RvUmVtb3ZlLnBvcCgpO1xuXG4gICAgICAgIHZhciBwcm9wTmFtZSA9IGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpO1xuICAgICAgICB2YXIgY29tcG9uZW50TmFtZSA9IGdldE5hbWUoQ29tcG9uZW50KTtcbiAgICAgICAgdmFyIGNvbXBvbmVudCA9IGVudGl0eS5fY29tcG9uZW50c1RvUmVtb3ZlW2NvbXBvbmVudE5hbWVdO1xuICAgICAgICBkZWxldGUgZW50aXR5Ll9jb21wb25lbnRzVG9SZW1vdmVbY29tcG9uZW50TmFtZV07XG4gICAgICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2xbcHJvcE5hbWVdLnJlbGVhc2UoY29tcG9uZW50KTtcbiAgICAgICAgLy90aGlzLndvcmxkLmNvbXBvbmVudHNNYW5hZ2VyLmNvbXBvbmVudFJlbW92ZWRGcm9tRW50aXR5KENvbXBvbmVudCk7XG5cbiAgICAgICAgLy90aGlzLl9lbnRpdHlSZW1vdmVDb21wb25lbnRTeW5jKGVudGl0eSwgQ29tcG9uZW50LCBpbmRleCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoID0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBxdWVyeSBiYXNlZCBvbiBhIGxpc3Qgb2YgY29tcG9uZW50c1xuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgTGlzdCBvZiBjb21wb25lbnRzIHRoYXQgd2lsbCBmb3JtIHRoZSBxdWVyeVxuICAgKi9cbiAgcXVlcnlDb21wb25lbnRzKENvbXBvbmVudHMpIHtcbiAgICByZXR1cm4gdGhpcy5fcXVlcnlNYW5hZ2VyLmdldFF1ZXJ5KENvbXBvbmVudHMpO1xuICB9XG5cbiAgLy8gRVhUUkFTXG5cbiAgLyoqXG4gICAqIFJldHVybiBudW1iZXIgb2YgZW50aXRpZXNcbiAgICovXG4gIGNvdW50KCkge1xuICAgIHJldHVybiB0aGlzLl9lbnRpdGllcy5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHNvbWUgc3RhdHNcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIG51bUVudGl0aWVzOiB0aGlzLl9lbnRpdGllcy5sZW5ndGgsXG4gICAgICBudW1RdWVyaWVzOiBPYmplY3Qua2V5cyh0aGlzLl9xdWVyeU1hbmFnZXIuX3F1ZXJpZXMpLmxlbmd0aCxcbiAgICAgIHF1ZXJpZXM6IHRoaXMuX3F1ZXJ5TWFuYWdlci5zdGF0cygpLFxuICAgICAgbnVtQ29tcG9uZW50UG9vbDogT2JqZWN0LmtleXModGhpcy5jb21wb25lbnRzTWFuYWdlci5fY29tcG9uZW50UG9vbClcbiAgICAgICAgLmxlbmd0aCxcbiAgICAgIGNvbXBvbmVudFBvb2w6IHt9LFxuICAgICAgZXZlbnREaXNwYXRjaGVyOiB0aGlzLmV2ZW50RGlzcGF0Y2hlci5zdGF0c1xuICAgIH07XG5cbiAgICBmb3IgKHZhciBjbmFtZSBpbiB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLl9jb21wb25lbnRQb29sKSB7XG4gICAgICB2YXIgcG9vbCA9IHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2xbY25hbWVdO1xuICAgICAgc3RhdHMuY29tcG9uZW50UG9vbFtjbmFtZV0gPSB7XG4gICAgICAgIHVzZWQ6IHBvb2wudG90YWxVc2VkKCksXG4gICAgICAgIHNpemU6IHBvb2wuY291bnRcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG5cbmNvbnN0IEVOVElUWV9DUkVBVEVEID0gXCJFbnRpdHlNYW5hZ2VyI0VOVElUWV9DUkVBVEVcIjtcbmNvbnN0IEVOVElUWV9SRU1PVkVEID0gXCJFbnRpdHlNYW5hZ2VyI0VOVElUWV9SRU1PVkVEXCI7XG5jb25zdCBDT01QT05FTlRfQURERUQgPSBcIkVudGl0eU1hbmFnZXIjQ09NUE9ORU5UX0FEREVEXCI7XG5jb25zdCBDT01QT05FTlRfUkVNT1ZFID0gXCJFbnRpdHlNYW5hZ2VyI0NPTVBPTkVOVF9SRU1PVkVcIjtcbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIER1bW15T2JqZWN0UG9vbCB7XG4gIGNvbnN0cnVjdG9yKFQpIHtcbiAgICB0aGlzLmNvdW50ID0gMDtcbiAgICB0aGlzLnVzZWQgPSAwO1xuICAgIHRoaXMuVCA9IFQ7XG4gIH1cblxuICBhcXVpcmUoKSB7XG4gICAgdGhpcy51c2VkKys7XG4gICAgdGhpcy5jb3VudCsrO1xuICAgIHJldHVybiBuZXcgdGhpcy5UKCk7XG4gIH1cblxuICByZWxlYXNlKCkge1xuICAgIHRoaXMudXNlZC0tO1xuICB9XG5cbiAgdG90YWxTaXplKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50O1xuICB9XG5cbiAgdG90YWxGcmVlKCkge1xuICAgIHJldHVybiBJbmZpbml0eTtcbiAgfVxuXG4gIHRvdGFsVXNlZCgpIHtcbiAgICByZXR1cm4gdGhpcy51c2VkO1xuICB9XG59XG4iLCJpbXBvcnQgT2JqZWN0UG9vbCBmcm9tIFwiLi9PYmplY3RQb29sLmpzXCI7XG5pbXBvcnQgRHVtbXlPYmplY3RQb29sIGZyb20gXCIuL0R1bW15T2JqZWN0UG9vbC5qc1wiO1xuaW1wb3J0IHsgY29tcG9uZW50UHJvcGVydHlOYW1lIH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcblxuZXhwb3J0IGNsYXNzIENvbXBvbmVudE1hbmFnZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLkNvbXBvbmVudHMgPSB7fTtcbiAgICB0aGlzLl9jb21wb25lbnRQb29sID0ge307XG4gICAgdGhpcy5udW1Db21wb25lbnRzID0ge307XG4gIH1cblxuICByZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB0aGlzLkNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gQ29tcG9uZW50O1xuICAgIHRoaXMubnVtQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSAwO1xuICB9XG5cbiAgY29tcG9uZW50QWRkZWRUb0VudGl0eShDb21wb25lbnQpIHtcbiAgICBpZiAoIXRoaXMubnVtQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0pIHtcbiAgICAgIHRoaXMubnVtQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSAxO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm51bUNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdKys7XG4gICAgfVxuICB9XG5cbiAgY29tcG9uZW50UmVtb3ZlZEZyb21FbnRpdHkoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5udW1Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXS0tO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50c1Bvb2woQ29tcG9uZW50KSB7XG4gICAgdmFyIGNvbXBvbmVudE5hbWUgPSBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KTtcblxuICAgIGlmICghdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXSkge1xuICAgICAgaWYgKENvbXBvbmVudC5wcm90b3R5cGUucmVzZXQpIHtcbiAgICAgICAgdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXSA9IG5ldyBPYmplY3RQb29sKENvbXBvbmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgYENvbXBvbmVudCAnJHtDb21wb25lbnQubmFtZX0nIHdvbid0IGJlbmVmaXQgZnJvbSBwb29saW5nIGJlY2F1c2UgJ3Jlc2V0JyBtZXRob2Qgd2FzIG5vdCBpbXBsZW1lbmV0ZWQuYFxuICAgICAgICApO1xuICAgICAgICB0aGlzLl9jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdID0gbmV3IER1bW15T2JqZWN0UG9vbChDb21wb25lbnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdO1xuICB9XG59XG4iLCJpbXBvcnQgeyBTeXN0ZW1NYW5hZ2VyIH0gZnJvbSBcIi4vU3lzdGVtTWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgRW50aXR5TWFuYWdlciB9IGZyb20gXCIuL0VudGl0eU1hbmFnZXIuanNcIjtcbmltcG9ydCB7IENvbXBvbmVudE1hbmFnZXIgfSBmcm9tIFwiLi9Db21wb25lbnRNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgRXZlbnREaXNwYXRjaGVyIGZyb20gXCIuL0V2ZW50RGlzcGF0Y2hlci5qc1wiO1xuXG5leHBvcnQgY2xhc3MgV29ybGQge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyID0gbmV3IENvbXBvbmVudE1hbmFnZXIodGhpcyk7XG4gICAgdGhpcy5lbnRpdHlNYW5hZ2VyID0gbmV3IEVudGl0eU1hbmFnZXIodGhpcyk7XG4gICAgdGhpcy5zeXN0ZW1NYW5hZ2VyID0gbmV3IFN5c3RlbU1hbmFnZXIodGhpcyk7XG5cbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgdGhpcy5ldmVudFF1ZXVlcyA9IHt9O1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyID0gbmV3IEV2ZW50RGlzcGF0Y2hlcigpO1xuXG4gICAgaWYgKHR5cGVvZiBDdXN0b21FdmVudCAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgdmFyIGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KFwiZWNzeS13b3JsZC1jcmVhdGVkXCIsIHsgZGV0YWlsOiB0aGlzIH0pO1xuICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICAgIH1cbiAgfVxuXG4gIGVtaXRFdmVudChldmVudE5hbWUsIGRhdGEpIHtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KGV2ZW50TmFtZSwgZGF0YSk7XG4gIH1cblxuICBhZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgY2FsbGJhY2spO1xuICB9XG5cbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIHJlZ2lzdGVyQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIucmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHJlZ2lzdGVyU3lzdGVtKFN5c3RlbSwgYXR0cmlidXRlcykge1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlci5yZWdpc3RlclN5c3RlbShTeXN0ZW0sIGF0dHJpYnV0ZXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgZ2V0U3lzdGVtKFN5c3RlbUNsYXNzKSB7XG4gICAgcmV0dXJuIHRoaXMuc3lzdGVtTWFuYWdlci5nZXRTeXN0ZW0oU3lzdGVtQ2xhc3MpO1xuICB9XG5cbiAgZ2V0U3lzdGVtcygpIHtcbiAgICByZXR1cm4gdGhpcy5zeXN0ZW1NYW5hZ2VyLmdldFN5c3RlbXMoKTtcbiAgfVxuXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUpIHtcbiAgICBpZiAodGhpcy5lbmFibGVkKSB7XG4gICAgICB0aGlzLnN5c3RlbU1hbmFnZXIuZXhlY3V0ZShkZWx0YSwgdGltZSk7XG4gICAgICB0aGlzLmVudGl0eU1hbmFnZXIucHJvY2Vzc0RlZmVycmVkUmVtb3ZhbCgpO1xuICAgIH1cbiAgfVxuXG4gIHN0b3AoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG4gIH1cblxuICBwbGF5KCkge1xuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG4gIH1cblxuICBjcmVhdGVFbnRpdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50aXR5TWFuYWdlci5jcmVhdGVFbnRpdHkoKTtcbiAgfVxuXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIGVudGl0aWVzOiB0aGlzLmVudGl0eU1hbmFnZXIuc3RhdHMoKSxcbiAgICAgIHN5c3RlbTogdGhpcy5zeXN0ZW1NYW5hZ2VyLnN0YXRzKClcbiAgICB9O1xuXG4gICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoc3RhdHMsIG51bGwsIDIpKTtcbiAgfVxufVxuIiwiaW1wb3J0IFF1ZXJ5IGZyb20gXCIuL1F1ZXJ5LmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBTeXN0ZW0ge1xuICBjYW5FeGVjdXRlKCkge1xuICAgIGlmICh0aGlzLl9tYW5kYXRvcnlRdWVyaWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRydWU7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX21hbmRhdG9yeVF1ZXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMuX21hbmRhdG9yeVF1ZXJpZXNbaV07XG4gICAgICBpZiAocXVlcnkuZW50aXRpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHdvcmxkLCBhdHRyaWJ1dGVzKSB7XG4gICAgdGhpcy53b3JsZCA9IHdvcmxkO1xuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cbiAgICAvLyBAdG9kbyBCZXR0ZXIgbmFtaW5nIDopXG4gICAgdGhpcy5fcXVlcmllcyA9IHt9O1xuICAgIHRoaXMucXVlcmllcyA9IHt9O1xuXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgdGhpcy5ldmVudHMgPSB7fTtcblxuICAgIHRoaXMucHJpb3JpdHkgPSAwO1xuXG4gICAgLy8gVXNlZCBmb3Igc3RhdHNcbiAgICB0aGlzLmV4ZWN1dGVUaW1lID0gMDtcblxuICAgIGlmIChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXMucHJpb3JpdHkpIHtcbiAgICAgIHRoaXMucHJpb3JpdHkgPSBhdHRyaWJ1dGVzLnByaW9yaXR5O1xuICAgIH1cblxuICAgIHRoaXMuX21hbmRhdG9yeVF1ZXJpZXMgPSBbXTtcblxuICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgaWYgKHRoaXMuY29uc3RydWN0b3IucXVlcmllcykge1xuICAgICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuY29uc3RydWN0b3IucXVlcmllcykge1xuICAgICAgICB2YXIgcXVlcnlDb25maWcgPSB0aGlzLmNvbnN0cnVjdG9yLnF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAgdmFyIENvbXBvbmVudHMgPSBxdWVyeUNvbmZpZy5jb21wb25lbnRzO1xuICAgICAgICBpZiAoIUNvbXBvbmVudHMgfHwgQ29tcG9uZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCInY29tcG9uZW50cycgYXR0cmlidXRlIGNhbid0IGJlIGVtcHR5IGluIGEgcXVlcnlcIik7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy53b3JsZC5lbnRpdHlNYW5hZ2VyLnF1ZXJ5Q29tcG9uZW50cyhDb21wb25lbnRzKTtcbiAgICAgICAgdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdID0gcXVlcnk7XG4gICAgICAgIGlmIChxdWVyeUNvbmZpZy5tYW5kYXRvcnkgPT09IHRydWUpIHtcbiAgICAgICAgICB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzLnB1c2gocXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucXVlcmllc1txdWVyeU5hbWVdID0ge1xuICAgICAgICAgIHJlc3VsdHM6IHF1ZXJ5LmVudGl0aWVzXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmVhY3RpdmUgY29uZmlndXJhdGlvbiBhZGRlZC9yZW1vdmVkL2NoYW5nZWRcbiAgICAgICAgdmFyIHZhbGlkRXZlbnRzID0gW1wiYWRkZWRcIiwgXCJyZW1vdmVkXCIsIFwiY2hhbmdlZFwiXTtcblxuICAgICAgICBjb25zdCBldmVudE1hcHBpbmcgPSB7XG4gICAgICAgICAgYWRkZWQ6IFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQsXG4gICAgICAgICAgcmVtb3ZlZDogUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICAgIGNoYW5nZWQ6IFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCAvLyBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0NIQU5HRURcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAocXVlcnlDb25maWcubGlzdGVuKSB7XG4gICAgICAgICAgdmFsaWRFdmVudHMuZm9yRWFjaChldmVudE5hbWUgPT4ge1xuICAgICAgICAgICAgLy8gSXMgdGhlIGV2ZW50IGVuYWJsZWQgb24gdGhpcyBzeXN0ZW0ncyBxdWVyeT9cbiAgICAgICAgICAgIGlmIChxdWVyeUNvbmZpZy5saXN0ZW5bZXZlbnROYW1lXSkge1xuICAgICAgICAgICAgICBsZXQgZXZlbnQgPSBxdWVyeUNvbmZpZy5saXN0ZW5bZXZlbnROYW1lXTtcblxuICAgICAgICAgICAgICBpZiAoZXZlbnROYW1lID09PSBcImNoYW5nZWRcIikge1xuICAgICAgICAgICAgICAgIHF1ZXJ5LnJlYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgIC8vIEFueSBjaGFuZ2Ugb24gdGhlIGVudGl0eSBmcm9tIHRoZSBjb21wb25lbnRzIGluIHRoZSBxdWVyeVxuICAgICAgICAgICAgICAgICAgbGV0IGV2ZW50TGlzdCA9ICh0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXVtldmVudE5hbWVdID0gW10pO1xuICAgICAgICAgICAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyBBdm9pZCBkdXBsaWNhdGVzXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50TGlzdC5pbmRleE9mKGVudGl0eSkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZXZlbnQpKSB7XG4gICAgICAgICAgICAgICAgICBsZXQgZXZlbnRMaXN0ID0gKHRoaXMucXVlcmllc1txdWVyeU5hbWVdW2V2ZW50TmFtZV0gPSBbXSk7XG4gICAgICAgICAgICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICAgICAgICAgICAgICAoZW50aXR5LCBjaGFuZ2VkQ29tcG9uZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8gQXZvaWQgZHVwbGljYXRlc1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LmluZGV4T2YoY2hhbmdlZENvbXBvbmVudC5jb25zdHJ1Y3RvcikgIT09IC0xICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QuaW5kZXhPZihlbnRpdHkpID09PSAtMVxuICAgICAgICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRMaXN0LnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgICAvLyBDaGVja2luZyBqdXN0IHNwZWNpZmljIGNvbXBvbmVudHNcbiAgICAgICAgICAgICAgICAgIGxldCBjaGFuZ2VkTGlzdCA9ICh0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXVtldmVudE5hbWVdID0ge30pO1xuICAgICAgICAgICAgICAgICAgZXZlbnQuZm9yRWFjaChjb21wb25lbnQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgZXZlbnRMaXN0ID0gKGNoYW5nZWRMaXN0W1xuICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFByb3BlcnR5TmFtZShjb21wb25lbnQpXG4gICAgICAgICAgICAgICAgICAgIF0gPSBbXSk7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAgICAgICAoZW50aXR5LCBjaGFuZ2VkQ29tcG9uZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZWRDb21wb25lbnQuY29uc3RydWN0b3IgPT09IGNvbXBvbmVudCAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QuaW5kZXhPZihlbnRpdHkpID09PSAtMVxuICAgICAgICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50TGlzdC5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgZXZlbnRMaXN0ID0gKHRoaXMucXVlcmllc1txdWVyeU5hbWVdW2V2ZW50TmFtZV0gPSBbXSk7XG5cbiAgICAgICAgICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgIGV2ZW50TWFwcGluZ1tldmVudE5hbWVdLFxuICAgICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQGZpeG1lIG92ZXJoZWFkP1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnRMaXN0LmluZGV4T2YoZW50aXR5KSA9PT0gLTEpXG4gICAgICAgICAgICAgICAgICAgICAgZXZlbnRMaXN0LnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKlxuICAgICAgICBpZiAocXVlcnlDb25maWcuZXZlbnRzKSB7XG4gICAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0gPSB7fTtcbiAgICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV07XG4gICAgICAgICAgZm9yIChsZXQgZXZlbnROYW1lIGluIHF1ZXJ5Q29uZmlnLmV2ZW50cykge1xuICAgICAgICAgICAgbGV0IGV2ZW50ID0gcXVlcnlDb25maWcuZXZlbnRzW2V2ZW50TmFtZV07XG4gICAgICAgICAgICBldmVudHNbZXZlbnROYW1lXSA9IFtdO1xuXG4gICAgICAgICAgICBjb25zdCBldmVudE1hcHBpbmcgPSB7XG4gICAgICAgICAgICAgIEVudGl0eUFkZGVkOiBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVELFxuICAgICAgICAgICAgICBFbnRpdHlSZW1vdmVkOiBRdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQsXG4gICAgICAgICAgICAgIEVudGl0eUNoYW5nZWQ6IFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCAvLyBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0NIQU5HRURcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChldmVudE1hcHBpbmdbZXZlbnQuZXZlbnRdKSB7XG4gICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgIGV2ZW50TWFwcGluZ1tldmVudC5ldmVudF0sXG4gICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgIC8vIEBmaXhtZSBBIGxvdCBvZiBvdmVyaGVhZD9cbiAgICAgICAgICAgICAgICAgIGlmIChldmVudHNbZXZlbnROYW1lXS5pbmRleE9mKGVudGl0eSkgPT09IC0xKVxuICAgICAgICAgICAgICAgICAgICBldmVudHNbZXZlbnROYW1lXS5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBpZiAoZXZlbnQuZXZlbnQgPT09IFwiRW50aXR5Q2hhbmdlZFwiKSB7XG4gICAgICAgICAgICAgICAgcXVlcnkucmVhY3RpdmUgPSB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmV2ZW50ID09PSBcIkNvbXBvbmVudENoYW5nZWRcIikge1xuICAgICAgICAgICAgICBxdWVyeS5yZWFjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAoZW50aXR5LCBjb21wb25lbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChldmVudC5jb21wb25lbnRzLmluZGV4T2YoY29tcG9uZW50LmNvbnN0cnVjdG9yKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0ucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgKi9cbiAgICAgIH1cbiAgICB9XG4gICAgLypcbiAgICBpZiAodGhpcy5jb25maWcuZXZlbnRzKSB7XG4gICAgICBmb3IgKGxldCBldmVudE5hbWUgaW4gdGhpcy5jb25maWcuZXZlbnRzKSB7XG4gICAgICAgIHZhciBldmVudCA9IHRoaXMuY29uZmlnLmV2ZW50c1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLmV2ZW50c1tldmVudE5hbWVdID0gW107XG4gICAgICAgIHRoaXMud29ybGQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgZGF0YSA9PiB7XG4gICAgICAgICAgdGhpcy5ldmVudHNbZXZlbnROYW1lXS5wdXNoKGRhdGEpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgKi9cbiAgfVxuXG4gIHN0b3AoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG4gIH1cblxuICBwbGF5KCkge1xuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG4gIH1cblxuICAvLyBAcXVlc3Rpb24gcmVuYW1lIHRvIGNsZWFyIHF1ZXVlcz9cbiAgY2xlYXJFdmVudHMoKSB7XG4gICAgZm9yIChsZXQgcXVlcnlOYW1lIGluIHRoaXMucXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3F1ZXJ5TmFtZV07XG4gICAgICBpZiAocXVlcnkuYWRkZWQpIHF1ZXJ5LmFkZGVkLmxlbmd0aCA9IDA7XG4gICAgICBpZiAocXVlcnkucmVtb3ZlZCkgcXVlcnkucmVtb3ZlZC5sZW5ndGggPSAwO1xuICAgICAgaWYgKHF1ZXJ5LmNoYW5nZWQpIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocXVlcnkuY2hhbmdlZCkpIHtcbiAgICAgICAgICBxdWVyeS5jaGFuZ2VkLmxlbmd0aCA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZm9yIChuYW1lIGluIHF1ZXJ5LmNoYW5nZWQpIHtcbiAgICAgICAgICAgIHF1ZXJ5LmNoYW5nZWRbbmFtZV0ubGVuZ3RoID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIEB0b2RvIGFkZCBjaGFuZ2VkXG4gICAgfVxuXG4gICAgLy8gQHF1ZXN0aW9uIFN0YW5kYXJkIGV2ZW50cyBUQkQ/XG4gICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLmV2ZW50cykge1xuICAgICAgdGhpcy5ldmVudHNbbmFtZV0ubGVuZ3RoID0gMDtcbiAgICB9XG4gIH1cblxuICB0b0pTT04oKSB7XG4gICAgdmFyIGpzb24gPSB7XG4gICAgICBuYW1lOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICBlbmFibGVkOiB0aGlzLmVuYWJsZWQsXG4gICAgICBleGVjdXRlVGltZTogdGhpcy5leGVjdXRlVGltZSxcbiAgICAgIHByaW9yaXR5OiB0aGlzLnByaW9yaXR5LFxuICAgICAgcXVlcmllczoge30sXG4gICAgICBldmVudHM6IHt9XG4gICAgfTtcblxuICAgIGlmICh0aGlzLmNvbmZpZykge1xuICAgICAgdmFyIHF1ZXJpZXMgPSB0aGlzLnF1ZXJpZXM7XG4gICAgICBmb3IgKGxldCBxdWVyeU5hbWUgaW4gcXVlcmllcykge1xuICAgICAgICBsZXQgcXVlcnkgPSBxdWVyaWVzW3F1ZXJ5TmFtZV07XG4gICAgICAgIGpzb24ucXVlcmllc1txdWVyeU5hbWVdID0ge1xuICAgICAgICAgIGtleTogdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdLmtleVxuICAgICAgICB9O1xuICAgICAgICBpZiAocXVlcnkuZXZlbnRzKSB7XG4gICAgICAgICAgbGV0IGV2ZW50cyA9IChqc29uLnF1ZXJpZXNbcXVlcnlOYW1lXVtcImV2ZW50c1wiXSA9IHt9KTtcbiAgICAgICAgICBmb3IgKGxldCBldmVudE5hbWUgaW4gcXVlcnkuZXZlbnRzKSB7XG4gICAgICAgICAgICBsZXQgZXZlbnQgPSBxdWVyeS5ldmVudHNbZXZlbnROYW1lXTtcbiAgICAgICAgICAgIGV2ZW50c1tldmVudE5hbWVdID0ge1xuICAgICAgICAgICAgICBldmVudE5hbWU6IGV2ZW50LmV2ZW50LFxuICAgICAgICAgICAgICBudW1FbnRpdGllczogdGhpcy5ldmVudHNbcXVlcnlOYW1lXVtldmVudE5hbWVdLmxlbmd0aFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChldmVudC5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgIGV2ZW50c1tldmVudE5hbWVdLmNvbXBvbmVudHMgPSBldmVudC5jb21wb25lbnRzLm1hcChjID0+IGMubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxldCBldmVudHMgPSB0aGlzLmNvbmZpZy5ldmVudHM7XG4gICAgICBmb3IgKGxldCBldmVudE5hbWUgaW4gZXZlbnRzKSB7XG4gICAgICAgIGpzb24uZXZlbnRzW2V2ZW50TmFtZV0gPSB7XG4gICAgICAgICAgZXZlbnROYW1lOiBldmVudHNbZXZlbnROYW1lXVxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBqc29uO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBOb3QoQ29tcG9uZW50KSB7XG4gIHJldHVybiB7XG4gICAgb3BlcmF0b3I6IFwibm90XCIsXG4gICAgQ29tcG9uZW50OiBDb21wb25lbnRcbiAgfTtcbn1cbiIsImV4cG9ydCBjbGFzcyBDb21wb25lbnQge31cbiIsImV4cG9ydCBjbGFzcyBUYWdDb21wb25lbnQge1xuICByZXNldCgpIHt9XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gY3JlYXRlVHlwZSh0eXBlRGVmaW5pdGlvbikge1xuICB2YXIgbWFuZGF0b3J5RnVuY3Rpb25zID0gW1xuICAgIFwiY3JlYXRlXCIsXG4gICAgXCJyZXNldFwiLFxuICAgIFwiY2xlYXJcIlxuICAgIC8qXCJjb3B5XCIqL1xuICBdO1xuXG4gIHZhciB1bmRlZmluZWRGdW5jdGlvbnMgPSBtYW5kYXRvcnlGdW5jdGlvbnMuZmlsdGVyKGYgPT4ge1xuICAgIHJldHVybiAhdHlwZURlZmluaXRpb25bZl07XG4gIH0pO1xuXG4gIGlmICh1bmRlZmluZWRGdW5jdGlvbnMubGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBjcmVhdGVUeXBlIGV4cGVjdCB0eXBlIGRlZmluaXRpb24gdG8gaW1wbGVtZW50cyB0aGUgZm9sbG93aW5nIGZ1bmN0aW9uczogJHt1bmRlZmluZWRGdW5jdGlvbnMuam9pbihcbiAgICAgICAgXCIsIFwiXG4gICAgICApfWBcbiAgICApO1xuICB9XG5cbiAgdHlwZURlZmluaXRpb24uaXNUeXBlID0gdHJ1ZTtcbiAgcmV0dXJuIHR5cGVEZWZpbml0aW9uO1xufVxuIiwiaW1wb3J0IHsgY3JlYXRlVHlwZSB9IGZyb20gXCIuL0NyZWF0ZVR5cGVcIjtcblxuLyoqXG4gKiBTdGFuZGFyZCB0eXBlc1xuICovXG52YXIgVHlwZXMgPSB7fTtcblxuVHlwZXMuTnVtYmVyID0gY3JlYXRlVHlwZSh7XG4gIGJhc2VUeXBlOiBOdW1iZXIsXG4gIGlzU2ltcGxlVHlwZTogdHJ1ZSxcbiAgY3JlYXRlOiBkZWZhdWx0VmFsdWUgPT4ge1xuICAgIHJldHVybiB0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiID8gZGVmYXVsdFZhbHVlIDogMDtcbiAgfSxcbiAgcmVzZXQ6IChzcmMsIGtleSwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkZWZhdWx0VmFsdWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHNyY1trZXldID0gZGVmYXVsdFZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBzcmNba2V5XSA9IDA7XG4gICAgfVxuICB9LFxuICBjbGVhcjogKHNyYywga2V5KSA9PiB7XG4gICAgc3JjW2tleV0gPSAwO1xuICB9XG59KTtcblxuVHlwZXMuQm9vbGVhbiA9IGNyZWF0ZVR5cGUoe1xuICBiYXNlVHlwZTogQm9vbGVhbixcbiAgaXNTaW1wbGVUeXBlOiB0cnVlLFxuICBjcmVhdGU6IGRlZmF1bHRWYWx1ZSA9PiB7XG4gICAgcmV0dXJuIHR5cGVvZiBkZWZhdWx0VmFsdWUgIT09IFwidW5kZWZpbmVkXCIgPyBkZWZhdWx0VmFsdWUgOiBmYWxzZTtcbiAgfSxcbiAgcmVzZXQ6IChzcmMsIGtleSwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkZWZhdWx0VmFsdWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHNyY1trZXldID0gZGVmYXVsdFZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBzcmNba2V5XSA9IGZhbHNlO1xuICAgIH1cbiAgfSxcbiAgY2xlYXI6IChzcmMsIGtleSkgPT4ge1xuICAgIHNyY1trZXldID0gZmFsc2U7XG4gIH1cbn0pO1xuXG5UeXBlcy5TdHJpbmcgPSBjcmVhdGVUeXBlKHtcbiAgYmFzZVR5cGU6IFN0cmluZyxcbiAgaXNTaW1wbGVUeXBlOiB0cnVlLFxuICBjcmVhdGU6IGRlZmF1bHRWYWx1ZSA9PiB7XG4gICAgcmV0dXJuIHR5cGVvZiBkZWZhdWx0VmFsdWUgIT09IFwidW5kZWZpbmVkXCIgPyBkZWZhdWx0VmFsdWUgOiBcIlwiO1xuICB9LFxuICByZXNldDogKHNyYywga2V5LCBkZWZhdWx0VmFsdWUpID0+IHtcbiAgICBpZiAodHlwZW9mIGRlZmF1bHRWYWx1ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgc3JjW2tleV0gPSBkZWZhdWx0VmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNyY1trZXldID0gXCJcIjtcbiAgICB9XG4gIH0sXG4gIGNsZWFyOiAoc3JjLCBrZXkpID0+IHtcbiAgICBzcmNba2V5XSA9IFwiXCI7XG4gIH1cbn0pO1xuXG5UeXBlcy5BcnJheSA9IGNyZWF0ZVR5cGUoe1xuICBiYXNlVHlwZTogQXJyYXksXG4gIGNyZWF0ZTogZGVmYXVsdFZhbHVlID0+IHtcbiAgICBpZiAodHlwZW9mIGRlZmF1bHRWYWx1ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgcmV0dXJuIGRlZmF1bHRWYWx1ZS5zbGljZSgpO1xuICAgIH1cblxuICAgIHJldHVybiBbXTtcbiAgfSxcbiAgcmVzZXQ6IChzcmMsIGtleSwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkZWZhdWx0VmFsdWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHNyY1trZXldID0gZGVmYXVsdFZhbHVlLnNsaWNlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNyY1trZXldLmxlbmd0aCA9IDA7XG4gICAgfVxuICB9LFxuICBjbGVhcjogKHNyYywga2V5KSA9PiB7XG4gICAgc3JjW2tleV0ubGVuZ3RoID0gMDtcbiAgfSxcbiAgY29weTogKHNyYywgZHN0LCBrZXkpID0+IHtcbiAgICBzcmNba2V5XSA9IGRzdFtrZXldLnNsaWNlKCk7XG4gIH1cbn0pO1xuXG5leHBvcnQgeyBUeXBlcyB9O1xuIiwiaW1wb3J0IHsgVHlwZXMgfSBmcm9tIFwiLi9TdGFuZGFyZFR5cGVzXCI7XG5cbnZhciBzdGFuZGFyZFR5cGVzID0ge1xuICBudW1iZXI6IFR5cGVzLk51bWJlcixcbiAgYm9vbGVhbjogVHlwZXMuQm9vbGVhbixcbiAgc3RyaW5nOiBUeXBlcy5TdHJpbmdcbn07XG5cbi8qKlxuICogVHJ5IHRvIGluZmVyIHRoZSB0eXBlIG9mIHRoZSB2YWx1ZVxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICogQHJldHVybiB7U3RyaW5nfSBUeXBlIG9mIHRoZSBhdHRyaWJ1dGVcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmZlclR5cGUodmFsdWUpIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIFR5cGVzLkFycmF5O1xuICB9XG5cbiAgaWYgKHN0YW5kYXJkVHlwZXNbdHlwZW9mIHZhbHVlXSkge1xuICAgIHJldHVybiBzdGFuZGFyZFR5cGVzW3R5cGVvZiB2YWx1ZV07XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiIsImltcG9ydCB7IGluZmVyVHlwZSB9IGZyb20gXCIuL0luZmVyVHlwZVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50Q2xhc3Moc2NoZW1hLCBuYW1lKSB7XG4gIC8vdmFyIENvbXBvbmVudCA9IG5ldyBGdW5jdGlvbihgcmV0dXJuIGZ1bmN0aW9uICR7bmFtZX0oKSB7fWApKCk7XG4gIGZvciAobGV0IGtleSBpbiBzY2hlbWEpIHtcbiAgICBsZXQgdHlwZSA9IHNjaGVtYVtrZXldLnR5cGU7XG4gICAgaWYgKCF0eXBlKSB7XG4gICAgICBzY2hlbWFba2V5XS50eXBlID0gaW5mZXJUeXBlKHNjaGVtYVtrZXldLmRlZmF1bHQpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBDb21wb25lbnQgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKGxldCBrZXkgaW4gc2NoZW1hKSB7XG4gICAgICB2YXIgYXR0ciA9IHNjaGVtYVtrZXldO1xuICAgICAgbGV0IHR5cGUgPSBhdHRyLnR5cGU7XG4gICAgICBpZiAodHlwZSAmJiB0eXBlLmlzVHlwZSkge1xuICAgICAgICB0aGlzW2tleV0gPSB0eXBlLmNyZWF0ZShhdHRyLmRlZmF1bHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpc1trZXldID0gYXR0ci5kZWZhdWx0O1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBpZiAodHlwZW9mIG5hbWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQ29tcG9uZW50LCBcIm5hbWVcIiwgeyB2YWx1ZTogbmFtZSB9KTtcbiAgfVxuXG4gIENvbXBvbmVudC5wcm90b3R5cGUuc2NoZW1hID0gc2NoZW1hO1xuXG4gIHZhciBrbm93blR5cGVzID0gdHJ1ZTtcbiAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgIHZhciBhdHRyID0gc2NoZW1hW2tleV07XG4gICAgaWYgKCFhdHRyLnR5cGUpIHtcbiAgICAgIGF0dHIudHlwZSA9IGluZmVyVHlwZShhdHRyLmRlZmF1bHQpO1xuICAgIH1cblxuICAgIHZhciB0eXBlID0gYXR0ci50eXBlO1xuICAgIGlmICghdHlwZSkge1xuICAgICAgY29uc29sZS53YXJuKGBVbmtub3duIHR5cGUgZGVmaW5pdGlvbiBmb3IgYXR0cmlidXRlICcke2tleX0nYCk7XG4gICAgICBrbm93blR5cGVzID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFrbm93blR5cGVzKSB7XG4gICAgY29uc29sZS53YXJuKFxuICAgICAgYFRoaXMgY29tcG9uZW50IGNhbid0IHVzZSBwb29saW5nIGJlY2F1c2Ugc29tZSBkYXRhIHR5cGVzIGFyZSBub3QgcmVnaXN0ZXJlZC4gUGxlYXNlIHByb3ZpZGUgYSB0eXBlIGNyZWF0ZWQgd2l0aCAnY3JlYXRlVHlwZSdgXG4gICAgKTtcblxuICAgIGZvciAodmFyIGtleSBpbiBzY2hlbWEpIHtcbiAgICAgIGxldCBhdHRyID0gc2NoZW1hW2tleV07XG4gICAgICBDb21wb25lbnQucHJvdG90eXBlW2tleV0gPSBhdHRyLmRlZmF1bHQ7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIENvbXBvbmVudC5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uKHNyYykge1xuICAgICAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgICAgICBpZiAoc3JjW2tleV0pIHtcbiAgICAgICAgICBsZXQgdHlwZSA9IHNjaGVtYVtrZXldLnR5cGU7XG4gICAgICAgICAgaWYgKHR5cGUuaXNTaW1wbGVUeXBlKSB7XG4gICAgICAgICAgICB0aGlzW2tleV0gPSBzcmNba2V5XTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHR5cGUuY29weSkge1xuICAgICAgICAgICAgdHlwZS5jb3B5KHRoaXMsIHNyYywga2V5KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQHRvZG8gRGV0ZWN0IHRoYXQgaXQncyBub3QgcG9zc2libGUgdG8gY29weSBhbGwgdGhlIGF0dHJpYnV0ZXNcbiAgICAgICAgICAgIC8vIGFuZCBqdXN0IGF2b2lkIGNyZWF0aW5nIHRoZSBjb3B5IGZ1bmN0aW9uXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgIGBVbmtub3duIGNvcHkgZnVuY3Rpb24gZm9yIGF0dHJpYnV0ZSAnJHtrZXl9JyBkYXRhIHR5cGVgXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICBDb21wb25lbnQucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKGxldCBrZXkgaW4gc2NoZW1hKSB7XG4gICAgICAgIGxldCBhdHRyID0gc2NoZW1hW2tleV07XG4gICAgICAgIGxldCB0eXBlID0gYXR0ci50eXBlO1xuICAgICAgICBpZiAodHlwZS5yZXNldCkgdHlwZS5yZXNldCh0aGlzLCBrZXksIGF0dHIuZGVmYXVsdCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIENvbXBvbmVudC5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIGZvciAobGV0IGtleSBpbiBzY2hlbWEpIHtcbiAgICAgICAgbGV0IHR5cGUgPSBzY2hlbWFba2V5XS50eXBlO1xuICAgICAgICBpZiAodHlwZS5jbGVhcikgdHlwZS5jbGVhcih0aGlzLCBrZXkpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBrZXkgaW4gc2NoZW1hKSB7XG4gICAgICBsZXQgYXR0ciA9IHNjaGVtYVtrZXldO1xuICAgICAgbGV0IHR5cGUgPSBhdHRyLnR5cGU7XG4gICAgICBDb21wb25lbnQucHJvdG90eXBlW2tleV0gPSBhdHRyLmRlZmF1bHQ7XG5cbiAgICAgIGlmICh0eXBlLnJlc2V0KSB7XG4gICAgICAgIHR5cGUucmVzZXQoQ29tcG9uZW50LnByb3RvdHlwZSwga2V5LCBhdHRyLmRlZmF1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBDb21wb25lbnQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQU8sTUFBTSxhQUFhLENBQUM7RUFDekIsV0FBVyxDQUFD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
