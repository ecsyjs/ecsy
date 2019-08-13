(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = global || self, (function () {
		var current = global.ECSY;
		var exports = global.ECSY = {};
		factory(exports);
		exports.noConflict = function () { global.ECSY = current; return exports; };
	}()));
}(this, function (exports) { 'use strict';

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
	        if (system.execute && system.canExecute()) {
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
	        if (queryConfig.mandatory === true) {
	          this._mandatoryQueries.push(query);
	        }
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

	exports.Component = Component;
	exports.Not = Not;
	exports.System = System;
	exports.TagComponent = TagComponent;
	exports.Types = Types;
	exports.World = World;
	exports.createComponent = createComponent;
	exports.createType = createType;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL1N5c3RlbU1hbmFnZXIuanMiLCIuLi9zcmMvRXZlbnREaXNwYXRjaGVyLmpzIiwiLi4vc3JjL1V0aWxzLmpzIiwiLi4vc3JjL1F1ZXJ5LmpzIiwiLi4vc3JjL0VudGl0eS5qcyIsIi4uL3NyYy9PYmplY3RQb29sLmpzIiwiLi4vc3JjL1F1ZXJ5TWFuYWdlci5qcyIsIi4uL3NyYy9FbnRpdHlNYW5hZ2VyLmpzIiwiLi4vc3JjL0R1bW15T2JqZWN0UG9vbC5qcyIsIi4uL3NyYy9Db21wb25lbnRNYW5hZ2VyLmpzIiwiLi4vc3JjL1dvcmxkLmpzIiwiLi4vc3JjL1N5c3RlbS5qcyIsIi4uL3NyYy9Db21wb25lbnQuanMiLCIuLi9zcmMvVGFnQ29tcG9uZW50LmpzIiwiLi4vc3JjL0NyZWF0ZVR5cGUuanMiLCIuLi9zcmMvU3RhbmRhcmRUeXBlcy5qcyIsIi4uL3NyYy9JbmZlclR5cGUuanMiLCIuLi9zcmMvQ3JlYXRlQ29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGNsYXNzIFN5c3RlbU1hbmFnZXJcbiAqL1xuZXhwb3J0IGNsYXNzIFN5c3RlbU1hbmFnZXIge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMuc3lzdGVtcyA9IFtdO1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIHN5c3RlbVxuICAgKiBAcGFyYW0ge1N5c3RlbX0gU3lzdGVtIFN5c3RlbSB0byByZWdpc3RlclxuICAgKi9cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtLCBhdHRyaWJ1dGVzKSB7XG4gICAgdmFyIHN5c3RlbSA9IG5ldyBTeXN0ZW0odGhpcy53b3JsZCwgYXR0cmlidXRlcyk7XG4gICAgc3lzdGVtLm9yZGVyID0gdGhpcy5zeXN0ZW1zLmxlbmd0aDtcbiAgICB0aGlzLnN5c3RlbXMucHVzaChzeXN0ZW0pO1xuICAgIHRoaXMuc29ydFN5c3RlbXMoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHNvcnRTeXN0ZW1zKCkge1xuICAgIHRoaXMuc3lzdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICByZXR1cm4gYS5wcmlvcml0eSAtIGIucHJpb3JpdHkgfHwgYS5vcmRlciAtIGIub3JkZXI7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgc3lzdGVtXG4gICAqIEBwYXJhbSB7U3lzdGVtfSBTeXN0ZW0gU3lzdGVtIHRvIHJlbW92ZVxuICAgKi9cbiAgcmVtb3ZlU3lzdGVtKFN5c3RlbSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuc3lzdGVtcy5pbmRleE9mKFN5c3RlbSk7XG4gICAgaWYgKCF+aW5kZXgpIHJldHVybjtcblxuICAgIHRoaXMuc3lzdGVtcy5zcGxpY2UoaW5kZXgsIDEpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBhbGwgdGhlIHN5c3RlbXMuIENhbGxlZCBwZXIgZnJhbWUuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBkZWx0YSBEZWx0YSB0aW1lIHNpbmNlIHRoZSBsYXN0IGZyYW1lXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lIEVsYXBzZWQgdGltZVxuICAgKi9cbiAgZXhlY3V0ZShkZWx0YSwgdGltZSkge1xuICAgIHRoaXMuc3lzdGVtcy5mb3JFYWNoKHN5c3RlbSA9PiB7XG4gICAgICBpZiAoc3lzdGVtLmVuYWJsZWQgJiYgc3lzdGVtLmluaXRpYWxpemVkKSB7XG4gICAgICAgIGlmIChzeXN0ZW0uZXhlY3V0ZSAmJiBzeXN0ZW0uY2FuRXhlY3V0ZSgpKSB7XG4gICAgICAgICAgbGV0IHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgIHN5c3RlbS5leGVjdXRlKGRlbHRhLCB0aW1lKTtcbiAgICAgICAgICBzeXN0ZW0uZXhlY3V0ZVRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgfVxuICAgICAgICBzeXN0ZW0uY2xlYXJFdmVudHMoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc3RhdHNcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIG51bVN5c3RlbXM6IHRoaXMuc3lzdGVtcy5sZW5ndGgsXG4gICAgICBzeXN0ZW1zOiB7fVxuICAgIH07XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuc3lzdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN5c3RlbSA9IHRoaXMuc3lzdGVtc1tpXTtcbiAgICAgIHZhciBzeXN0ZW1TdGF0cyA9IChzdGF0cy5zeXN0ZW1zW3N5c3RlbS5jb25zdHJ1Y3Rvci5uYW1lXSA9IHtcbiAgICAgICAgcXVlcmllczoge31cbiAgICAgIH0pO1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiBzeXN0ZW0uY3R4KSB7XG4gICAgICAgIHN5c3RlbVN0YXRzLnF1ZXJpZXNbbmFtZV0gPSBzeXN0ZW0uY3R4W25hbWVdLnN0YXRzKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG4iLCIvKipcbiAqIEBjbGFzcyBFdmVudERpc3BhdGNoZXJcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRXZlbnREaXNwYXRjaGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5fbGlzdGVuZXJzID0ge307XG4gICAgdGhpcy5zdGF0cyA9IHtcbiAgICAgIGZpcmVkOiAwLFxuICAgICAgaGFuZGxlZDogMFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQWRkIGFuIGV2ZW50IGxpc3RlbmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gbGlzdGVuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIHRvIHRyaWdnZXIgd2hlbiB0aGUgZXZlbnQgaXMgZmlyZWRcbiAgICovXG4gIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIGxldCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG4gICAgaWYgKGxpc3RlbmVyc1tldmVudE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudE5hbWVdID0gW107XG4gICAgfVxuXG4gICAgaWYgKGxpc3RlbmVyc1tldmVudE5hbWVdLmluZGV4T2YobGlzdGVuZXIpID09PSAtMSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50TmFtZV0ucHVzaChsaXN0ZW5lcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIGFuIGV2ZW50IGxpc3RlbmVyIGlzIGFscmVhZHkgYWRkZWQgdG8gdGhlIGxpc3Qgb2YgbGlzdGVuZXJzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gY2hlY2tcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnRcbiAgICovXG4gIGhhc0V2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXS5pbmRleE9mKGxpc3RlbmVyKSAhPT0gLTFcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbiBldmVudCBsaXN0ZW5lclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIHJlbW92ZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayBmb3IgdGhlIHNwZWNpZmllZCBldmVudFxuICAgKi9cbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgdmFyIGxpc3RlbmVyQXJyYXkgPSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXTtcbiAgICBpZiAobGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgaW5kZXggPSBsaXN0ZW5lckFycmF5LmluZGV4T2YobGlzdGVuZXIpO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICBsaXN0ZW5lckFycmF5LnNwbGljZShpbmRleCwgMSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIERpc3BhdGNoIGFuIGV2ZW50XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gZGlzcGF0Y2hcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAoT3B0aW9uYWwpIEVudGl0eSB0byBlbWl0XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBjb21wb25lbnRcbiAgICovXG4gIGRpc3BhdGNoRXZlbnQoZXZlbnROYW1lLCBlbnRpdHksIGNvbXBvbmVudCkge1xuICAgIHRoaXMuc3RhdHMuZmlyZWQrKztcblxuICAgIHZhciBsaXN0ZW5lckFycmF5ID0gdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV07XG4gICAgaWYgKGxpc3RlbmVyQXJyYXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGFycmF5ID0gbGlzdGVuZXJBcnJheS5zbGljZSgwKTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICBhcnJheVtpXS5jYWxsKHRoaXMsIGVudGl0eSwgY29tcG9uZW50KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVzZXQgc3RhdHMgY291bnRlcnNcbiAgICovXG4gIHJlc2V0Q291bnRlcnMoKSB7XG4gICAgdGhpcy5zdGF0cy5maXJlZCA9IHRoaXMuc3RhdHMuaGFuZGxlZCA9IDA7XG4gIH1cbn1cbiIsIi8qKlxuICogUmV0dXJuIHRoZSBuYW1lIG9mIGEgY29tcG9uZW50XG4gKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXROYW1lKENvbXBvbmVudCkge1xuICByZXR1cm4gQ29tcG9uZW50Lm5hbWU7XG59XG5cbi8qKlxuICogUmV0dXJuIGEgdmFsaWQgcHJvcGVydHkgbmFtZSBmb3IgdGhlIENvbXBvbmVudFxuICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCkge1xuICB2YXIgbmFtZSA9IGdldE5hbWUoQ29tcG9uZW50KTtcbiAgcmV0dXJuIG5hbWUuY2hhckF0KDApLnRvTG93ZXJDYXNlKCkgKyBuYW1lLnNsaWNlKDEpO1xufVxuXG4vKipcbiAqIEdldCBhIGtleSBmcm9tIGEgbGlzdCBvZiBjb21wb25lbnRzXG4gKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgQXJyYXkgb2YgY29tcG9uZW50cyB0byBnZW5lcmF0ZSB0aGUga2V5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBxdWVyeUtleShDb21wb25lbnRzKSB7XG4gIHZhciBuYW1lcyA9IFtdO1xuICBmb3IgKHZhciBuID0gMDsgbiA8IENvbXBvbmVudHMubGVuZ3RoOyBuKyspIHtcbiAgICB2YXIgVCA9IENvbXBvbmVudHNbbl07XG4gICAgaWYgKHR5cGVvZiBUID09PSBcIm9iamVjdFwiKSB7XG4gICAgICB2YXIgb3BlcmF0b3IgPSBULm9wZXJhdG9yID09PSBcIm5vdFwiID8gXCIhXCIgOiBULm9wZXJhdG9yO1xuICAgICAgbmFtZXMucHVzaChvcGVyYXRvciArIGdldE5hbWUoVC5Db21wb25lbnQpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZXMucHVzaChnZXROYW1lKFQpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmFtZXNcbiAgICAubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB4LnRvTG93ZXJDYXNlKCk7XG4gICAgfSlcbiAgICAuc29ydCgpXG4gICAgLmpvaW4oXCItXCIpO1xufVxuIiwiaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcbmltcG9ydCB7IHF1ZXJ5S2V5IH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcblxuLyoqXG4gKiBAY2xhc3MgUXVlcnlcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUXVlcnkge1xuICAvKipcbiAgICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIExpc3Qgb2YgdHlwZXMgb2YgY29tcG9uZW50cyB0byBxdWVyeVxuICAgKi9cbiAgY29uc3RydWN0b3IoQ29tcG9uZW50cywgbWFuYWdlcikge1xuICAgIHRoaXMuQ29tcG9uZW50cyA9IFtdO1xuICAgIHRoaXMuTm90Q29tcG9uZW50cyA9IFtdO1xuXG4gICAgQ29tcG9uZW50cy5mb3JFYWNoKGNvbXBvbmVudCA9PiB7XG4gICAgICBpZiAodHlwZW9mIGNvbXBvbmVudCA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICB0aGlzLk5vdENvbXBvbmVudHMucHVzaChjb21wb25lbnQuQ29tcG9uZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuQ29tcG9uZW50cy5wdXNoKGNvbXBvbmVudCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5Db21wb25lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgY3JlYXRlIGEgcXVlcnkgd2l0aG91dCBjb21wb25lbnRzXCIpO1xuICAgIH1cblxuICAgIHRoaXMuZW50aXRpZXMgPSBbXTtcblxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyID0gbmV3IEV2ZW50RGlzcGF0Y2hlcigpO1xuXG4gICAgLy8gVGhpcyBxdWVyeSBpcyBiZWluZyB1c2VkIGJ5IGEgcmVhY3RpdmUgc3lzdGVtXG4gICAgdGhpcy5yZWFjdGl2ZSA9IGZhbHNlO1xuXG4gICAgdGhpcy5rZXkgPSBxdWVyeUtleShDb21wb25lbnRzKTtcblxuICAgIC8vIEZpbGwgdGhlIHF1ZXJ5IHdpdGggdGhlIGV4aXN0aW5nIGVudGl0aWVzXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtYW5hZ2VyLl9lbnRpdGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGVudGl0eSA9IG1hbmFnZXIuX2VudGl0aWVzW2ldO1xuICAgICAgaWYgKHRoaXMubWF0Y2goZW50aXR5KSkge1xuICAgICAgICAvLyBAdG9kbyA/Pz8gdGhpcy5hZGRFbnRpdHkoZW50aXR5KTsgPT4gcHJldmVudGluZyB0aGUgZXZlbnQgdG8gYmUgZ2VuZXJhdGVkXG4gICAgICAgIGVudGl0eS5xdWVyaWVzLnB1c2godGhpcyk7XG4gICAgICAgIHRoaXMuZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgZW50aXR5IHRvIHRoaXMgcXVlcnlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eVxuICAgKi9cbiAgYWRkRW50aXR5KGVudGl0eSkge1xuICAgIGVudGl0eS5xdWVyaWVzLnB1c2godGhpcyk7XG4gICAgdGhpcy5lbnRpdGllcy5wdXNoKGVudGl0eSk7XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQsIGVudGl0eSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGVudGl0eSBmcm9tIHRoaXMgcXVlcnlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlRW50aXR5KGVudGl0eSkge1xuICAgIGxldCBpbmRleCA9IHRoaXMuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuICAgIGlmICh+aW5kZXgpIHtcbiAgICAgIHRoaXMuZW50aXRpZXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgICAgaW5kZXggPSBlbnRpdHkucXVlcmllcy5pbmRleE9mKHRoaXMpO1xuICAgICAgZW50aXR5LnF1ZXJpZXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICBlbnRpdHlcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbWF0Y2goZW50aXR5LCBpbmNsdWRlUmVtb3ZlZCA9IGZhbHNlKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGVudGl0eS5oYXNBbGxDb21wb25lbnRzKHRoaXMuQ29tcG9uZW50cywgaW5jbHVkZVJlbW92ZWQpICYmXG4gICAgICAhZW50aXR5Lmhhc0FueUNvbXBvbmVudHModGhpcy5Ob3RDb21wb25lbnRzLCBpbmNsdWRlUmVtb3ZlZClcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzdGF0cyBmb3IgdGhpcyBxdWVyeVxuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG51bUNvbXBvbmVudHM6IHRoaXMuQ29tcG9uZW50cy5sZW5ndGgsXG4gICAgICBudW1FbnRpdGllczogdGhpcy5lbnRpdGllcy5sZW5ndGhcbiAgICB9O1xuICB9XG59XG5cblF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQgPSBcIlF1ZXJ5I0VOVElUWV9BRERFRFwiO1xuUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVEID0gXCJRdWVyeSNFTlRJVFlfUkVNT1ZFRFwiO1xuUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VEID0gXCJRdWVyeSNDT01QT05FTlRfQ0hBTkdFRFwiO1xuIiwiaW1wb3J0IFF1ZXJ5IGZyb20gXCIuL1F1ZXJ5LmpzXCI7XG5pbXBvcnQgd3JhcEltbXV0YWJsZUNvbXBvbmVudCBmcm9tIFwiLi9XcmFwSW1tdXRhYmxlQ29tcG9uZW50LmpzXCI7XG5cbi8vIEB0b2RvIFRha2UgdGhpcyBvdXQgZnJvbSB0aGVyZSBvciB1c2UgRU5WXG5jb25zdCBERUJVRyA9IGZhbHNlO1xuXG4vLyBAdG9kbyByZXNldCBpdCBieSB3b3JsZD9cbnZhciBuZXh0SWQgPSAwO1xuXG4vKipcbiAqIEBjbGFzcyBFbnRpdHlcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRW50aXR5IHtcbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAY2xhc3MgRW50aXR5XG4gICAqIEBwYXJhbSB7V29ybGR9IHdvcmxkXG4gICAqL1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMuX3dvcmxkID0gd29ybGQgfHwgbnVsbDtcblxuICAgIC8vIFVuaXF1ZSBJRCBmb3IgdGhpcyBlbnRpdHlcbiAgICB0aGlzLmlkID0gbmV4dElkKys7XG5cbiAgICAvLyBMaXN0IG9mIGNvbXBvbmVudHMgdHlwZXMgdGhlIGVudGl0eSBoYXNcbiAgICB0aGlzLl9Db21wb25lbnRUeXBlcyA9IFtdO1xuXG4gICAgLy8gSW5zdGFuY2Ugb2YgdGhlIGNvbXBvbmVudHNcbiAgICB0aGlzLl9jb21wb25lbnRzID0ge307XG5cbiAgICAvLyBRdWVyaWVzIHdoZXJlIHRoZSBlbnRpdHkgaXMgYWRkZWRcbiAgICB0aGlzLnF1ZXJpZXMgPSBbXTtcblxuICAgIC8vIFVzZWQgZm9yIGRlZmVycmVkIHJlbW92YWxcbiAgICB0aGlzLmNvbXBvbmVudHNUb1JlbW92ZSA9IFtdO1xuICB9XG5cbiAgLy8gQ09NUE9ORU5UU1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gYW4gaW1tdXRhYmxlIHJlZmVyZW5jZSBvZiBhIGNvbXBvbmVudFxuICAgKiBOb3RlOiBBIHByb3h5IHdpbGwgYmUgdXNlZCBvbiBkZWJ1ZyBtb2RlLCBhbmQgaXQgd2lsbCBqdXN0IGFmZmVjdFxuICAgKiAgICAgICB0aGUgZmlyc3QgbGV2ZWwgYXR0cmlidXRlcyBvbiB0aGUgb2JqZWN0LCBpdCB3b24ndCB3b3JrIHJlY3Vyc2l2ZWx5LlxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gVHlwZSBvZiBjb21wb25lbnQgdG8gZ2V0XG4gICAqIEByZXR1cm4ge0NvbXBvbmVudH0gSW1tdXRhYmxlIGNvbXBvbmVudCByZWZlcmVuY2VcbiAgICovXG4gIGdldENvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcy5fY29tcG9uZW50c1tDb21wb25lbnQubmFtZV07XG4gICAgcmV0dXJuIERFQlVHID8gd3JhcEltbXV0YWJsZUNvbXBvbmVudChDb21wb25lbnQsIGNvbXBvbmVudCkgOiBjb21wb25lbnQ7XG4gIH1cblxuICBnZXRDb21wb25lbnRzKCkge1xuICAgIHJldHVybiB0aGlzLl9jb21wb25lbnRzO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50VHlwZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX0NvbXBvbmVudFR5cGVzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIG11dGFibGUgcmVmZXJlbmNlIG9mIGEgY29tcG9uZW50LlxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gVHlwZSBvZiBjb21wb25lbnQgdG8gZ2V0XG4gICAqIEByZXR1cm4ge0NvbXBvbmVudH0gTXV0YWJsZSBjb21wb25lbnQgcmVmZXJlbmNlXG4gICAqL1xuICBnZXRNdXRhYmxlQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucXVlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW2ldO1xuICAgICAgaWYgKHF1ZXJ5LnJlYWN0aXZlKSB7XG4gICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgIGNvbXBvbmVudFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY29tcG9uZW50O1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIGNvbXBvbmVudCB0byB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgdG8gYWRkIHRvIHRoaXMgZW50aXR5XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBPcHRpb25hbCB2YWx1ZXMgdG8gcmVwbGFjZSB0aGUgZGVmYXVsdCBhdHRyaWJ1dGVzIG9uIHRoZSBjb21wb25lbnRcbiAgICovXG4gIGFkZENvbXBvbmVudChDb21wb25lbnQsIHZhbHVlcykge1xuICAgIHRoaXMuX3dvcmxkLmVudGl0eUFkZENvbXBvbmVudCh0aGlzLCBDb21wb25lbnQsIHZhbHVlcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgY29tcG9uZW50IGZyb20gdGhlIGVudGl0eVxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZUNvbXBvbmVudChDb21wb25lbnQsIGZvcmNlUmVtb3ZlKSB7XG4gICAgdGhpcy5fd29ybGQuZW50aXR5UmVtb3ZlQ29tcG9uZW50KHRoaXMsIENvbXBvbmVudCwgZm9yY2VSZW1vdmUpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGEgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgdG8gY2hlY2tcbiAgICogQHBhcmFtIHtCb29sfSBpbmNsdWRlIENvbXBvbmVudHMgcXVldWVkIGZvciByZW1vdmFsIChEZWZhdWx0IGlzIGZhbHNlKVxuICAgKi9cbiAgaGFzQ29tcG9uZW50KENvbXBvbmVudCwgaW5jbHVkZVJlbW92ZWQgPSBmYWxzZSkge1xuICAgIHJldHVybiAoXG4gICAgICAhIX50aGlzLl9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgIChpbmNsdWRlUmVtb3ZlZCB8fCAhfnRoaXMuY29tcG9uZW50c1RvUmVtb3ZlLmluZGV4T2YoQ29tcG9uZW50KSlcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGFsbCBjb21wb25lbnRzIGluIGEgbGlzdFxuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgdG8gY2hlY2tcbiAgICogQHBhcmFtIHtCb29sfSBpbmNsdWRlIENvbXBvbmVudHMgcXVldWVkIGZvciByZW1vdmFsIChEZWZhdWx0IGlzIGZhbHNlKVxuICAgKi9cbiAgaGFzQWxsQ29tcG9uZW50cyhDb21wb25lbnRzLCBpbmNsdWRlUmVtb3ZlZCA9IGZhbHNlKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBDb21wb25lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIXRoaXMuaGFzQ29tcG9uZW50KENvbXBvbmVudHNbaV0sIGluY2x1ZGVSZW1vdmVkKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGUgZW50aXR5IGhhcyBhbnkgY29tcG9uZW50cyBpbiBhIGxpc3RcbiAgICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIHRvIGNoZWNrXG4gICAqIEBwYXJhbSB7Qm9vbH0gaW5jbHVkZSBDb21wb25lbnRzIHF1ZXVlZCBmb3IgcmVtb3ZhbCAoRGVmYXVsdCBpcyBmYWxzZSlcbiAgICovXG4gIGhhc0FueUNvbXBvbmVudHMoQ29tcG9uZW50cywgaW5jbHVkZVJlbW92ZWQgPSBmYWxzZSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuaGFzQ29tcG9uZW50KENvbXBvbmVudHNbaV0sIGluY2x1ZGVSZW1vdmVkKSkgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRoZSBjb21wb25lbnRzIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlQWxsQ29tcG9uZW50cyhmb3JjZVJlbW92ZSkge1xuICAgIHJldHVybiB0aGlzLl93b3JsZC5lbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKHRoaXMsIGZvcmNlUmVtb3ZlKTtcbiAgfVxuXG4gIC8vIEVYVFJBU1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIHRoZSBlbnRpdHkuIFRvIGJlIHVzZWQgd2hlbiByZXR1cm5pbmcgYW4gZW50aXR5IHRvIHRoZSBwb29sXG4gICAqL1xuICByZXNldCgpIHtcbiAgICB0aGlzLmlkID0gbmV4dElkKys7XG4gICAgdGhpcy5fd29ybGQgPSBudWxsO1xuICAgIHRoaXMuX0NvbXBvbmVudFR5cGVzLmxlbmd0aCA9IDA7XG4gICAgdGhpcy5xdWVyaWVzLmxlbmd0aCA9IDA7XG4gICAgdGhpcy5fY29tcG9uZW50cyA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0aGUgZW50aXR5IGZyb20gdGhlIHdvcmxkXG4gICAqL1xuICByZW1vdmUoZm9yY2VSZW1vdmUpIHtcbiAgICByZXR1cm4gdGhpcy5fd29ybGQucmVtb3ZlRW50aXR5KHRoaXMsIGZvcmNlUmVtb3ZlKTtcbiAgfVxufVxuIiwiLyoqXG4gKiBAY2xhc3MgT2JqZWN0UG9vbFxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBPYmplY3RQb29sIHtcbiAgLy8gQHRvZG8gQWRkIGluaXRpYWwgc2l6ZVxuICBjb25zdHJ1Y3RvcihULCBpbml0aWFsU2l6ZSkge1xuICAgIHRoaXMuZnJlZUxpc3QgPSBbXTtcbiAgICB0aGlzLmNvdW50ID0gMDtcbiAgICB0aGlzLlQgPSBUO1xuXG4gICAgdmFyIGV4dHJhQXJncyA9IG51bGw7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICBleHRyYUFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgZXh0cmFBcmdzLnNoaWZ0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5jcmVhdGVFbGVtZW50ID0gZXh0cmFBcmdzXG4gICAgICA/ICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFQoLi4uZXh0cmFBcmdzKTtcbiAgICAgICAgfVxuICAgICAgOiAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBUKCk7XG4gICAgICAgIH07XG5cbiAgICBpZiAodHlwZW9mIGluaXRpYWxTaXplICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICB0aGlzLmV4cGFuZChpbml0aWFsU2l6ZSk7XG4gICAgfVxuICB9XG5cbiAgYXF1aXJlKCkge1xuICAgIC8vIEdyb3cgdGhlIGxpc3QgYnkgMjAlaXNoIGlmIHdlJ3JlIG91dFxuICAgIGlmICh0aGlzLmZyZWVMaXN0Lmxlbmd0aCA8PSAwKSB7XG4gICAgICB0aGlzLmV4cGFuZChNYXRoLnJvdW5kKHRoaXMuY291bnQgKiAwLjIpICsgMSk7XG4gICAgfVxuXG4gICAgdmFyIGl0ZW0gPSB0aGlzLmZyZWVMaXN0LnBvcCgpO1xuXG4gICAgcmV0dXJuIGl0ZW07XG4gIH1cblxuICByZWxlYXNlKGl0ZW0pIHtcbiAgICBpdGVtLnJlc2V0KCk7XG4gICAgdGhpcy5mcmVlTGlzdC5wdXNoKGl0ZW0pO1xuICB9XG5cbiAgZXhwYW5kKGNvdW50KSB7XG4gICAgZm9yICh2YXIgbiA9IDA7IG4gPCBjb3VudDsgbisrKSB7XG4gICAgICB0aGlzLmZyZWVMaXN0LnB1c2godGhpcy5jcmVhdGVFbGVtZW50KCkpO1xuICAgIH1cbiAgICB0aGlzLmNvdW50ICs9IGNvdW50O1xuICB9XG5cbiAgdG90YWxTaXplKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50O1xuICB9XG5cbiAgdG90YWxGcmVlKCkge1xuICAgIHJldHVybiB0aGlzLmZyZWVMaXN0Lmxlbmd0aDtcbiAgfVxuXG4gIHRvdGFsVXNlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5jb3VudCAtIHRoaXMuZnJlZUxpc3QubGVuZ3RoO1xuICB9XG59XG4iLCJpbXBvcnQgUXVlcnkgZnJvbSBcIi4vUXVlcnkuanNcIjtcbmltcG9ydCB7IHF1ZXJ5S2V5IH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcblxuLyoqXG4gKiBAY2xhc3MgUXVlcnlNYW5hZ2VyXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFF1ZXJ5TWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy5fd29ybGQgPSB3b3JsZDtcblxuICAgIC8vIFF1ZXJpZXMgaW5kZXhlZCBieSBhIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgY29tcG9uZW50cyBpdCBoYXNcbiAgICB0aGlzLl9xdWVyaWVzID0ge307XG4gIH1cblxuICBvbkVudGl0eVJlbW92ZWQoZW50aXR5KSB7XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgIGlmIChlbnRpdHkucXVlcmllcy5pbmRleE9mKHF1ZXJ5KSAhPT0gLTEpIHtcbiAgICAgICAgcXVlcnkucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdoZW4gYSBjb21wb25lbnQgaXMgYWRkZWQgdG8gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRoYXQganVzdCBnb3QgdGhlIG5ldyBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgYWRkZWQgdG8gdGhlIGVudGl0eVxuICAgKi9cbiAgb25FbnRpdHlDb21wb25lbnRBZGRlZChlbnRpdHksIENvbXBvbmVudCkge1xuICAgIC8vIEB0b2RvIFVzZSBiaXRtYXNrIGZvciBjaGVja2luZyBjb21wb25lbnRzP1xuXG4gICAgLy8gQ2hlY2sgZWFjaCBpbmRleGVkIHF1ZXJ5IHRvIHNlZSBpZiB3ZSBuZWVkIHRvIGFkZCB0aGlzIGVudGl0eSB0byB0aGUgbGlzdFxuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIGlmIChcbiAgICAgICAgISF+cXVlcnkuTm90Q29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgICAgfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIHF1ZXJ5LnJlbW92ZUVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIHRoZSBlbnRpdHkgb25seSBpZjpcbiAgICAgIC8vIENvbXBvbmVudCBpcyBpbiB0aGUgcXVlcnlcbiAgICAgIC8vIGFuZCBFbnRpdHkgaGFzIEFMTCB0aGUgY29tcG9uZW50cyBvZiB0aGUgcXVlcnlcbiAgICAgIC8vIGFuZCBFbnRpdHkgaXMgbm90IGFscmVhZHkgaW4gdGhlIHF1ZXJ5XG4gICAgICBpZiAoXG4gICAgICAgICF+cXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgfHxcbiAgICAgICAgIXF1ZXJ5Lm1hdGNoKGVudGl0eSkgfHxcbiAgICAgICAgfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KVxuICAgICAgKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgcXVlcnkuYWRkRW50aXR5KGVudGl0eSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdoZW4gYSBjb21wb25lbnQgaXMgcmVtb3ZlZCBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBmcm9tXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIG9uRW50aXR5Q29tcG9uZW50UmVtb3ZlZChlbnRpdHksIENvbXBvbmVudCkge1xuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIGlmIChcbiAgICAgICAgISF+cXVlcnkuTm90Q29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgICAgIX5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSkgJiZcbiAgICAgICAgcXVlcnkubWF0Y2goZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIHF1ZXJ5LmFkZEVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICAhIX5xdWVyeS5Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgICAhIX5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSkgJiZcbiAgICAgICAgIXF1ZXJ5Lm1hdGNoKGVudGl0eSlcbiAgICAgICkge1xuICAgICAgICBxdWVyeS5yZW1vdmVFbnRpdHkoZW50aXR5KTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHF1ZXJ5IGZvciB0aGUgc3BlY2lmaWVkIGNvbXBvbmVudHNcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudHMgQ29tcG9uZW50cyB0aGF0IHRoZSBxdWVyeSBzaG91bGQgaGF2ZVxuICAgKi9cbiAgZ2V0UXVlcnkoQ29tcG9uZW50cykge1xuICAgIHZhciBrZXkgPSBxdWVyeUtleShDb21wb25lbnRzKTtcbiAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW2tleV07XG4gICAgaWYgKCFxdWVyeSkge1xuICAgICAgdGhpcy5fcXVlcmllc1trZXldID0gcXVlcnkgPSBuZXcgUXVlcnkoQ29tcG9uZW50cywgdGhpcy5fd29ybGQpO1xuICAgIH1cbiAgICByZXR1cm4gcXVlcnk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHNvbWUgc3RhdHMgZnJvbSB0aGlzIGNsYXNzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7fTtcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgc3RhdHNbcXVlcnlOYW1lXSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXS5zdGF0cygpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cbiIsImltcG9ydCBFbnRpdHkgZnJvbSBcIi4vRW50aXR5LmpzXCI7XG5pbXBvcnQgT2JqZWN0UG9vbCBmcm9tIFwiLi9PYmplY3RQb29sLmpzXCI7XG5pbXBvcnQgUXVlcnlNYW5hZ2VyIGZyb20gXCIuL1F1ZXJ5TWFuYWdlci5qc1wiO1xuaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcbmltcG9ydCB7IGNvbXBvbmVudFByb3BlcnR5TmFtZSwgZ2V0TmFtZSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIEVudGl0eU1hbmFnZXJcbiAqL1xuZXhwb3J0IGNsYXNzIEVudGl0eU1hbmFnZXIge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyID0gd29ybGQuY29tcG9uZW50c01hbmFnZXI7XG5cbiAgICAvLyBBbGwgdGhlIGVudGl0aWVzIGluIHRoaXMgaW5zdGFuY2VcbiAgICB0aGlzLl9lbnRpdGllcyA9IFtdO1xuXG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyID0gbmV3IFF1ZXJ5TWFuYWdlcih0aGlzKTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlciA9IG5ldyBFdmVudERpc3BhdGNoZXIoKTtcbiAgICB0aGlzLl9lbnRpdHlQb29sID0gbmV3IE9iamVjdFBvb2woRW50aXR5KTtcblxuICAgIC8vIERlZmVycmVkIGRlbGV0aW9uXG4gICAgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUgPSBbXTtcbiAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUgPSBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgZW50aXR5XG4gICAqL1xuICBjcmVhdGVFbnRpdHkoKSB7XG4gICAgdmFyIGVudGl0eSA9IHRoaXMuX2VudGl0eVBvb2wuYXF1aXJlKCk7XG4gICAgZW50aXR5Ll93b3JsZCA9IHRoaXM7XG4gICAgdGhpcy5fZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoRU5USVRZX0NSRUFURUQsIGVudGl0eSk7XG4gICAgcmV0dXJuIGVudGl0eTtcbiAgfVxuXG4gIC8vIENPTVBPTkVOVFNcblxuICAvKipcbiAgICogQWRkIGEgY29tcG9uZW50IHRvIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB3aGVyZSB0aGUgY29tcG9uZW50IHdpbGwgYmUgYWRkZWRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gYmUgYWRkZWQgdG8gdGhlIGVudGl0eVxuICAgKiBAcGFyYW0ge09iamVjdH0gdmFsdWVzIE9wdGlvbmFsIHZhbHVlcyB0byByZXBsYWNlIHRoZSBkZWZhdWx0IGF0dHJpYnV0ZXNcbiAgICovXG4gIGVudGl0eUFkZENvbXBvbmVudChlbnRpdHksIENvbXBvbmVudCwgdmFsdWVzKSB7XG4gICAgaWYgKH5lbnRpdHkuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KSkgcmV0dXJuO1xuXG4gICAgZW50aXR5Ll9Db21wb25lbnRUeXBlcy5wdXNoKENvbXBvbmVudCk7XG5cbiAgICB2YXIgY29tcG9uZW50UG9vbCA9IHRoaXMud29ybGQuY29tcG9uZW50c01hbmFnZXIuZ2V0Q29tcG9uZW50c1Bvb2woXG4gICAgICBDb21wb25lbnRcbiAgICApO1xuICAgIHZhciBjb21wb25lbnQgPSBjb21wb25lbnRQb29sLmFxdWlyZSgpO1xuXG4gICAgZW50aXR5Ll9jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IGNvbXBvbmVudDtcblxuICAgIGlmICh2YWx1ZXMpIHtcbiAgICAgIGlmIChjb21wb25lbnQuY29weSkge1xuICAgICAgICBjb21wb25lbnQuY29weSh2YWx1ZXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yICh2YXIgbmFtZSBpbiB2YWx1ZXMpIHtcbiAgICAgICAgICBjb21wb25lbnRbbmFtZV0gPSB2YWx1ZXNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIub25FbnRpdHlDb21wb25lbnRBZGRlZChlbnRpdHksIENvbXBvbmVudCk7XG4gICAgdGhpcy53b3JsZC5jb21wb25lbnRzTWFuYWdlci5jb21wb25lbnRBZGRlZFRvRW50aXR5KENvbXBvbmVudCk7XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KENPTVBPTkVOVF9BRERFRCwgZW50aXR5LCBDb21wb25lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIGNvbXBvbmVudCBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB3aGljaCB3aWxsIGdldCByZW1vdmVkIHRoZSBjb21wb25lbnRcbiAgICogQHBhcmFtIHsqfSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtCb29sfSBmb3JjZVJlbW92ZSBJZiB5b3Ugd2FudCB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBpbW1lZGlhdGVseSBpbnN0ZWFkIG9mIGRlZmVycmVkIChEZWZhdWx0IGlzIGZhbHNlKVxuICAgKi9cbiAgZW50aXR5UmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50LCBmb3JjZVJlbW92ZSkge1xuICAgIHZhciBpbmRleCA9IGVudGl0eS5fQ29tcG9uZW50VHlwZXMuaW5kZXhPZihDb21wb25lbnQpO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KENPTVBPTkVOVF9SRU1PVkUsIGVudGl0eSwgQ29tcG9uZW50KTtcblxuICAgIGlmIChmb3JjZVJlbW92ZSkge1xuICAgICAgdGhpcy5fZW50aXR5UmVtb3ZlQ29tcG9uZW50U3luYyhlbnRpdHksIENvbXBvbmVudCwgaW5kZXgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZW50aXR5LmNvbXBvbmVudHNUb1JlbW92ZS5sZW5ndGggPT09IDApXG4gICAgICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlLnB1c2goZW50aXR5KTtcbiAgICAgIGVudGl0eS5jb21wb25lbnRzVG9SZW1vdmUucHVzaChDb21wb25lbnQpO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGVhY2ggaW5kZXhlZCBxdWVyeSB0byBzZWUgaWYgd2UgbmVlZCB0byByZW1vdmUgaXRcbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIub25FbnRpdHlDb21wb25lbnRSZW1vdmVkKGVudGl0eSwgQ29tcG9uZW50KTtcbiAgfVxuXG4gIF9lbnRpdHlSZW1vdmVDb21wb25lbnRTeW5jKGVudGl0eSwgQ29tcG9uZW50LCBpbmRleCkge1xuICAgIC8vIFJlbW92ZSBUIGxpc3Rpbmcgb24gZW50aXR5IGFuZCBwcm9wZXJ0eSByZWYsIHRoZW4gZnJlZSB0aGUgY29tcG9uZW50LlxuICAgIGVudGl0eS5fQ29tcG9uZW50VHlwZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB2YXIgcHJvcE5hbWUgPSBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KTtcbiAgICB2YXIgY29tcG9uZW50TmFtZSA9IGdldE5hbWUoQ29tcG9uZW50KTtcbiAgICB2YXIgY29tcG9uZW50ID0gZW50aXR5Ll9jb21wb25lbnRzW2NvbXBvbmVudE5hbWVdO1xuICAgIGRlbGV0ZSBlbnRpdHkuX2NvbXBvbmVudHNbY29tcG9uZW50TmFtZV07XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5fY29tcG9uZW50UG9vbFtwcm9wTmFtZV0ucmVsZWFzZShjb21wb25lbnQpO1xuICAgIHRoaXMud29ybGQuY29tcG9uZW50c01hbmFnZXIuY29tcG9uZW50UmVtb3ZlZEZyb21FbnRpdHkoQ29tcG9uZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRoZSBjb21wb25lbnRzIGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IGZyb20gd2hpY2ggdGhlIGNvbXBvbmVudHMgd2lsbCBiZSByZW1vdmVkXG4gICAqL1xuICBlbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKGVudGl0eSwgZm9yY2VSZW1vdmUpIHtcbiAgICBsZXQgQ29tcG9uZW50cyA9IGVudGl0eS5fQ29tcG9uZW50VHlwZXM7XG5cbiAgICBmb3IgKGxldCBqID0gQ29tcG9uZW50cy5sZW5ndGggLSAxOyBqID49IDA7IGotLSkge1xuICAgICAgdGhpcy5lbnRpdHlSZW1vdmVDb21wb25lbnQoZW50aXR5LCBDb21wb25lbnRzW2pdLCBmb3JjZVJlbW92ZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0aGUgZW50aXR5IGZyb20gdGhpcyBtYW5hZ2VyLiBJdCB3aWxsIGNsZWFyIGFsc28gaXRzIGNvbXBvbmVudHNcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdG8gcmVtb3ZlIGZyb20gdGhlIG1hbmFnZXJcbiAgICogQHBhcmFtIHtCb29sfSBmb3JjZVJlbW92ZSBJZiB5b3Ugd2FudCB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBpbW1lZGlhdGVseSBpbnN0ZWFkIG9mIGRlZmVycmVkIChEZWZhdWx0IGlzIGZhbHNlKVxuICAgKi9cbiAgcmVtb3ZlRW50aXR5KGVudGl0eSwgZm9yY2VSZW1vdmUpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLl9lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG5cbiAgICBpZiAoIX5pbmRleCkgdGhyb3cgbmV3IEVycm9yKFwiVHJpZWQgdG8gcmVtb3ZlIGVudGl0eSBub3QgaW4gbGlzdFwiKTtcblxuICAgIC8vIFJlbW92ZSBmcm9tIGVudGl0eSBsaXN0XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChFTlRJVFlfUkVNT1ZFRCwgZW50aXR5KTtcbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIub25FbnRpdHlSZW1vdmVkKGVudGl0eSk7XG5cbiAgICBpZiAoZm9yY2VSZW1vdmUgPT09IHRydWUpIHtcbiAgICAgIHRoaXMuX3JlbW92ZUVudGl0eVN5bmMoZW50aXR5LCBpbmRleCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZW50aXRpZXNUb1JlbW92ZS5wdXNoKGVudGl0eSk7XG4gICAgfVxuICB9XG5cbiAgX3JlbW92ZUVudGl0eVN5bmMoZW50aXR5LCBpbmRleCkge1xuICAgIHRoaXMuX2VudGl0aWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICB0aGlzLmVudGl0eVJlbW92ZUFsbENvbXBvbmVudHMoZW50aXR5LCB0cnVlKTtcblxuICAgIC8vIFByZXZlbnQgYW55IGFjY2VzcyBhbmQgZnJlZVxuICAgIGVudGl0eS5fd29ybGQgPSBudWxsO1xuICAgIHRoaXMuX2VudGl0eVBvb2wucmVsZWFzZShlbnRpdHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbGwgZW50aXRpZXMgZnJvbSB0aGlzIG1hbmFnZXJcbiAgICovXG4gIHJlbW92ZUFsbEVudGl0aWVzKCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLl9lbnRpdGllcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdGhpcy5fZW50aXRpZXNbaV0ucmVtb3ZlKCk7XG4gICAgfVxuICB9XG5cbiAgcHJvY2Vzc0RlZmVycmVkUmVtb3ZhbCgpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZW50aXRpZXNUb1JlbW92ZS5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IGVudGl0eSA9IHRoaXMuZW50aXRpZXNUb1JlbW92ZVtpXTtcbiAgICAgIGxldCBpbmRleCA9IHRoaXMuX2VudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcbiAgICAgIHRoaXMuX3JlbW92ZUVudGl0eVN5bmMoZW50aXR5LCBpbmRleCk7XG4gICAgfVxuICAgIHRoaXMuZW50aXRpZXNUb1JlbW92ZS5sZW5ndGggPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZS5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IGVudGl0eSA9IHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlW2ldO1xuICAgICAgd2hpbGUgKGVudGl0eS5jb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoID4gMCkge1xuICAgICAgICBsZXQgQ29tcG9uZW50ID0gZW50aXR5LmNvbXBvbmVudHNUb1JlbW92ZS5wb3AoKTtcbiAgICAgICAgbGV0IGluZGV4ID0gZW50aXR5Ll9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCk7XG4gICAgICAgIHRoaXMuX2VudGl0eVJlbW92ZUNvbXBvbmVudFN5bmMoZW50aXR5LCBDb21wb25lbnQsIGluZGV4KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZS5sZW5ndGggPSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHF1ZXJ5IGJhc2VkIG9uIGEgbGlzdCBvZiBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBMaXN0IG9mIGNvbXBvbmVudHMgdGhhdCB3aWxsIGZvcm0gdGhlIHF1ZXJ5XG4gICAqL1xuICBxdWVyeUNvbXBvbmVudHMoQ29tcG9uZW50cykge1xuICAgIHJldHVybiB0aGlzLl9xdWVyeU1hbmFnZXIuZ2V0UXVlcnkoQ29tcG9uZW50cyk7XG4gIH1cblxuICAvLyBFWFRSQVNcblxuICAvKipcbiAgICogUmV0dXJuIG51bWJlciBvZiBlbnRpdGllc1xuICAgKi9cbiAgY291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2VudGl0aWVzLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc29tZSBzdGF0c1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge1xuICAgICAgbnVtRW50aXRpZXM6IHRoaXMuX2VudGl0aWVzLmxlbmd0aCxcbiAgICAgIG51bVF1ZXJpZXM6IE9iamVjdC5rZXlzKHRoaXMuX3F1ZXJ5TWFuYWdlci5fcXVlcmllcykubGVuZ3RoLFxuICAgICAgcXVlcmllczogdGhpcy5fcXVlcnlNYW5hZ2VyLnN0YXRzKCksXG4gICAgICBudW1Db21wb25lbnRQb29sOiBPYmplY3Qua2V5cyh0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLl9jb21wb25lbnRQb29sKVxuICAgICAgICAubGVuZ3RoLFxuICAgICAgY29tcG9uZW50UG9vbDoge30sXG4gICAgICBldmVudERpc3BhdGNoZXI6IHRoaXMuZXZlbnREaXNwYXRjaGVyLnN0YXRzXG4gICAgfTtcblxuICAgIGZvciAodmFyIGNuYW1lIGluIHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2wpIHtcbiAgICAgIHZhciBwb29sID0gdGhpcy5jb21wb25lbnRzTWFuYWdlci5fY29tcG9uZW50UG9vbFtjbmFtZV07XG4gICAgICBzdGF0cy5jb21wb25lbnRQb29sW2NuYW1lXSA9IHtcbiAgICAgICAgdXNlZDogcG9vbC50b3RhbFVzZWQoKSxcbiAgICAgICAgc2l6ZTogcG9vbC5jb3VudFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cblxuY29uc3QgRU5USVRZX0NSRUFURUQgPSBcIkVudGl0eU1hbmFnZXIjRU5USVRZX0NSRUFURVwiO1xuY29uc3QgRU5USVRZX1JFTU9WRUQgPSBcIkVudGl0eU1hbmFnZXIjRU5USVRZX1JFTU9WRURcIjtcbmNvbnN0IENPTVBPTkVOVF9BRERFRCA9IFwiRW50aXR5TWFuYWdlciNDT01QT05FTlRfQURERURcIjtcbmNvbnN0IENPTVBPTkVOVF9SRU1PVkUgPSBcIkVudGl0eU1hbmFnZXIjQ09NUE9ORU5UX1JFTU9WRVwiO1xuIiwiLyoqXG4gKiBAY2xhc3MgRHVtbXlPYmplY3RQb29sXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIER1bW15T2JqZWN0UG9vbCB7XG4gIGNvbnN0cnVjdG9yKFQpIHtcbiAgICB0aGlzLmNvdW50ID0gMDtcbiAgICB0aGlzLnVzZWQgPSAwO1xuICAgIHRoaXMuVCA9IFQ7XG4gIH1cblxuICBhcXVpcmUoKSB7XG4gICAgdGhpcy51c2VkKys7XG4gICAgdGhpcy5jb3VudCsrO1xuICAgIHJldHVybiBuZXcgdGhpcy5UKCk7XG4gIH1cblxuICByZWxlYXNlKCkge1xuICAgIHRoaXMudXNlZC0tO1xuICB9XG5cbiAgdG90YWxTaXplKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50O1xuICB9XG5cbiAgdG90YWxGcmVlKCkge1xuICAgIHJldHVybiBJbmZpbml0eTtcbiAgfVxuXG4gIHRvdGFsVXNlZCgpIHtcbiAgICByZXR1cm4gdGhpcy51c2VkO1xuICB9XG59XG4iLCJpbXBvcnQgT2JqZWN0UG9vbCBmcm9tIFwiLi9PYmplY3RQb29sLmpzXCI7XG5pbXBvcnQgRHVtbXlPYmplY3RQb29sIGZyb20gXCIuL0R1bW15T2JqZWN0UG9vbC5qc1wiO1xuaW1wb3J0IHsgY29tcG9uZW50UHJvcGVydHlOYW1lIH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcblxuLyoqXG4gKiBAY2xhc3MgQ29tcG9uZW50TWFuYWdlclxuICovXG5leHBvcnQgY2xhc3MgQ29tcG9uZW50TWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuQ29tcG9uZW50cyA9IHt9O1xuICAgIHRoaXMuX2NvbXBvbmVudFBvb2wgPSB7fTtcbiAgICB0aGlzLm51bUNvbXBvbmVudHMgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZWdpc3RlclxuICAgKi9cbiAgcmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IENvbXBvbmVudDtcbiAgICB0aGlzLm51bUNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gMDtcbiAgfVxuXG4gIGNvbXBvbmVudEFkZGVkVG9FbnRpdHkoQ29tcG9uZW50KSB7XG4gICAgaWYgKCF0aGlzLm51bUNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdKSB7XG4gICAgICB0aGlzLm51bUNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5udW1Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSsrO1xuICAgIH1cbiAgfVxuXG4gIGNvbXBvbmVudFJlbW92ZWRGcm9tRW50aXR5KENvbXBvbmVudCkge1xuICAgIHRoaXMubnVtQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0tLTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY29tcG9uZW50cyBwb29sXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgVHlwZSBvZiBjb21wb25lbnQgdHlwZSBmb3IgdGhlIHBvb2xcbiAgICovXG4gIGdldENvbXBvbmVudHNQb29sKENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnROYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG5cbiAgICBpZiAoIXRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0pIHtcbiAgICAgIGlmIChDb21wb25lbnQucHJvdG90eXBlLnJlc2V0KSB7XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0gPSBuZXcgT2JqZWN0UG9vbChDb21wb25lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBDb21wb25lbnQgJyR7Q29tcG9uZW50Lm5hbWV9JyB3b24ndCBiZW5lZml0IGZyb20gcG9vbGluZyBiZWNhdXNlICdyZXNldCcgbWV0aG9kIHdhcyBub3QgaW1wbGVtZW5ldGVkLmBcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXSA9IG5ldyBEdW1teU9iamVjdFBvb2woQ29tcG9uZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgU3lzdGVtTWFuYWdlciB9IGZyb20gXCIuL1N5c3RlbU1hbmFnZXIuanNcIjtcbmltcG9ydCB7IEVudGl0eU1hbmFnZXIgfSBmcm9tIFwiLi9FbnRpdHlNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBDb21wb25lbnRNYW5hZ2VyIH0gZnJvbSBcIi4vQ29tcG9uZW50TWFuYWdlci5qc1wiO1xuaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcblxuLyoqXG4gKiBAY2xhc3MgV29ybGRcbiAqL1xuZXhwb3J0IGNsYXNzIFdvcmxkIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlciA9IG5ldyBDb21wb25lbnRNYW5hZ2VyKHRoaXMpO1xuICAgIHRoaXMuZW50aXR5TWFuYWdlciA9IG5ldyBFbnRpdHlNYW5hZ2VyKHRoaXMpO1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlciA9IG5ldyBTeXN0ZW1NYW5hZ2VyKHRoaXMpO1xuXG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcblxuICAgIHRoaXMuZXZlbnRRdWV1ZXMgPSB7fTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlciA9IG5ldyBFdmVudERpc3BhdGNoZXIoKTtcblxuICAgIGlmICh0eXBlb2YgQ3VzdG9tRXZlbnQgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHZhciBldmVudCA9IG5ldyBDdXN0b21FdmVudChcImVjc3ktd29ybGQtY3JlYXRlZFwiLCB7IGRldGFpbDogdGhpcyB9KTtcbiAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgICB9XG4gIH1cblxuICBlbWl0RXZlbnQoZXZlbnROYW1lLCBkYXRhKSB7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChldmVudE5hbWUsIGRhdGEpO1xuICB9XG5cbiAgYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICAgKi9cbiAgcmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5yZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgc3lzdGVtXG4gICAqIEBwYXJhbSB7U3lzdGVtfSBTeXN0ZW1cbiAgICovXG4gIHJlZ2lzdGVyU3lzdGVtKFN5c3RlbSwgYXR0cmlidXRlcykge1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlci5yZWdpc3RlclN5c3RlbShTeXN0ZW0sIGF0dHJpYnV0ZXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgc3lzdGVtcyBwZXIgZnJhbWVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbHRhIERlbHRhIHRpbWUgc2luY2UgdGhlIGxhc3QgY2FsbFxuICAgKiBAcGFyYW0ge051bWJlcn0gdGltZSBFbGFwc2VkIHRpbWVcbiAgICovXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUpIHtcbiAgICBpZiAodGhpcy5lbmFibGVkKSB7XG4gICAgICB0aGlzLnN5c3RlbU1hbmFnZXIuZXhlY3V0ZShkZWx0YSwgdGltZSk7XG4gICAgICB0aGlzLmVudGl0eU1hbmFnZXIucHJvY2Vzc0RlZmVycmVkUmVtb3ZhbCgpO1xuICAgIH1cbiAgfVxuXG4gIHN0b3AoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG4gIH1cblxuICBwbGF5KCkge1xuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGVudGl0eVxuICAgKi9cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLmVudGl0eU1hbmFnZXIuY3JlYXRlRW50aXR5KCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHNvbWUgc3RhdHNcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIGVudGl0aWVzOiB0aGlzLmVudGl0eU1hbmFnZXIuc3RhdHMoKSxcbiAgICAgIHN5c3RlbTogdGhpcy5zeXN0ZW1NYW5hZ2VyLnN0YXRzKClcbiAgICB9O1xuXG4gICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoc3RhdHMsIG51bGwsIDIpKTtcbiAgfVxufVxuIiwiLyoqXG4gKiBAY2xhc3MgU3lzdGVtXG4gKi9cbmltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgU3lzdGVtIHtcbiAgY2FuRXhlY3V0ZSgpIHtcbiAgICBpZiAodGhpcy5fbWFuZGF0b3J5UXVlcmllcy5sZW5ndGggPT09IDApIHJldHVybiB0cnVlO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzW2ldO1xuICAgICAgaWYgKHF1ZXJ5LmVudGl0aWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcih3b3JsZCwgYXR0cmlidXRlcykge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgLy8gQHRvZG8gQmV0dGVyIG5hbWluZyA6KVxuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgICB0aGlzLnF1ZXJpZXMgPSB7fTtcblxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHRoaXMuZXZlbnRzID0ge307XG5cbiAgICB0aGlzLnByaW9yaXR5ID0gMDtcblxuICAgIC8vIFVzZWQgZm9yIHN0YXRzXG4gICAgdGhpcy5leGVjdXRlVGltZSA9IDA7XG5cbiAgICBpZiAoYXR0cmlidXRlcyAmJiBhdHRyaWJ1dGVzLnByaW9yaXR5KSB7XG4gICAgICB0aGlzLnByaW9yaXR5ID0gYXR0cmlidXRlcy5wcmlvcml0eTtcbiAgICB9XG5cbiAgICB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzID0gW107XG5cbiAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcblxuICAgIHRoaXMuY29uZmlnID0gdGhpcy5pbml0ID8gdGhpcy5pbml0KCkgOiBudWxsO1xuXG4gICAgaWYgKCF0aGlzLmNvbmZpZykgcmV0dXJuO1xuICAgIGlmICh0aGlzLmNvbmZpZy5xdWVyaWVzKSB7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuY29uZmlnLnF1ZXJpZXMpIHtcbiAgICAgICAgdmFyIHF1ZXJ5Q29uZmlnID0gdGhpcy5jb25maWcucXVlcmllc1tuYW1lXTtcbiAgICAgICAgdmFyIENvbXBvbmVudHMgPSBxdWVyeUNvbmZpZy5jb21wb25lbnRzO1xuICAgICAgICBpZiAoIUNvbXBvbmVudHMgfHwgQ29tcG9uZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCInY29tcG9uZW50cycgYXR0cmlidXRlIGNhbid0IGJlIGVtcHR5IGluIGEgcXVlcnlcIik7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy53b3JsZC5lbnRpdHlNYW5hZ2VyLnF1ZXJ5Q29tcG9uZW50cyhDb21wb25lbnRzKTtcbiAgICAgICAgdGhpcy5fcXVlcmllc1tuYW1lXSA9IHF1ZXJ5O1xuICAgICAgICBpZiAocXVlcnlDb25maWcubWFuZGF0b3J5ID09PSB0cnVlKSB7XG4gICAgICAgICAgdGhpcy5fbWFuZGF0b3J5UXVlcmllcy5wdXNoKHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0gPSBxdWVyeS5lbnRpdGllcztcblxuICAgICAgICBpZiAocXVlcnlDb25maWcuZXZlbnRzKSB7XG4gICAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0gPSB7fTtcbiAgICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV07XG4gICAgICAgICAgZm9yIChsZXQgZXZlbnROYW1lIGluIHF1ZXJ5Q29uZmlnLmV2ZW50cykge1xuICAgICAgICAgICAgbGV0IGV2ZW50ID0gcXVlcnlDb25maWcuZXZlbnRzW2V2ZW50TmFtZV07XG4gICAgICAgICAgICBldmVudHNbZXZlbnROYW1lXSA9IFtdO1xuXG4gICAgICAgICAgICBjb25zdCBldmVudE1hcHBpbmcgPSB7XG4gICAgICAgICAgICAgIEVudGl0eUFkZGVkOiBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVELFxuICAgICAgICAgICAgICBFbnRpdHlSZW1vdmVkOiBRdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQsXG4gICAgICAgICAgICAgIEVudGl0eUNoYW5nZWQ6IFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCAvLyBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0NIQU5HRURcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChldmVudE1hcHBpbmdbZXZlbnQuZXZlbnRdKSB7XG4gICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgIGV2ZW50TWFwcGluZ1tldmVudC5ldmVudF0sXG4gICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgIC8vIEBmaXhtZSBBIGxvdCBvZiBvdmVyaGVhZD9cbiAgICAgICAgICAgICAgICAgIGlmIChldmVudHNbZXZlbnROYW1lXS5pbmRleE9mKGVudGl0eSkgPT09IC0xKVxuICAgICAgICAgICAgICAgICAgICBldmVudHNbZXZlbnROYW1lXS5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBpZiAoZXZlbnQuZXZlbnQgPT09IFwiRW50aXR5Q2hhbmdlZFwiKSB7XG4gICAgICAgICAgICAgICAgcXVlcnkucmVhY3RpdmUgPSB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmV2ZW50ID09PSBcIkNvbXBvbmVudENoYW5nZWRcIikge1xuICAgICAgICAgICAgICBxdWVyeS5yZWFjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAoZW50aXR5LCBjb21wb25lbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChldmVudC5jb21wb25lbnRzLmluZGV4T2YoY29tcG9uZW50LmNvbnN0cnVjdG9yKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0ucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb25maWcuZXZlbnRzKSB7XG4gICAgICBmb3IgKGxldCBuYW1lIGluIHRoaXMuY29uZmlnLmV2ZW50cykge1xuICAgICAgICB2YXIgZXZlbnQgPSB0aGlzLmNvbmZpZy5ldmVudHNbbmFtZV07XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0gW107XG4gICAgICAgIHRoaXMud29ybGQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgZGF0YSA9PiB7XG4gICAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0ucHVzaChkYXRhKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHBsYXkoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgfVxuXG4gIGNsZWFyRXZlbnRzKCkge1xuICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5ldmVudHMpIHtcbiAgICAgIHZhciBldmVudCA9IHRoaXMuZXZlbnRzW25hbWVdO1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdLmxlbmd0aCA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKG5hbWUgaW4gZXZlbnQpIHtcbiAgICAgICAgICBldmVudFtuYW1lXS5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdG9KU09OKCkge1xuICAgIHZhciBqc29uID0ge1xuICAgICAgbmFtZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgZW5hYmxlZDogdGhpcy5lbmFibGVkLFxuICAgICAgZXhlY3V0ZVRpbWU6IHRoaXMuZXhlY3V0ZVRpbWUsXG4gICAgICBwcmlvcml0eTogdGhpcy5wcmlvcml0eSxcbiAgICAgIHF1ZXJpZXM6IHt9LFxuICAgICAgZXZlbnRzOiB7fVxuICAgIH07XG5cbiAgICBpZiAodGhpcy5jb25maWcpIHtcbiAgICAgIHZhciBxdWVyaWVzID0gdGhpcy5jb25maWcucXVlcmllcztcbiAgICAgIGZvciAobGV0IHF1ZXJ5TmFtZSBpbiBxdWVyaWVzKSB7XG4gICAgICAgIGxldCBxdWVyeSA9IHF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAganNvbi5xdWVyaWVzW3F1ZXJ5TmFtZV0gPSB7XG4gICAgICAgICAga2V5OiB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV0ua2V5XG4gICAgICAgIH07XG4gICAgICAgIGlmIChxdWVyeS5ldmVudHMpIHtcbiAgICAgICAgICBsZXQgZXZlbnRzID0gKGpzb24ucXVlcmllc1txdWVyeU5hbWVdW1wiZXZlbnRzXCJdID0ge30pO1xuICAgICAgICAgIGZvciAobGV0IGV2ZW50TmFtZSBpbiBxdWVyeS5ldmVudHMpIHtcbiAgICAgICAgICAgIGxldCBldmVudCA9IHF1ZXJ5LmV2ZW50c1tldmVudE5hbWVdO1xuICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0gPSB7XG4gICAgICAgICAgICAgIGV2ZW50TmFtZTogZXZlbnQuZXZlbnQsXG4gICAgICAgICAgICAgIG51bUVudGl0aWVzOiB0aGlzLmV2ZW50c1txdWVyeU5hbWVdW2V2ZW50TmFtZV0ubGVuZ3RoXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGV2ZW50LmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0uY29tcG9uZW50cyA9IGV2ZW50LmNvbXBvbmVudHMubWFwKGMgPT4gYy5uYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbGV0IGV2ZW50cyA9IHRoaXMuY29uZmlnLmV2ZW50cztcbiAgICAgIGZvciAobGV0IGV2ZW50TmFtZSBpbiBldmVudHMpIHtcbiAgICAgICAganNvbi5ldmVudHNbZXZlbnROYW1lXSA9IHtcbiAgICAgICAgICBldmVudE5hbWU6IGV2ZW50c1tldmVudE5hbWVdXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGpzb247XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIE5vdChDb21wb25lbnQpIHtcbiAgcmV0dXJuIHtcbiAgICBvcGVyYXRvcjogXCJub3RcIixcbiAgICBDb21wb25lbnQ6IENvbXBvbmVudFxuICB9O1xufVxuIiwiZXhwb3J0IGNsYXNzIENvbXBvbmVudCB7fVxuIiwiZXhwb3J0IGNsYXNzIFRhZ0NvbXBvbmVudCB7XG4gIHJlc2V0KCkge31cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUeXBlKHR5cGVEZWZpbml0aW9uKSB7XG4gIHZhciBtYW5kYXRvcnlGdW5jdGlvbnMgPSBbXG4gICAgXCJjcmVhdGVcIixcbiAgICBcInJlc2V0XCIsXG4gICAgXCJjbGVhclwiXG4gICAgLypcImNvcHlcIiovXG4gIF07XG5cbiAgdmFyIHVuZGVmaW5lZEZ1bmN0aW9ucyA9IG1hbmRhdG9yeUZ1bmN0aW9ucy5maWx0ZXIoZiA9PiB7XG4gICAgcmV0dXJuICF0eXBlRGVmaW5pdGlvbltmXTtcbiAgfSk7XG5cbiAgaWYgKHVuZGVmaW5lZEZ1bmN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYGNyZWF0ZVR5cGUgZXhwZWN0IHR5cGUgZGVmaW5pdGlvbiB0byBpbXBsZW1lbnRzIHRoZSBmb2xsb3dpbmcgZnVuY3Rpb25zOiAke3VuZGVmaW5lZEZ1bmN0aW9ucy5qb2luKFxuICAgICAgICBcIiwgXCJcbiAgICAgICl9YFxuICAgICk7XG4gIH1cblxuICB0eXBlRGVmaW5pdGlvbi5pc1R5cGUgPSB0cnVlO1xuICByZXR1cm4gdHlwZURlZmluaXRpb247XG59XG4iLCJpbXBvcnQgeyBjcmVhdGVUeXBlIH0gZnJvbSBcIi4vQ3JlYXRlVHlwZVwiO1xudmFyIFR5cGVzID0ge307XG5cblR5cGVzLk51bWJlciA9IGNyZWF0ZVR5cGUoe1xuICBiYXNlVHlwZTogTnVtYmVyLFxuICBpc1NpbXBsZVR5cGU6IHRydWUsXG4gIGNyZWF0ZTogZGVmYXVsdFZhbHVlID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIGRlZmF1bHRWYWx1ZSAhPT0gXCJ1bmRlZmluZWRcIiA/IGRlZmF1bHRWYWx1ZSA6IDA7XG4gIH0sXG4gIHJlc2V0OiAoc3JjLCBrZXksIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICBzcmNba2V5XSA9IGRlZmF1bHRWYWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3JjW2tleV0gPSAwO1xuICAgIH1cbiAgfSxcbiAgY2xlYXI6IChzcmMsIGtleSkgPT4ge1xuICAgIHNyY1trZXldID0gMDtcbiAgfVxufSk7XG5cblR5cGVzLkJvb2xlYW4gPSBjcmVhdGVUeXBlKHtcbiAgYmFzZVR5cGU6IEJvb2xlYW4sXG4gIGlzU2ltcGxlVHlwZTogdHJ1ZSxcbiAgY3JlYXRlOiBkZWZhdWx0VmFsdWUgPT4ge1xuICAgIHJldHVybiB0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiID8gZGVmYXVsdFZhbHVlIDogZmFsc2U7XG4gIH0sXG4gIHJlc2V0OiAoc3JjLCBrZXksIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICBzcmNba2V5XSA9IGRlZmF1bHRWYWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3JjW2tleV0gPSBmYWxzZTtcbiAgICB9XG4gIH0sXG4gIGNsZWFyOiAoc3JjLCBrZXkpID0+IHtcbiAgICBzcmNba2V5XSA9IGZhbHNlO1xuICB9XG59KTtcblxuVHlwZXMuU3RyaW5nID0gY3JlYXRlVHlwZSh7XG4gIGJhc2VUeXBlOiBTdHJpbmcsXG4gIGlzU2ltcGxlVHlwZTogdHJ1ZSxcbiAgY3JlYXRlOiBkZWZhdWx0VmFsdWUgPT4ge1xuICAgIHJldHVybiB0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiID8gZGVmYXVsdFZhbHVlIDogXCJcIjtcbiAgfSxcbiAgcmVzZXQ6IChzcmMsIGtleSwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkZWZhdWx0VmFsdWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHNyY1trZXldID0gZGVmYXVsdFZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBzcmNba2V5XSA9IFwiXCI7XG4gICAgfVxuICB9LFxuICBjbGVhcjogKHNyYywga2V5KSA9PiB7XG4gICAgc3JjW2tleV0gPSBcIlwiO1xuICB9XG59KTtcblxuVHlwZXMuQXJyYXkgPSBjcmVhdGVUeXBlKHtcbiAgYmFzZVR5cGU6IEFycmF5LFxuICBjcmVhdGU6IGRlZmF1bHRWYWx1ZSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkZWZhdWx0VmFsdWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHJldHVybiBkZWZhdWx0VmFsdWUuc2xpY2UoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gW107XG4gIH0sXG4gIHJlc2V0OiAoc3JjLCBrZXksIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICBzcmNba2V5XSA9IGRlZmF1bHRWYWx1ZS5zbGljZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzcmNba2V5XS5sZW5ndGggPSAwO1xuICAgIH1cbiAgfSxcbiAgY2xlYXI6IChzcmMsIGtleSkgPT4ge1xuICAgIHNyY1trZXldLmxlbmd0aCA9IDA7XG4gIH0sXG4gIGNvcHk6IChzcmMsIGRzdCwga2V5KSA9PiB7XG4gICAgc3JjW2tleV0gPSBkc3Rba2V5XS5zbGljZSgpO1xuICB9XG59KTtcblxuZXhwb3J0IHsgVHlwZXMgfTtcbiIsImltcG9ydCB7IFR5cGVzIH0gZnJvbSBcIi4vU3RhbmRhcmRUeXBlc1wiO1xuXG4vKipcbiAqIFRyeSB0byBpbmZlciB0aGUgdHlwZSBvZiB0aGUgdmFsdWVcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEByZXR1cm4ge1N0cmluZ30gVHlwZSBvZiB0aGUgYXR0cmlidXRlXG4gKi9cbnZhciBzdGFuZGFyZFR5cGVzID0ge1xuICBudW1iZXI6IFR5cGVzLk51bWJlcixcbiAgYm9vbGVhbjogVHlwZXMuQm9vbGVhbixcbiAgc3RyaW5nOiBUeXBlcy5TdHJpbmdcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmZlclR5cGUodmFsdWUpIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIFR5cGVzLkFycmF5O1xuICB9XG5cbiAgaWYgKHN0YW5kYXJkVHlwZXNbdHlwZW9mIHZhbHVlXSkge1xuICAgIHJldHVybiBzdGFuZGFyZFR5cGVzW3R5cGVvZiB2YWx1ZV07XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiIsImltcG9ydCB7IGluZmVyVHlwZSB9IGZyb20gXCIuL0luZmVyVHlwZVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50KHNjaGVtYSwgbmFtZSkge1xuICAvL3ZhciBDb21wb25lbnQgPSBuZXcgRnVuY3Rpb24oYHJldHVybiBmdW5jdGlvbiAke25hbWV9KCkge31gKSgpO1xuICBmb3IgKGxldCBrZXkgaW4gc2NoZW1hKSB7XG4gICAgbGV0IHR5cGUgPSBzY2hlbWFba2V5XS50eXBlO1xuICAgIGlmICghdHlwZSkge1xuICAgICAgc2NoZW1hW2tleV0udHlwZSA9IGluZmVyVHlwZShzY2hlbWFba2V5XS5kZWZhdWx0KTtcbiAgICB9XG4gIH1cblxuICB2YXIgQ29tcG9uZW50ID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgICAgdmFyIGF0dHIgPSBzY2hlbWFba2V5XTtcbiAgICAgIGxldCB0eXBlID0gYXR0ci50eXBlO1xuICAgICAgaWYgKHR5cGUgJiYgdHlwZS5pc1R5cGUpIHtcbiAgICAgICAgdGhpc1trZXldID0gdHlwZS5jcmVhdGUoYXR0ci5kZWZhdWx0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXNba2V5XSA9IGF0dHIuZGVmYXVsdDtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgaWYgKHR5cGVvZiBuYW1lICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbXBvbmVudCwgXCJuYW1lXCIsIHsgdmFsdWU6IG5hbWUgfSk7XG4gIH1cblxuICBDb21wb25lbnQucHJvdG90eXBlLnNjaGVtYSA9IHNjaGVtYTtcblxuICB2YXIga25vd25UeXBlcyA9IHRydWU7XG4gIGZvciAobGV0IGtleSBpbiBzY2hlbWEpIHtcbiAgICB2YXIgYXR0ciA9IHNjaGVtYVtrZXldO1xuICAgIGlmICghYXR0ci50eXBlKSB7XG4gICAgICBhdHRyLnR5cGUgPSBpbmZlclR5cGUoYXR0ci5kZWZhdWx0KTtcbiAgICB9XG5cbiAgICB2YXIgdHlwZSA9IGF0dHIudHlwZTtcbiAgICBpZiAoIXR5cGUpIHtcbiAgICAgIGNvbnNvbGUud2FybihgVW5rbm93biB0eXBlIGRlZmluaXRpb24gZm9yIGF0dHJpYnV0ZSAnJHtrZXl9J2ApO1xuICAgICAga25vd25UeXBlcyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGlmICgha25vd25UeXBlcykge1xuICAgIGNvbnNvbGUud2FybihcbiAgICAgIGBUaGlzIGNvbXBvbmVudCBjYW4ndCB1c2UgcG9vbGluZyBiZWNhdXNlIHNvbWUgZGF0YSB0eXBlcyBhcmUgbm90IHJlZ2lzdGVyZWQuIFBsZWFzZSBwcm92aWRlIGEgdHlwZSBjcmVhdGVkIHdpdGggJ2NyZWF0ZVR5cGUnYFxuICAgICk7XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gc2NoZW1hKSB7XG4gICAgICBsZXQgYXR0ciA9IHNjaGVtYVtrZXldO1xuICAgICAgQ29tcG9uZW50LnByb3RvdHlwZVtrZXldID0gYXR0ci5kZWZhdWx0O1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBDb21wb25lbnQucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbihzcmMpIHtcbiAgICAgIGZvciAobGV0IGtleSBpbiBzY2hlbWEpIHtcbiAgICAgICAgbGV0IHR5cGUgPSBzY2hlbWFba2V5XS50eXBlO1xuICAgICAgICBpZiAodHlwZS5pc1NpbXBsZVR5cGUpIHtcbiAgICAgICAgICB0aGlzW2tleV0gPSBzcmNba2V5XTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlLmNvcHkpIHtcbiAgICAgICAgICB0eXBlLmNvcHkodGhpcywgc3JjLCBrZXkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEB0b2RvIERldGVjdCB0aGF0IGl0J3Mgbm90IHBvc3NpYmxlIHRvIGNvcHkgYWxsIHRoZSBhdHRyaWJ1dGVzXG4gICAgICAgICAgLy8gYW5kIGp1c3QgYXZvaWQgY3JlYXRpbmcgdGhlIGNvcHkgZnVuY3Rpb25cbiAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICBgVW5rbm93biBjb3B5IGZ1bmN0aW9uIGZvciBhdHRyaWJ1dGUgJyR7a2V5fScgZGF0YSB0eXBlYFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgICAgICBsZXQgYXR0ciA9IHNjaGVtYVtrZXldO1xuICAgICAgICBsZXQgdHlwZSA9IGF0dHIudHlwZTtcbiAgICAgICAgaWYgKHR5cGUucmVzZXQpIHR5cGUucmVzZXQodGhpcywga2V5LCBhdHRyLmRlZmF1bHQpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBDb21wb25lbnQucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKGxldCBrZXkgaW4gc2NoZW1hKSB7XG4gICAgICAgIGxldCB0eXBlID0gc2NoZW1hW2tleV0udHlwZTtcbiAgICAgICAgaWYgKHR5cGUuY2xlYXIpIHR5cGUuY2xlYXIodGhpcywga2V5KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgICAgbGV0IGF0dHIgPSBzY2hlbWFba2V5XTtcbiAgICAgIGxldCB0eXBlID0gYXR0ci50eXBlO1xuICAgICAgQ29tcG9uZW50LnByb3RvdHlwZVtrZXldID0gYXR0ci5kZWZhdWx0O1xuXG4gICAgICBpZiAodHlwZS5yZXNldCkge1xuICAgICAgICB0eXBlLnJlc2V0KENvbXBvbmVudC5wcm90b3R5cGUsIGtleSwgYXR0ci5kZWZhdWx0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gQ29tcG9uZW50O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0NBQUE7Q0FDQTtDQUNBO0FBQ0EsQ0FBTyxNQUFNLGFBQWEsQ0FBQztDQUMzQixFQUFFLFdBQVcsQ0FBQyxLQUFLLEVBQUU7Q0FDckIsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztDQUN0QixJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0NBQ3ZCLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFO0NBQ3JDLElBQUksSUFBSSxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztDQUNwRCxJQUFJLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7Q0FDdkMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUM5QixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztDQUN2QixJQUFJLE9BQU8sSUFBSSxDQUFDO0NBQ2hCLEdBQUc7O0NBRUgsRUFBRSxXQUFXLEdBQUc7Q0FDaEIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUs7Q0FDaEMsTUFBTSxPQUFPLENBQUMsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7Q0FDMUQsS0FBSyxDQUFDLENBQUM7Q0FDUCxHQUFHOztDQUVIO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxZQUFZLENBQUMsTUFBTSxFQUFFO0NBQ3ZCLElBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7Q0FDN0MsSUFBSSxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsT0FBTzs7Q0FFeEIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7Q0FDbEMsR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRTtDQUN2QixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSTtDQUNuQyxNQUFNLElBQUksTUFBTSxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsV0FBVyxFQUFFO0NBQ2hELFFBQVEsSUFBSSxNQUFNLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsRUFBRTtDQUNuRCxVQUFVLElBQUksU0FBUyxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztDQUM1QyxVQUFVLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0NBQ3RDLFVBQVUsTUFBTSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLEdBQUcsU0FBUyxDQUFDO0NBQzdELFNBQVM7Q0FDVCxRQUFRLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQztDQUM3QixPQUFPO0NBQ1AsS0FBSyxDQUFDLENBQUM7Q0FDUCxHQUFHOztDQUVIO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsS0FBSyxHQUFHO0NBQ1YsSUFBSSxJQUFJLEtBQUssR0FBRztDQUNoQixNQUFNLFVBQVUsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU07Q0FDckMsTUFBTSxPQUFPLEVBQUUsRUFBRTtDQUNqQixLQUFLLENBQUM7O0NBRU4sSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Q0FDbEQsTUFBTSxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ25DLE1BQU0sSUFBSSxXQUFXLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHO0NBQ2xFLFFBQVEsT0FBTyxFQUFFLEVBQUU7Q0FDbkIsT0FBTyxDQUFDLENBQUM7Q0FDVCxNQUFNLEtBQUssSUFBSSxJQUFJLElBQUksTUFBTSxDQUFDLEdBQUcsRUFBRTtDQUNuQyxRQUFRLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztDQUM3RCxPQUFPO0NBQ1AsS0FBSzs7Q0FFTCxJQUFJLE9BQU8sS0FBSyxDQUFDO0NBQ2pCLEdBQUc7Q0FDSCxDQUFDOztDQzdFRDtDQUNBO0NBQ0E7QUFDQSxDQUFlLE1BQU0sZUFBZSxDQUFDO0NBQ3JDLEVBQUUsV0FBVyxHQUFHO0NBQ2hCLElBQUksSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7Q0FDekIsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHO0NBQ2pCLE1BQU0sS0FBSyxFQUFFLENBQUM7Q0FDZCxNQUFNLE9BQU8sRUFBRSxDQUFDO0NBQ2hCLEtBQUssQ0FBQztDQUNOLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRTtDQUN4QyxJQUFJLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7Q0FDcEMsSUFBSSxJQUFJLFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxTQUFTLEVBQUU7Q0FDNUMsTUFBTSxTQUFTLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO0NBQ2hDLEtBQUs7O0NBRUwsSUFBSSxJQUFJLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7Q0FDdkQsTUFBTSxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0NBQzFDLEtBQUs7Q0FDTCxHQUFHOztDQUVIO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUU7Q0FDeEMsSUFBSTtDQUNKLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsS0FBSyxTQUFTO0NBQzlDLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0NBQ3pELE1BQU07Q0FDTixHQUFHOztDQUVIO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUU7Q0FDM0MsSUFBSSxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0NBQ25ELElBQUksSUFBSSxhQUFhLEtBQUssU0FBUyxFQUFFO0NBQ3JDLE1BQU0sSUFBSSxLQUFLLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztDQUNsRCxNQUFNLElBQUksS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFO0NBQ3hCLFFBQVEsYUFBYSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7Q0FDdkMsT0FBTztDQUNQLEtBQUs7Q0FDTCxHQUFHOztDQUVIO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsYUFBYSxDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFO0NBQzlDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQzs7Q0FFdkIsSUFBSSxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0NBQ25ELElBQUksSUFBSSxhQUFhLEtBQUssU0FBUyxFQUFFO0NBQ3JDLE1BQU0sSUFBSSxLQUFLLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzs7Q0FFekMsTUFBTSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtDQUM3QyxRQUFRLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztDQUMvQyxPQUFPO0NBQ1AsS0FBSztDQUNMLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxhQUFhLEdBQUc7Q0FDbEIsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7Q0FDOUMsR0FBRztDQUNILENBQUM7O0NDaEZEO0NBQ0E7Q0FDQTtDQUNBO0FBQ0EsQ0FBTyxTQUFTLE9BQU8sQ0FBQyxTQUFTLEVBQUU7Q0FDbkMsRUFBRSxPQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUM7Q0FDeEIsQ0FBQzs7Q0FFRDtDQUNBO0NBQ0E7Q0FDQTtBQUNBLENBQU8sU0FBUyxxQkFBcUIsQ0FBQyxTQUFTLEVBQUU7Q0FDakQsRUFBRSxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7Q0FDaEMsRUFBRSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN0RCxDQUFDOztDQUVEO0NBQ0E7Q0FDQTtDQUNBO0FBQ0EsQ0FBTyxTQUFTLFFBQVEsQ0FBQyxVQUFVLEVBQUU7Q0FDckMsRUFBRSxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUM7Q0FDakIsRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtDQUM5QyxJQUFJLElBQUksQ0FBQyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMxQixJQUFJLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxFQUFFO0NBQy9CLE1BQU0sSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDLFFBQVEsS0FBSyxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUM7Q0FDN0QsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Q0FDbEQsS0FBSyxNQUFNO0NBQ1gsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzdCLEtBQUs7Q0FDTCxHQUFHOztDQUVILEVBQUUsT0FBTyxLQUFLO0NBQ2QsS0FBSyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUU7Q0FDckIsTUFBTSxPQUFPLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztDQUM3QixLQUFLLENBQUM7Q0FDTixLQUFLLElBQUksRUFBRTtDQUNYLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQ2YsQ0FBQzs7Q0NwQ0Q7Q0FDQTtDQUNBO0FBQ0EsQ0FBZSxNQUFNLEtBQUssQ0FBQztDQUMzQjtDQUNBO0NBQ0E7Q0FDQSxFQUFFLFdBQVcsQ0FBQyxVQUFVLEVBQUUsT0FBTyxFQUFFO0NBQ25DLElBQUksSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7Q0FDekIsSUFBSSxJQUFJLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQzs7Q0FFNUIsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLFNBQVMsSUFBSTtDQUNwQyxNQUFNLElBQUksT0FBTyxTQUFTLEtBQUssUUFBUSxFQUFFO0NBQ3pDLFFBQVEsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0NBQ3JELE9BQU8sTUFBTTtDQUNiLFFBQVEsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Q0FDeEMsT0FBTztDQUNQLEtBQUssQ0FBQyxDQUFDOztDQUVQLElBQUksSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7Q0FDdEMsTUFBTSxNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7Q0FDakUsS0FBSzs7Q0FFTCxJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDOztDQUV2QixJQUFJLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQzs7Q0FFakQ7Q0FDQSxJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDOztDQUUxQixJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDOztDQUVwQztDQUNBLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0NBQ3ZELE1BQU0sSUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN4QyxNQUFNLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRTtDQUM5QjtDQUNBLFFBQVEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDbEMsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUNuQyxPQUFPO0NBQ1AsS0FBSztDQUNMLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLFNBQVMsQ0FBQyxNQUFNLEVBQUU7Q0FDcEIsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUM5QixJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDOztDQUUvQixJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0NBQzdFLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLFlBQVksQ0FBQyxNQUFNLEVBQUU7Q0FDdkIsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUM5QyxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7Q0FDaEIsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7O0NBRXJDLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQzNDLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDOztDQUV0QyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYTtDQUN4QyxRQUFRLEtBQUssQ0FBQyxTQUFTLENBQUMsY0FBYztDQUN0QyxRQUFRLE1BQU07Q0FDZCxPQUFPLENBQUM7Q0FDUixLQUFLO0NBQ0wsR0FBRzs7Q0FFSCxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsY0FBYyxHQUFHLEtBQUssRUFBRTtDQUN4QyxJQUFJO0NBQ0osTUFBTSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxjQUFjLENBQUM7Q0FDOUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLGNBQWMsQ0FBQztDQUNsRSxNQUFNO0NBQ04sR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQSxFQUFFLEtBQUssR0FBRztDQUNWLElBQUksT0FBTztDQUNYLE1BQU0sYUFBYSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTTtDQUMzQyxNQUFNLFdBQVcsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU07Q0FDdkMsS0FBSyxDQUFDO0NBQ04sR0FBRztDQUNILENBQUM7O0NBRUQsS0FBSyxDQUFDLFNBQVMsQ0FBQyxZQUFZLEdBQUcsb0JBQW9CLENBQUM7Q0FDcEQsS0FBSyxDQUFDLFNBQVMsQ0FBQyxjQUFjLEdBQUcsc0JBQXNCLENBQUM7Q0FDeEQsS0FBSyxDQUFDLFNBQVMsQ0FBQyxpQkFBaUIsR0FBRyx5QkFBeUIsQ0FBQzs7Q0MxRjlEO0NBQ0EsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDOztDQUVmO0NBQ0E7Q0FDQTtBQUNBLENBQWUsTUFBTSxNQUFNLENBQUM7Q0FDNUI7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsV0FBVyxDQUFDLEtBQUssRUFBRTtDQUNyQixJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxJQUFJLElBQUksQ0FBQzs7Q0FFaEM7Q0FDQSxJQUFJLElBQUksQ0FBQyxFQUFFLEdBQUcsTUFBTSxFQUFFLENBQUM7O0NBRXZCO0NBQ0EsSUFBSSxJQUFJLENBQUMsZUFBZSxHQUFHLEVBQUUsQ0FBQzs7Q0FFOUI7Q0FDQSxJQUFJLElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDOztDQUUxQjtDQUNBLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7O0NBRXRCO0NBQ0EsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsRUFBRSxDQUFDO0NBQ2pDLEdBQUc7O0NBRUg7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLFlBQVksQ0FBQyxTQUFTLEVBQUU7Q0FDMUIsSUFBSSxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUNyRCxJQUFJLE9BQU8sQUFBc0QsQ0FBQyxTQUFTLENBQUM7Q0FDNUUsR0FBRzs7Q0FFSCxFQUFFLGFBQWEsR0FBRztDQUNsQixJQUFJLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQztDQUM1QixHQUFHOztDQUVILEVBQUUsaUJBQWlCLEdBQUc7Q0FDdEIsSUFBSSxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUM7Q0FDaEMsR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxtQkFBbUIsQ0FBQyxTQUFTLEVBQUU7Q0FDakMsSUFBSSxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUNyRCxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtDQUNsRCxNQUFNLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDbEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUU7Q0FDMUIsUUFBUSxLQUFLLENBQUMsZUFBZSxDQUFDLGFBQWE7Q0FDM0MsVUFBVSxLQUFLLENBQUMsU0FBUyxDQUFDLGlCQUFpQjtDQUMzQyxVQUFVLElBQUk7Q0FDZCxVQUFVLFNBQVM7Q0FDbkIsU0FBUyxDQUFDO0NBQ1YsT0FBTztDQUNQLEtBQUs7Q0FDTCxJQUFJLE9BQU8sU0FBUyxDQUFDO0NBQ3JCLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsWUFBWSxDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUU7Q0FDbEMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUM7Q0FDNUQsSUFBSSxPQUFPLElBQUksQ0FBQztDQUNoQixHQUFHOztDQUVIO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxlQUFlLENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRTtDQUMxQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQztDQUNwRSxJQUFJLE9BQU8sSUFBSSxDQUFDO0NBQ2hCLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsWUFBWSxDQUFDLFNBQVMsRUFBRSxjQUFjLEdBQUcsS0FBSyxFQUFFO0NBQ2xELElBQUk7Q0FDSixNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQztDQUNoRCxPQUFPLGNBQWMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztDQUN0RSxNQUFNO0NBQ04sR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsY0FBYyxHQUFHLEtBQUssRUFBRTtDQUN2RCxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0NBQ2hELE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxFQUFFLE9BQU8sS0FBSyxDQUFDO0NBQzFFLEtBQUs7Q0FDTCxJQUFJLE9BQU8sSUFBSSxDQUFDO0NBQ2hCLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLGNBQWMsR0FBRyxLQUFLLEVBQUU7Q0FDdkQsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtDQUNoRCxNQUFNLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLEVBQUUsT0FBTyxJQUFJLENBQUM7Q0FDeEUsS0FBSztDQUNMLElBQUksT0FBTyxLQUFLLENBQUM7Q0FDakIsR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQSxFQUFFLG1CQUFtQixDQUFDLFdBQVcsRUFBRTtDQUNuQyxJQUFJLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7Q0FDcEUsR0FBRzs7Q0FFSDs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLEtBQUssR0FBRztDQUNWLElBQUksSUFBSSxDQUFDLEVBQUUsR0FBRyxNQUFNLEVBQUUsQ0FBQztDQUN2QixJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0NBQ3ZCLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0NBQ3BDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0NBQzVCLElBQUksSUFBSSxDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUM7Q0FDMUIsR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQSxFQUFFLE1BQU0sQ0FBQyxXQUFXLEVBQUU7Q0FDdEIsSUFBSSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztDQUN2RCxHQUFHO0NBQ0gsQ0FBQzs7Q0NoS0Q7Q0FDQTtDQUNBO0FBQ0EsQ0FBZSxNQUFNLFVBQVUsQ0FBQztDQUNoQztDQUNBLEVBQUUsV0FBVyxDQUFDLENBQUMsRUFBRSxXQUFXLEVBQUU7Q0FDOUIsSUFBSSxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztDQUN2QixJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0NBQ25CLElBQUksSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7O0NBRWYsSUFBSSxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUM7Q0FDekIsSUFBSSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0NBQzlCLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztDQUN4RCxNQUFNLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztDQUN4QixLQUFLOztDQUVMLElBQUksSUFBSSxDQUFDLGFBQWEsR0FBRyxTQUFTO0NBQ2xDLFFBQVEsTUFBTTtDQUNkLFVBQVUsT0FBTyxJQUFJLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0NBQ3JDLFNBQVM7Q0FDVCxRQUFRLE1BQU07Q0FDZCxVQUFVLE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQztDQUN6QixTQUFTLENBQUM7O0NBRVYsSUFBSSxJQUFJLE9BQU8sV0FBVyxLQUFLLFdBQVcsRUFBRTtDQUM1QyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7Q0FDL0IsS0FBSztDQUNMLEdBQUc7O0NBRUgsRUFBRSxNQUFNLEdBQUc7Q0FDWDtDQUNBLElBQUksSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7Q0FDbkMsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUNwRCxLQUFLOztDQUVMLElBQUksSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQzs7Q0FFbkMsSUFBSSxPQUFPLElBQUksQ0FBQztDQUNoQixHQUFHOztDQUVILEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRTtDQUNoQixJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztDQUNqQixJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQzdCLEdBQUc7O0NBRUgsRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFO0NBQ2hCLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRTtDQUNwQyxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDO0NBQy9DLEtBQUs7Q0FDTCxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDO0NBQ3hCLEdBQUc7O0NBRUgsRUFBRSxTQUFTLEdBQUc7Q0FDZCxJQUFJLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztDQUN0QixHQUFHOztDQUVILEVBQUUsU0FBUyxHQUFHO0NBQ2QsSUFBSSxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO0NBQ2hDLEdBQUc7O0NBRUgsRUFBRSxTQUFTLEdBQUc7Q0FDZCxJQUFJLE9BQU8sSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztDQUM3QyxHQUFHO0NBQ0gsQ0FBQzs7Q0M1REQ7Q0FDQTtDQUNBO0FBQ0EsQ0FBZSxNQUFNLFlBQVksQ0FBQztDQUNsQyxFQUFFLFdBQVcsQ0FBQyxLQUFLLEVBQUU7Q0FDckIsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQzs7Q0FFeEI7Q0FDQSxJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO0NBQ3ZCLEdBQUc7O0NBRUgsRUFBRSxlQUFlLENBQUMsTUFBTSxFQUFFO0NBQzFCLElBQUksS0FBSyxJQUFJLFNBQVMsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFO0NBQ3pDLE1BQU0sSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztDQUMzQyxNQUFNLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7Q0FDaEQsUUFBUSxLQUFLLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQ25DLE9BQU87Q0FDUCxLQUFLO0NBQ0wsR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFO0NBQzVDOztDQUVBO0NBQ0EsSUFBSSxLQUFLLElBQUksU0FBUyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7Q0FDekMsTUFBTSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDOztDQUUzQyxNQUFNO0NBQ04sUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7Q0FDakQsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztDQUN2QyxRQUFRO0NBQ1IsUUFBUSxLQUFLLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQ25DLFFBQVEsU0FBUztDQUNqQixPQUFPOztDQUVQO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsTUFBTTtDQUNOLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQztDQUM3QyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7Q0FDNUIsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztDQUN2QztDQUNBLFFBQVEsU0FBUzs7Q0FFakIsTUFBTSxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQzlCLEtBQUs7Q0FDTCxHQUFHOztDQUVIO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLHdCQUF3QixDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUU7Q0FDOUMsSUFBSSxLQUFLLElBQUksU0FBUyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7Q0FDekMsTUFBTSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDOztDQUUzQyxNQUFNO0NBQ04sUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7Q0FDakQsUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO0NBQ3hDLFFBQVEsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7Q0FDM0IsUUFBUTtDQUNSLFFBQVEsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUNoQyxRQUFRLFNBQVM7Q0FDakIsT0FBTzs7Q0FFUCxNQUFNO0NBQ04sUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7Q0FDOUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7Q0FDekMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO0NBQzVCLFFBQVE7Q0FDUixRQUFRLEtBQUssQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7Q0FDbkMsUUFBUSxTQUFTO0NBQ2pCLE9BQU87Q0FDUCxLQUFLO0NBQ0wsR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRTtDQUN2QixJQUFJLElBQUksR0FBRyxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztDQUNuQyxJQUFJLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDbkMsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO0NBQ2hCLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUN0RSxLQUFLO0NBQ0wsSUFBSSxPQUFPLEtBQUssQ0FBQztDQUNqQixHQUFHOztDQUVIO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsS0FBSyxHQUFHO0NBQ1YsSUFBSSxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUM7Q0FDbkIsSUFBSSxLQUFLLElBQUksU0FBUyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7Q0FDekMsTUFBTSxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztDQUMxRCxLQUFLO0NBQ0wsSUFBSSxPQUFPLEtBQUssQ0FBQztDQUNqQixHQUFHO0NBQ0gsQ0FBQzs7Q0N4R0Q7Q0FDQTtDQUNBO0FBQ0EsQ0FBTyxNQUFNLGFBQWEsQ0FBQztDQUMzQixFQUFFLFdBQVcsQ0FBQyxLQUFLLEVBQUU7Q0FDckIsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztDQUN2QixJQUFJLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxLQUFLLENBQUMsaUJBQWlCLENBQUM7O0NBRXJEO0NBQ0EsSUFBSSxJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQzs7Q0FFeEIsSUFBSSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ2hELElBQUksSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO0NBQ2pELElBQUksSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQzs7Q0FFOUM7Q0FDQSxJQUFJLElBQUksQ0FBQyw4QkFBOEIsR0FBRyxFQUFFLENBQUM7Q0FDN0MsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO0NBQy9CLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxZQUFZLEdBQUc7Q0FDakIsSUFBSSxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDO0NBQzNDLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Q0FDekIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUNoQyxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsQ0FBQztDQUMvRCxJQUFJLE9BQU8sTUFBTSxDQUFDO0NBQ2xCLEdBQUc7O0NBRUg7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRTtDQUNoRCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPOztDQUUzRCxJQUFJLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDOztDQUUzQyxJQUFJLElBQUksYUFBYSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsaUJBQWlCO0NBQ3RFLE1BQU0sU0FBUztDQUNmLEtBQUssQ0FBQztDQUNOLElBQUksSUFBSSxTQUFTLEdBQUcsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDOztDQUUzQyxJQUFJLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQzs7Q0FFbkQsSUFBSSxJQUFJLE1BQU0sRUFBRTtDQUNoQixNQUFNLElBQUksU0FBUyxDQUFDLElBQUksRUFBRTtDQUMxQixRQUFRLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Q0FDL0IsT0FBTyxNQUFNO0NBQ2IsUUFBUSxLQUFLLElBQUksSUFBSSxJQUFJLE1BQU0sRUFBRTtDQUNqQyxVQUFVLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDekMsU0FBUztDQUNULE9BQU87Q0FDUCxLQUFLOztDQUVMLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7Q0FDakUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLHNCQUFzQixDQUFDLFNBQVMsQ0FBQyxDQUFDOztDQUVuRSxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLGVBQWUsRUFBRSxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7Q0FDM0UsR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFO0NBQ3hELElBQUksSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7Q0FDMUQsSUFBSSxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsT0FBTzs7Q0FFeEIsSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7O0NBRTVFLElBQUksSUFBSSxXQUFXLEVBQUU7Q0FDckIsTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQztDQUNoRSxLQUFLLE1BQU07Q0FDWCxNQUFNLElBQUksTUFBTSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sS0FBSyxDQUFDO0NBQ2hELFFBQVEsSUFBSSxDQUFDLDhCQUE4QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUN6RCxNQUFNLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Q0FDaEQsS0FBSzs7Q0FFTDtDQUNBLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7Q0FDbkUsR0FBRzs7Q0FFSCxFQUFFLDBCQUEwQixDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFO0NBQ3ZEO0NBQ0EsSUFBSSxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7Q0FDNUMsSUFBSSxJQUFJLFFBQVEsR0FBRyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztDQUNwRCxJQUFJLElBQUksYUFBYSxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztDQUMzQyxJQUFJLElBQUksU0FBUyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7Q0FDdEQsSUFBSSxPQUFPLE1BQU0sQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7Q0FDN0MsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztDQUN2RSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsMEJBQTBCLENBQUMsU0FBUyxDQUFDLENBQUM7Q0FDdkUsR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUseUJBQXlCLENBQUMsTUFBTSxFQUFFLFdBQVcsRUFBRTtDQUNqRCxJQUFJLElBQUksVUFBVSxHQUFHLE1BQU0sQ0FBQyxlQUFlLENBQUM7O0NBRTVDLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0NBQ3JELE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7Q0FDckUsS0FBSztDQUNMLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsWUFBWSxDQUFDLE1BQU0sRUFBRSxXQUFXLEVBQUU7Q0FDcEMsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQzs7Q0FFL0MsSUFBSSxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDOztDQUV2RTtDQUNBLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0NBQy9ELElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUM7O0NBRS9DLElBQUksSUFBSSxXQUFXLEtBQUssSUFBSSxFQUFFO0NBQzlCLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztDQUM1QyxLQUFLLE1BQU07Q0FDWCxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Q0FDekMsS0FBSztDQUNMLEdBQUc7O0NBRUgsRUFBRSxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFO0NBQ25DLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDOztDQUVwQyxJQUFJLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7O0NBRWpEO0NBQ0EsSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztDQUN6QixJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQ3JDLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxpQkFBaUIsR0FBRztDQUN0QixJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Q0FDekQsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO0NBQ2pDLEtBQUs7Q0FDTCxHQUFHOztDQUVILEVBQUUsc0JBQXNCLEdBQUc7Q0FDM0IsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtDQUMzRCxNQUFNLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxNQUFNLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQ2pELE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztDQUM1QyxLQUFLO0NBQ0wsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQzs7Q0FFckMsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLDhCQUE4QixDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtDQUN6RSxNQUFNLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMxRCxNQUFNLE9BQU8sTUFBTSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Q0FDbkQsUUFBUSxJQUFJLFNBQVMsR0FBRyxNQUFNLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFFLENBQUM7Q0FDeEQsUUFBUSxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztDQUM5RCxRQUFRLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO0NBQ2xFLE9BQU87Q0FDUCxLQUFLOztDQUVMLElBQUksSUFBSSxDQUFDLDhCQUE4QixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7Q0FDbkQsR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsZUFBZSxDQUFDLFVBQVUsRUFBRTtDQUM5QixJQUFJLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7Q0FDbkQsR0FBRzs7Q0FFSDs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLEtBQUssR0FBRztDQUNWLElBQUksT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztDQUNqQyxHQUFHOztDQUVIO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsS0FBSyxHQUFHO0NBQ1YsSUFBSSxJQUFJLEtBQUssR0FBRztDQUNoQixNQUFNLFdBQVcsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU07Q0FDeEMsTUFBTSxVQUFVLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU07Q0FDakUsTUFBTSxPQUFPLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUU7Q0FDekMsTUFBTSxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLENBQUM7Q0FDMUUsU0FBUyxNQUFNO0NBQ2YsTUFBTSxhQUFhLEVBQUUsRUFBRTtDQUN2QixNQUFNLGVBQWUsRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUs7Q0FDakQsS0FBSyxDQUFDOztDQUVOLElBQUksS0FBSyxJQUFJLEtBQUssSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsY0FBYyxFQUFFO0NBQzdELE1BQU0sSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUM5RCxNQUFNLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEdBQUc7Q0FDbkMsUUFBUSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRTtDQUM5QixRQUFRLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSztDQUN4QixPQUFPLENBQUM7Q0FDUixLQUFLOztDQUVMLElBQUksT0FBTyxLQUFLLENBQUM7Q0FDakIsR0FBRztDQUNILENBQUM7O0NBRUQsTUFBTSxjQUFjLEdBQUcsNkJBQTZCLENBQUM7Q0FDckQsTUFBTSxjQUFjLEdBQUcsOEJBQThCLENBQUM7Q0FDdEQsTUFBTSxlQUFlLEdBQUcsK0JBQStCLENBQUM7Q0FDeEQsTUFBTSxnQkFBZ0IsR0FBRyxnQ0FBZ0MsQ0FBQzs7Q0NsTzFEO0NBQ0E7Q0FDQTtBQUNBLENBQWUsTUFBTSxlQUFlLENBQUM7Q0FDckMsRUFBRSxXQUFXLENBQUMsQ0FBQyxFQUFFO0NBQ2pCLElBQUksSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7Q0FDbkIsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztDQUNsQixJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQ2YsR0FBRzs7Q0FFSCxFQUFFLE1BQU0sR0FBRztDQUNYLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0NBQ2hCLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0NBQ2pCLElBQUksT0FBTyxJQUFJLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUN4QixHQUFHOztDQUVILEVBQUUsT0FBTyxHQUFHO0NBQ1osSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Q0FDaEIsR0FBRzs7Q0FFSCxFQUFFLFNBQVMsR0FBRztDQUNkLElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDO0NBQ3RCLEdBQUc7O0NBRUgsRUFBRSxTQUFTLEdBQUc7Q0FDZCxJQUFJLE9BQU8sUUFBUSxDQUFDO0NBQ3BCLEdBQUc7O0NBRUgsRUFBRSxTQUFTLEdBQUc7Q0FDZCxJQUFJLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztDQUNyQixHQUFHO0NBQ0gsQ0FBQzs7Q0MzQkQ7Q0FDQTtDQUNBO0FBQ0EsQ0FBTyxNQUFNLGdCQUFnQixDQUFDO0NBQzlCLEVBQUUsV0FBVyxHQUFHO0NBQ2hCLElBQUksSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7Q0FDekIsSUFBSSxJQUFJLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztDQUM3QixJQUFJLElBQUksQ0FBQyxhQUFhLEdBQUcsRUFBRSxDQUFDO0NBQzVCLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLGlCQUFpQixDQUFDLFNBQVMsRUFBRTtDQUMvQixJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQztDQUNoRCxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUMzQyxHQUFHOztDQUVILEVBQUUsc0JBQXNCLENBQUMsU0FBUyxFQUFFO0NBQ3BDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFO0NBQzdDLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQzdDLEtBQUssTUFBTTtDQUNYLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztDQUMzQyxLQUFLO0NBQ0wsR0FBRzs7Q0FFSCxFQUFFLDBCQUEwQixDQUFDLFNBQVMsRUFBRTtDQUN4QyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Q0FDekMsR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsaUJBQWlCLENBQUMsU0FBUyxFQUFFO0NBQy9CLElBQUksSUFBSSxhQUFhLEdBQUcscUJBQXFCLENBQUMsU0FBUyxDQUFDLENBQUM7O0NBRXpELElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLEVBQUU7Q0FDN0MsTUFBTSxJQUFJLFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFO0NBQ3JDLFFBQVEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztDQUN2RSxPQUFPLE1BQU07Q0FDYixRQUFRLE9BQU8sQ0FBQyxJQUFJO0NBQ3BCLFVBQVUsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyx5RUFBeUUsQ0FBQztDQUNqSCxTQUFTLENBQUM7Q0FDVixRQUFRLElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLEdBQUcsSUFBSSxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUM7Q0FDNUUsT0FBTztDQUNQLEtBQUs7O0NBRUwsSUFBSSxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUM7Q0FDOUMsR0FBRztDQUNILENBQUM7O0NDbEREO0NBQ0E7Q0FDQTtBQUNBLENBQU8sTUFBTSxLQUFLLENBQUM7Q0FDbkIsRUFBRSxXQUFXLEdBQUc7Q0FDaEIsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUN4RCxJQUFJLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDakQsSUFBSSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDOztDQUVqRCxJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDOztDQUV4QixJQUFJLElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO0NBQzFCLElBQUksSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDOztDQUVqRCxJQUFJLElBQUksT0FBTyxXQUFXLEtBQUssV0FBVyxFQUFFO0NBQzVDLE1BQU0sSUFBSSxLQUFLLEdBQUcsSUFBSSxXQUFXLENBQUMsb0JBQW9CLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztDQUMxRSxNQUFNLE1BQU0sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDbEMsS0FBSztDQUNMLEdBQUc7O0NBRUgsRUFBRSxTQUFTLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRTtDQUM3QixJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztDQUN4RCxHQUFHOztDQUVILEVBQUUsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRTtDQUN4QyxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0NBQy9ELEdBQUc7O0NBRUgsRUFBRSxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFO0NBQzNDLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7Q0FDbEUsR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsaUJBQWlCLENBQUMsU0FBUyxFQUFFO0NBQy9CLElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0NBQ3hELElBQUksT0FBTyxJQUFJLENBQUM7Q0FDaEIsR0FBRzs7Q0FFSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsY0FBYyxDQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUU7Q0FDckMsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7Q0FDMUQsSUFBSSxPQUFPLElBQUksQ0FBQztDQUNoQixHQUFHOztDQUVIO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFO0NBQ3ZCLElBQUksSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO0NBQ3RCLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0NBQzlDLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO0NBQ2xELEtBQUs7Q0FDTCxHQUFHOztDQUVILEVBQUUsSUFBSSxHQUFHO0NBQ1QsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztDQUN6QixHQUFHOztDQUVILEVBQUUsSUFBSSxHQUFHO0NBQ1QsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztDQUN4QixHQUFHOztDQUVIO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsWUFBWSxHQUFHO0NBQ2pCLElBQUksT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDO0NBQzdDLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxLQUFLLEdBQUc7Q0FDVixJQUFJLElBQUksS0FBSyxHQUFHO0NBQ2hCLE1BQU0sUUFBUSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFO0NBQzFDLE1BQU0sTUFBTSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFO0NBQ3hDLEtBQUssQ0FBQzs7Q0FFTixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDaEQsR0FBRztDQUNILENBQUM7O0NDN0ZEO0NBQ0E7Q0FDQTtBQUNBLEFBQ0E7QUFDQSxDQUFPLE1BQU0sTUFBTSxDQUFDO0NBQ3BCLEVBQUUsVUFBVSxHQUFHO0NBQ2YsSUFBSSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLE9BQU8sSUFBSSxDQUFDOztDQUV6RCxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0NBQzVELE1BQU0sSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLE1BQU0sSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7Q0FDdkMsUUFBUSxPQUFPLEtBQUssQ0FBQztDQUNyQixPQUFPO0NBQ1AsS0FBSzs7Q0FFTCxJQUFJLE9BQU8sSUFBSSxDQUFDO0NBQ2hCLEdBQUc7O0NBRUgsRUFBRSxXQUFXLENBQUMsS0FBSyxFQUFFLFVBQVUsRUFBRTtDQUNqQyxJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0NBQ3ZCLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7O0NBRXhCO0NBQ0EsSUFBSSxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztDQUN2QixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDOztDQUV0QixJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO0NBQ3RCLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUM7O0NBRXJCLElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7O0NBRXRCO0NBQ0EsSUFBSSxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQzs7Q0FFekIsSUFBSSxJQUFJLFVBQVUsSUFBSSxVQUFVLENBQUMsUUFBUSxFQUFFO0NBQzNDLE1BQU0sSUFBSSxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDO0NBQzFDLEtBQUs7O0NBRUwsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsRUFBRSxDQUFDOztDQUVoQyxJQUFJLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDOztDQUU1QixJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDOztDQUVqRCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU87Q0FDN0IsSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFO0NBQzdCLE1BQU0sS0FBSyxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtDQUM1QyxRQUFRLElBQUksV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ3BELFFBQVEsSUFBSSxVQUFVLEdBQUcsV0FBVyxDQUFDLFVBQVUsQ0FBQztDQUNoRCxRQUFRLElBQUksQ0FBQyxVQUFVLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7Q0FDcEQsVUFBVSxNQUFNLElBQUksS0FBSyxDQUFDLGtEQUFrRCxDQUFDLENBQUM7Q0FDOUUsU0FBUztDQUNULFFBQVEsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0NBQ3pFLFFBQVEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUM7Q0FDcEMsUUFBUSxJQUFJLFdBQVcsQ0FBQyxTQUFTLEtBQUssSUFBSSxFQUFFO0NBQzVDLFVBQVUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUM3QyxTQUFTO0NBQ1QsUUFBUSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUM7O0NBRTVDLFFBQVEsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFO0NBQ2hDLFVBQVUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7Q0FDakMsVUFBVSxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ3pDLFVBQVUsS0FBSyxJQUFJLFNBQVMsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFO0NBQ3BELFlBQVksSUFBSSxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztDQUN0RCxZQUFZLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUM7O0NBRW5DLFlBQVksTUFBTSxZQUFZLEdBQUc7Q0FDakMsY0FBYyxXQUFXLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxZQUFZO0NBQ3ZELGNBQWMsYUFBYSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsY0FBYztDQUMzRCxjQUFjLGFBQWEsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLGlCQUFpQjtDQUM5RCxhQUFhLENBQUM7O0NBRWQsWUFBWSxJQUFJLFlBQVksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUU7Q0FDM0MsY0FBYyxLQUFLLENBQUMsZUFBZSxDQUFDLGdCQUFnQjtDQUNwRCxnQkFBZ0IsWUFBWSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUM7Q0FDekMsZ0JBQWdCLE1BQU0sSUFBSTtDQUMxQjtDQUNBLGtCQUFrQixJQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0NBQzlELG9CQUFvQixNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQ25ELGlCQUFpQjtDQUNqQixlQUFlLENBQUM7Q0FDaEIsY0FBYyxJQUFJLEtBQUssQ0FBQyxLQUFLLEtBQUssZUFBZSxFQUFFO0NBQ25ELGdCQUFnQixLQUFLLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztDQUN0QyxlQUFlO0NBQ2YsYUFBYSxNQUFNLElBQUksS0FBSyxDQUFDLEtBQUssS0FBSyxrQkFBa0IsRUFBRTtDQUMzRCxjQUFjLEtBQUssQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO0NBQ3BDLGNBQWMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0I7Q0FDcEQsZ0JBQWdCLEtBQUssQ0FBQyxTQUFTLENBQUMsaUJBQWlCO0NBQ2pELGdCQUFnQixDQUFDLE1BQU0sRUFBRSxTQUFTLEtBQUs7Q0FDdkMsa0JBQWtCLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO0NBQzlFLG9CQUFvQixNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQ25ELG1CQUFtQjtDQUNuQixpQkFBaUI7Q0FDakIsZUFBZSxDQUFDO0NBQ2hCLGFBQWE7Q0FDYixXQUFXO0NBQ1gsU0FBUztDQUNULE9BQU87Q0FDUCxLQUFLOztDQUVMLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtDQUM1QixNQUFNLEtBQUssSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Q0FDM0MsUUFBUSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUM3QyxRQUFRLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO0NBQy9CLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsSUFBSSxJQUFJO0NBQ25ELFVBQVUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDdkMsU0FBUyxDQUFDLENBQUM7Q0FDWCxPQUFPO0NBQ1AsS0FBSztDQUNMLEdBQUc7O0NBRUgsRUFBRSxJQUFJLEdBQUc7Q0FDVCxJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO0NBQ3pCLEdBQUc7O0NBRUgsRUFBRSxJQUFJLEdBQUc7Q0FDVCxJQUFJLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0NBQ3hCLEdBQUc7O0NBRUgsRUFBRSxXQUFXLEdBQUc7Q0FDaEIsSUFBSSxLQUFLLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7Q0FDbEMsTUFBTSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ3BDLE1BQU0sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO0NBQ2hDLFFBQVEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0NBQ3JDLE9BQU8sTUFBTTtDQUNiLFFBQVEsS0FBSyxJQUFJLElBQUksS0FBSyxFQUFFO0NBQzVCLFVBQVUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7Q0FDakMsU0FBUztDQUNULE9BQU87Q0FDUCxLQUFLO0NBQ0wsR0FBRzs7Q0FFSCxFQUFFLE1BQU0sR0FBRztDQUNYLElBQUksSUFBSSxJQUFJLEdBQUc7Q0FDZixNQUFNLElBQUksRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUk7Q0FDakMsTUFBTSxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87Q0FDM0IsTUFBTSxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7Q0FDbkMsTUFBTSxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7Q0FDN0IsTUFBTSxPQUFPLEVBQUUsRUFBRTtDQUNqQixNQUFNLE1BQU0sRUFBRSxFQUFFO0NBQ2hCLEtBQUssQ0FBQzs7Q0FFTixJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtDQUNyQixNQUFNLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO0NBQ3hDLE1BQU0sS0FBSyxJQUFJLFNBQVMsSUFBSSxPQUFPLEVBQUU7Q0FDckMsUUFBUSxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7Q0FDdkMsUUFBUSxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxHQUFHO0NBQ2xDLFVBQVUsR0FBRyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRztDQUMzQyxTQUFTLENBQUM7Q0FDVixRQUFRLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtDQUMxQixVQUFVLElBQUksTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7Q0FDaEUsVUFBVSxLQUFLLElBQUksU0FBUyxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7Q0FDOUMsWUFBWSxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0NBQ2hELFlBQVksTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHO0NBQ2hDLGNBQWMsU0FBUyxFQUFFLEtBQUssQ0FBQyxLQUFLO0NBQ3BDLGNBQWMsV0FBVyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTTtDQUNuRSxhQUFhLENBQUM7Q0FDZCxZQUFZLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRTtDQUNsQyxjQUFjLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUMvRSxhQUFhO0NBQ2IsV0FBVztDQUNYLFNBQVM7Q0FDVCxPQUFPOztDQUVQLE1BQU0sSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7Q0FDdEMsTUFBTSxLQUFLLElBQUksU0FBUyxJQUFJLE1BQU0sRUFBRTtDQUNwQyxRQUFRLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUc7Q0FDakMsVUFBVSxTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQztDQUN0QyxTQUFTLENBQUM7Q0FDVixPQUFPO0NBQ1AsS0FBSzs7Q0FFTCxJQUFJLE9BQU8sSUFBSSxDQUFDO0NBQ2hCLEdBQUc7Q0FDSCxDQUFDOztBQUVELENBQU8sU0FBUyxHQUFHLENBQUMsU0FBUyxFQUFFO0NBQy9CLEVBQUUsT0FBTztDQUNULElBQUksUUFBUSxFQUFFLEtBQUs7Q0FDbkIsSUFBSSxTQUFTLEVBQUUsU0FBUztDQUN4QixHQUFHLENBQUM7Q0FDSixDQUFDOztDQ3RMTSxNQUFNLFNBQVMsQ0FBQyxFQUFFOztDQ0FsQixNQUFNLFlBQVksQ0FBQztDQUMxQixFQUFFLEtBQUssR0FBRyxFQUFFO0NBQ1osQ0FBQzs7Q0NGTSxTQUFTLFVBQVUsQ0FBQyxjQUFjLEVBQUU7Q0FDM0MsRUFBRSxJQUFJLGtCQUFrQixHQUFHO0NBQzNCLElBQUksUUFBUTtDQUNaLElBQUksT0FBTztDQUNYLElBQUksT0FBTztDQUNYO0NBQ0EsR0FBRyxDQUFDOztDQUVKLEVBQUUsSUFBSSxrQkFBa0IsR0FBRyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJO0NBQzFELElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM5QixHQUFHLENBQUMsQ0FBQzs7Q0FFTCxFQUFFLElBQUksa0JBQWtCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtDQUNyQyxJQUFJLE1BQU0sSUFBSSxLQUFLO0NBQ25CLE1BQU0sQ0FBQyx5RUFBeUUsRUFBRSxrQkFBa0IsQ0FBQyxJQUFJO1FBQ2pHLElBQUk7T0FDTCxDQUFDLENBQUM7Q0FDVCxLQUFLLENBQUM7Q0FDTixHQUFHOztDQUVILEVBQUUsY0FBYyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Q0FDL0IsRUFBRSxPQUFPLGNBQWMsQ0FBQztDQUN4QixDQUFDOztBQ3JCRSxLQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7O0NBRWYsS0FBSyxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUM7Q0FDMUIsRUFBRSxRQUFRLEVBQUUsTUFBTTtDQUNsQixFQUFFLFlBQVksRUFBRSxJQUFJO0NBQ3BCLEVBQUUsTUFBTSxFQUFFLFlBQVksSUFBSTtDQUMxQixJQUFJLE9BQU8sT0FBTyxZQUFZLEtBQUssV0FBVyxHQUFHLFlBQVksR0FBRyxDQUFDLENBQUM7Q0FDbEUsR0FBRztDQUNILEVBQUUsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxZQUFZLEtBQUs7Q0FDckMsSUFBSSxJQUFJLE9BQU8sWUFBWSxLQUFLLFdBQVcsRUFBRTtDQUM3QyxNQUFNLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxZQUFZLENBQUM7Q0FDOUIsS0FBSyxNQUFNO0NBQ1gsTUFBTSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQ25CLEtBQUs7Q0FDTCxHQUFHO0NBQ0gsRUFBRSxLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxLQUFLO0NBQ3ZCLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUNqQixHQUFHO0NBQ0gsQ0FBQyxDQUFDLENBQUM7O0NBRUgsS0FBSyxDQUFDLE9BQU8sR0FBRyxVQUFVLENBQUM7Q0FDM0IsRUFBRSxRQUFRLEVBQUUsT0FBTztDQUNuQixFQUFFLFlBQVksRUFBRSxJQUFJO0NBQ3BCLEVBQUUsTUFBTSxFQUFFLFlBQVksSUFBSTtDQUMxQixJQUFJLE9BQU8sT0FBTyxZQUFZLEtBQUssV0FBVyxHQUFHLFlBQVksR0FBRyxLQUFLLENBQUM7Q0FDdEUsR0FBRztDQUNILEVBQUUsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxZQUFZLEtBQUs7Q0FDckMsSUFBSSxJQUFJLE9BQU8sWUFBWSxLQUFLLFdBQVcsRUFBRTtDQUM3QyxNQUFNLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxZQUFZLENBQUM7Q0FDOUIsS0FBSyxNQUFNO0NBQ1gsTUFBTSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDO0NBQ3ZCLEtBQUs7Q0FDTCxHQUFHO0NBQ0gsRUFBRSxLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxLQUFLO0NBQ3ZCLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQztDQUNyQixHQUFHO0NBQ0gsQ0FBQyxDQUFDLENBQUM7O0NBRUgsS0FBSyxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUM7Q0FDMUIsRUFBRSxRQUFRLEVBQUUsTUFBTTtDQUNsQixFQUFFLFlBQVksRUFBRSxJQUFJO0NBQ3BCLEVBQUUsTUFBTSxFQUFFLFlBQVksSUFBSTtDQUMxQixJQUFJLE9BQU8sT0FBTyxZQUFZLEtBQUssV0FBVyxHQUFHLFlBQVksR0FBRyxFQUFFLENBQUM7Q0FDbkUsR0FBRztDQUNILEVBQUUsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxZQUFZLEtBQUs7Q0FDckMsSUFBSSxJQUFJLE9BQU8sWUFBWSxLQUFLLFdBQVcsRUFBRTtDQUM3QyxNQUFNLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxZQUFZLENBQUM7Q0FDOUIsS0FBSyxNQUFNO0NBQ1gsTUFBTSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0NBQ3BCLEtBQUs7Q0FDTCxHQUFHO0NBQ0gsRUFBRSxLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxLQUFLO0NBQ3ZCLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztDQUNsQixHQUFHO0NBQ0gsQ0FBQyxDQUFDLENBQUM7O0NBRUgsS0FBSyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUM7Q0FDekIsRUFBRSxRQUFRLEVBQUUsS0FBSztDQUNqQixFQUFFLE1BQU0sRUFBRSxZQUFZLElBQUk7Q0FDMUIsSUFBSSxJQUFJLE9BQU8sWUFBWSxLQUFLLFdBQVcsRUFBRTtDQUM3QyxNQUFNLE9BQU8sWUFBWSxDQUFDLEtBQUssRUFBRSxDQUFDO0NBQ2xDLEtBQUs7O0NBRUwsSUFBSSxPQUFPLEVBQUUsQ0FBQztDQUNkLEdBQUc7Q0FDSCxFQUFFLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsWUFBWSxLQUFLO0NBQ3JDLElBQUksSUFBSSxPQUFPLFlBQVksS0FBSyxXQUFXLEVBQUU7Q0FDN0MsTUFBTSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsWUFBWSxDQUFDLEtBQUssRUFBRSxDQUFDO0NBQ3RDLEtBQUssTUFBTTtDQUNYLE1BQU0sR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7Q0FDMUIsS0FBSztDQUNMLEdBQUc7Q0FDSCxFQUFFLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEtBQUs7Q0FDdkIsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztDQUN4QixHQUFHO0NBQ0gsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsS0FBSztDQUMzQixJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUM7Q0FDaEMsR0FBRztDQUNILENBQUMsQ0FBQyxDQUFDOztDQzdFSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsSUFBSSxhQUFhLEdBQUc7Q0FDcEIsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU07Q0FDdEIsRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU87Q0FDeEIsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU07Q0FDdEIsQ0FBQyxDQUFDOztBQUVGLENBQU8sU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFO0NBQ2pDLEVBQUUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO0NBQzVCLElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDO0NBQ3ZCLEdBQUc7O0NBRUgsRUFBRSxJQUFJLGFBQWEsQ0FBQyxPQUFPLEtBQUssQ0FBQyxFQUFFO0NBQ25DLElBQUksT0FBTyxhQUFhLENBQUMsT0FBTyxLQUFLLENBQUMsQ0FBQztDQUN2QyxHQUFHLE1BQU07Q0FDVCxJQUFJLE9BQU8sSUFBSSxDQUFDO0NBQ2hCLEdBQUc7Q0FDSCxDQUFDOztDQ3JCTSxTQUFTLGVBQWUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFO0NBQzlDO0NBQ0EsRUFBRSxLQUFLLElBQUksR0FBRyxJQUFJLE1BQU0sRUFBRTtDQUMxQixJQUFJLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7Q0FDaEMsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO0NBQ2YsTUFBTSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7Q0FDeEQsS0FBSztDQUNMLEdBQUc7O0NBRUgsRUFBRSxJQUFJLFNBQVMsR0FBRyxXQUFXO0NBQzdCLElBQUksS0FBSyxJQUFJLEdBQUcsSUFBSSxNQUFNLEVBQUU7Q0FDNUIsTUFBTSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDN0IsTUFBTSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0NBQzNCLE1BQU0sSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtDQUMvQixRQUFRLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztDQUM5QyxPQUFPLE1BQU07Q0FDYixRQUFRLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO0NBQ2pDLE9BQU87Q0FDUCxLQUFLO0NBQ0wsR0FBRyxDQUFDOztDQUVKLEVBQUUsSUFBSSxPQUFPLElBQUksS0FBSyxXQUFXLEVBQUU7Q0FDbkMsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztDQUM5RCxHQUFHOztDQUVILEVBQUUsU0FBUyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDOztDQUV0QyxFQUFFLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQztDQUN4QixFQUFFLEtBQUssSUFBSSxHQUFHLElBQUksTUFBTSxFQUFFO0NBQzFCLElBQUksSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQzNCLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUU7Q0FDcEIsTUFBTSxJQUFJLENBQUMsSUFBSSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7Q0FDMUMsS0FBSzs7Q0FFTCxJQUFJLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7Q0FDekIsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO0NBQ2YsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsdUNBQXVDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDckUsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDO0NBQ3pCLEtBQUs7Q0FDTCxHQUFHOztDQUVILEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRTtDQUNuQixJQUFJLE9BQU8sQ0FBQyxJQUFJO0NBQ2hCLE1BQU0sQ0FBQyw0SEFBNEgsQ0FBQztDQUNwSSxLQUFLLENBQUM7O0NBRU4sSUFBSSxLQUFLLElBQUksR0FBRyxJQUFJLE1BQU0sRUFBRTtDQUM1QixNQUFNLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUM3QixNQUFNLFNBQVMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztDQUM5QyxLQUFLO0NBQ0wsR0FBRyxNQUFNO0NBQ1QsSUFBSSxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxTQUFTLEdBQUcsRUFBRTtDQUM3QyxNQUFNLEtBQUssSUFBSSxHQUFHLElBQUksTUFBTSxFQUFFO0NBQzlCLFFBQVEsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztDQUNwQyxRQUFRLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtDQUMvQixVQUFVLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDL0IsU0FBUyxNQUFNLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtDQUM5QixVQUFVLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztDQUNwQyxTQUFTLE1BQU07Q0FDZjtDQUNBO0NBQ0EsVUFBVSxPQUFPLENBQUMsSUFBSTtDQUN0QixZQUFZLENBQUMscUNBQXFDLEVBQUUsR0FBRyxDQUFDLFdBQVcsQ0FBQztDQUNwRSxXQUFXLENBQUM7Q0FDWixTQUFTO0NBQ1QsT0FBTztDQUNQLEtBQUssQ0FBQzs7Q0FFTixJQUFJLFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFdBQVc7Q0FDM0MsTUFBTSxLQUFLLElBQUksR0FBRyxJQUFJLE1BQU0sRUFBRTtDQUM5QixRQUFRLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUMvQixRQUFRLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7Q0FDN0IsUUFBUSxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztDQUM1RCxPQUFPO0NBQ1AsS0FBSyxDQUFDOztDQUVOLElBQUksU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsV0FBVztDQUMzQyxNQUFNLEtBQUssSUFBSSxHQUFHLElBQUksTUFBTSxFQUFFO0NBQzlCLFFBQVEsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztDQUNwQyxRQUFRLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztDQUM5QyxPQUFPO0NBQ1AsS0FBSyxDQUFDOztDQUVOLElBQUksS0FBSyxJQUFJLEdBQUcsSUFBSSxNQUFNLEVBQUU7Q0FDNUIsTUFBTSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDN0IsTUFBTSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0NBQzNCLE1BQU0sU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDOztDQUU5QyxNQUFNLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtDQUN0QixRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0NBQzNELE9BQU87Q0FDUCxLQUFLO0NBQ0wsR0FBRzs7Q0FFSCxFQUFFLE9BQU8sU0FBUyxDQUFDO0NBQ25CLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7In0=
