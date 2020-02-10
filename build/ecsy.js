(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = global || self, (function () {
		var current = global.ECSY;
		var exports = global.ECSY = {};
		factory(exports);
		exports.noConflict = function () { global.ECSY = current; return exports; };
	}()));
}(this, (function (exports) { 'use strict';

	class SystemManager {
	  constructor(world) {
	    this._systems = [];
	    this._executeSystems = []; // Systems that have `execute` method
	    this.world = world;
	    this.lastExecutedSystem = null;
	  }

	  registerSystem(System, attributes) {
	    if (
	      this._systems.find(s => s.constructor.name === System.name) !== undefined
	    ) {
	      console.warn(`System '${System.name}' already registered.`);
	      return this;
	    }

	    var system = new System(this.world, attributes);
	    if (system.init) system.init();
	    system.order = this._systems.length;
	    this._systems.push(system);
	    if (system.execute) {
	      this._executeSystems.push(system);
	      this.sortSystems();
	    }
	    return this;
	  }

	  sortSystems() {
	    this._executeSystems.sort((a, b) => {
	      return a.priority - b.priority || a.order - b.order;
	    });
	  }

	  getSystem(System) {
	    return this._systems.find(s => s instanceof System);
	  }

	  getSystems() {
	    return this._systems;
	  }

	  removeSystem(System) {
	    var index = this._systems.indexOf(System);
	    if (!~index) return;

	    this._systems.splice(index, 1);
	  }

	  executeSystem(system, delta, time) {
	    if (system.initialized) {
	      if (system.canExecute()) {
	        let startTime = performance.now();
	        system.execute(delta, time);
	        system.executeTime = performance.now() - startTime;
	        this.lastExecutedSystem = system;
	        system.clearEvents();
	      }
	    }
	  }

	  stop() {
	    this._executeSystems.forEach(system => system.stop());
	  }

	  execute(delta, time, forcePlay) {
	    this._executeSystems.forEach(
	      system =>
	        (forcePlay || system.enabled) && this.executeSystem(system, delta, time)
	    );
	  }

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
	  return getName(Component);
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

	  return names.sort().join("-");
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

	  toJSON() {
	    return {
	      key: this.key,
	      reactive: this.reactive,
	      components: {
	        included: this.Components.map(C => C.name),
	        not: this.NotComponents.map(C => C.name)
	      },
	      numEntities: this.entities.length
	    };
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

	  getComponent(Component, includeRemoved) {
	    var component = this._components[Component.name];

	    if (!component && includeRemoved === true) {
	      component = this._componentsToRemove[Component.name];
	    }

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

	  hasComponent(Component, includeRemoved) {
	    return (
	      !!~this._ComponentTypes.indexOf(Component) ||
	      (includeRemoved === true && this.hasRemovedComponent(Component))
	    );
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

	  removeAllComponents(forceRemove) {
	    return this._world.entityRemoveAllComponents(this, forceRemove);
	  }

	  // EXTRAS

	  // Initialize the entity. To be used when returning an entity to the pool
	  reset() {
	    this.id = nextId++;
	    this._world = null;
	    this._ComponentTypes.length = 0;
	    this.queries.length = 0;
	    this._components = {};
	  }

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
	    this.isObjectPool = true;

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

	SystemStateComponent.isSystemStateComponent = true;

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
	    this.deferredRemovalEnabled = true;

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

	        var propName = componentPropertyName(Component);
	        var componentName = getName(Component);
	        var component = entity._componentsToRemove[componentName];
	        delete entity._componentsToRemove[componentName];
	        this.componentsManager._componentPool[propName].release(component);
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
	    this.isDummyObjectPool = true;
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
	    if (this.Components[Component.name]) {
	      console.warn(`Component type: '${Component.name}' already registered.`);
	      return;
	    }

	    this.Components[Component.name] = Component;
	    this.numComponents[Component.name] = 0;
	  }

	  componentAddedToEntity(Component) {
	    if (!this.Components[Component.name]) {
	      this.registerComponent(Component);
	    }

	    this.numComponents[Component.name]++;
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
	          `Component '${Component.name}' won't benefit from pooling because 'reset' method was not implemented.`
	        );
	        this._componentPool[componentName] = new DummyObjectPool(Component);
	      }
	    }

	    return this._componentPool[componentName];
	  }
	}

	var name = "ecsy";
	var version = "0.2.2";
	var description = "Entity Component System in JS";
	var main = "build/ecsy.js";
	var module = "build/ecsy.module.js";
	var types = "src/index.d.ts";
	var scripts = {
		build: "rollup -c && npm run docs",
		docs: "rm docs/api/_sidebar.md; typedoc --readme none --mode file --excludeExternals --plugin typedoc-plugin-markdown  --theme docs/theme --hideSources --hideBreadcrumbs --out docs/api/ --includeDeclarations --includes 'src/**/*.d.ts' src; touch docs/api/_sidebar.md",
		"dev:docs": "nodemon -e ts -x 'npm run docs' -w src",
		dev: "concurrently --names 'ROLLUP,DOCS,HTTP' -c 'bgBlue.bold,bgYellow.bold,bgGreen.bold' 'rollup -c -w -m inline' 'npm run dev:docs' 'npm run dev:server'",
		"dev:server": "http-server -c-1 -p 8080 --cors",
		lint: "eslint src test examples",
		start: "npm run dev",
		test: "ava",
		travis: "npm run lint && npm run test && npm run build",
		"watch:test": "ava --watch"
	};
	var repository = {
		type: "git",
		url: "git+https://github.com/fernandojsg/ecsy.git"
	};
	var keywords = [
		"ecs",
		"entity component system"
	];
	var author = "Fernando Serrano <fernandojsg@gmail.com> (http://fernandojsg.com)";
	var license = "MIT";
	var bugs = {
		url: "https://github.com/fernandojsg/ecsy/issues"
	};
	var ava = {
		files: [
			"test/**/*.test.js"
		],
		sources: [
			"src/**/*.js"
		],
		require: [
			"babel-register",
			"esm"
		]
	};
	var jspm = {
		files: [
			"package.json",
			"LICENSE",
			"README.md",
			"build/ecsy.js",
			"build/ecsy.min.js",
			"build/ecsy.module.js"
		],
		directories: {
		}
	};
	var homepage = "https://github.com/fernandojsg/ecsy#readme";
	var devDependencies = {
		ava: "^1.4.1",
		"babel-cli": "^6.26.0",
		"babel-core": "^6.26.3",
		"babel-eslint": "^10.0.3",
		"babel-loader": "^8.0.6",
		concurrently: "^4.1.2",
		"docsify-cli": "^4.4.0",
		eslint: "^5.16.0",
		"eslint-config-prettier": "^4.3.0",
		"eslint-plugin-prettier": "^3.1.2",
		"http-server": "^0.11.1",
		nodemon: "^1.19.4",
		prettier: "^1.19.1",
		rollup: "^1.29.0",
		"rollup-plugin-json": "^4.0.0",
		"rollup-plugin-terser": "^5.2.0",
		typedoc: "^0.15.8",
		"typedoc-plugin-markdown": "^2.2.16",
		typescript: "^3.7.5"
	};
	var pjson = {
		name: name,
		version: version,
		description: description,
		main: main,
		"jsnext:main": "build/ecsy.module.js",
		module: module,
		types: types,
		scripts: scripts,
		repository: repository,
		keywords: keywords,
		author: author,
		license: license,
		bugs: bugs,
		ava: ava,
		jspm: jspm,
		homepage: homepage,
		devDependencies: devDependencies
	};

	const Version = pjson.version;

	class World {
	  constructor() {
	    this.componentsManager = new ComponentManager(this);
	    this.entityManager = new EntityManager(this);
	    this.systemManager = new SystemManager(this);

	    this.enabled = true;

	    this.eventQueues = {};

	    if (typeof CustomEvent !== "undefined") {
	      var event = new CustomEvent("ecsy-world-created", {
	        detail: { world: this, version: Version }
	      });
	      window.dispatchEvent(event);
	    }

	    this.lastTime = performance.now();
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
	    if (!delta) {
	      let time = performance.now();
	      delta = time - this.lastTime;
	      this.lastTime = time;
	    }

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
	      }
	    }
	  }

	  stop() {
	    this.executeTime = 0;
	    this.enabled = false;
	  }

	  play() {
	    this.enabled = true;
	  }

	  // @question rename to clear queues?
	  clearEvents() {
	    for (let queryName in this.queries) {
	      var query = this.queries[queryName];
	      if (query.added) {
	        query.added.length = 0;
	      }
	      if (query.removed) {
	        query.removed.length = 0;
	      }
	      if (query.changed) {
	        if (Array.isArray(query.changed)) {
	          query.changed.length = 0;
	        } else {
	          for (let name in query.changed) {
	            query.changed[name].length = 0;
	          }
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
	      queries: {}
	    };

	    if (this.constructor.queries) {
	      var queries = this.constructor.queries;
	      for (let queryName in queries) {
	        let query = this.queries[queryName];
	        let queryDefinition = queries[queryName];
	        let jsonQuery = (json.queries[queryName] = {
	          key: this._queries[queryName].key
	        });

	        jsonQuery.mandatory = queryDefinition.mandatory === true;
	        jsonQuery.reactive =
	          queryDefinition.listen &&
	          (queryDefinition.listen.added === true ||
	            queryDefinition.listen.removed === true ||
	            queryDefinition.listen.changed === true ||
	            Array.isArray(queryDefinition.listen.changed));

	        if (jsonQuery.reactive) {
	          jsonQuery.listen = {};

	          const methods = ["added", "removed", "changed"];
	          methods.forEach(method => {
	            if (query[method]) {
	              jsonQuery.listen[method] = {
	                entities: query[method].length
	              };
	            }
	          });
	        }
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

	Component.isComponent = true;

	class TagComponent {
	  reset() {}
	}

	TagComponent.isTagComponent = true;

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

	function generateId(length) {
	  var result = "";
	  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	  var charactersLength = characters.length;
	  for (var i = 0; i < length; i++) {
	    result += characters.charAt(Math.floor(Math.random() * charactersLength));
	  }
	  return result;
	}

	function injectScript(src, onLoad) {
	  var script = document.createElement("script");
	  // @todo Use link to the ecsy-devtools repo?
	  script.src = src;
	  script.onload = onLoad;
	  (document.head || document.documentElement).appendChild(script);
	}

	/* global Peer */

	function hookConsoleAndErrors(connection) {
	  var wrapFunctions = ["error", "warning", "log"];
	  wrapFunctions.forEach(key => {
	    if (typeof console[key] === "function") {
	      var fn = console[key].bind(console);
	      console[key] = (...args) => {
	        connection.send({
	          method: "console",
	          type: key,
	          args: JSON.stringify(args)
	        });
	        return fn.apply(null, args);
	      };
	    }
	  });

	  window.addEventListener("error", error => {
	    connection.send({
	      method: "error",
	      error: JSON.stringify({
	        message: error.error.message,
	        stack: error.error.stack
	      })
	    });
	  });
	}

	function includeRemoteIdHTML(remoteId) {
	  let infoDiv = document.createElement("div");
	  infoDiv.style.cssText = `
    align-items: center;
    background-color: #333;
    color: #aaa;
    display:flex;
    font-family: Arial;
    font-size: 1.1em;
    height: 40px;
    justify-content: center;
    left: 0;
    opacity: 0.9;
    position: absolute;
    right: 0;
    text-align: center;
    top: 0;
  `;

	  infoDiv.innerHTML = `Open ECSY devtools to connect to this page using the code:&nbsp;<b style="color: #fff">${remoteId}</b>&nbsp;<button onClick="generateNewCode()">Generate new code</button>`;
	  document.body.appendChild(infoDiv);

	  return infoDiv;
	}

	function enableRemoteDevtools(remoteId) {
	  window.generateNewCode = () => {
	    window.localStorage.clear();
	    remoteId = generateId(6);
	    window.localStorage.setItem("ecsyRemoteId", remoteId);
	    window.location.reload(false);
	  };

	  remoteId = remoteId || window.localStorage.getItem("ecsyRemoteId");
	  if (!remoteId) {
	    remoteId = generateId(6);
	    window.localStorage.setItem("ecsyRemoteId", remoteId);
	  }

	  let infoDiv = includeRemoteIdHTML(remoteId);

	  window.__ECSY_REMOTE_DEVTOOLS_INJECTED = true;
	  window.__ECSY_REMOTE_DEVTOOLS = {};

	  let Version = "";

	  // This is used to collect the worlds created before the communication is being established
	  let worldsBeforeLoading = [];
	  let onWorldCreated = e => {
	    var world = e.detail.world;
	    Version = e.detail.version;
	    worldsBeforeLoading.push(world);
	  };
	  window.addEventListener("ecsy-world-created", onWorldCreated);

	  let onLoaded = () => {
	    var peer = new Peer(remoteId);
	    peer.on("open", (/* id */) => {
	      peer.on("connection", connection => {
	        window.__ECSY_REMOTE_DEVTOOLS.connection = connection;
	        connection.on("open", function() {
	          // infoDiv.style.visibility = "hidden";
	          infoDiv.innerHTML = "Connected";

	          // Receive messages
	          connection.on("data", function(data) {
	            if (data.type === "init") {
	              var script = document.createElement("script");
	              script.setAttribute("type", "text/javascript");
	              script.onload = () => {
	                script.parentNode.removeChild(script);

	                // Once the script is injected we don't need to listen
	                window.removeEventListener(
	                  "ecsy-world-created",
	                  onWorldCreated
	                );
	                worldsBeforeLoading.forEach(world => {
	                  var event = new CustomEvent("ecsy-world-created", {
	                    detail: { world: world, version: Version }
	                  });
	                  window.dispatchEvent(event);
	                });
	              };
	              script.innerHTML = data.script;
	              (document.head || document.documentElement).appendChild(script);
	              script.onload();

	              hookConsoleAndErrors(connection);
	            } else if (data.type === "executeScript") {
	              let value = eval(data.script);
	              if (data.returnEval) {
	                connection.send({
	                  method: "evalReturn",
	                  value: value
	                });
	              }
	            }
	          });
	        });
	      });
	    });
	  };

	  // Inject PeerJS script
	  injectScript(
	    "https://cdn.jsdelivr.net/npm/peerjs@0.3.20/dist/peer.min.js",
	    onLoaded
	  );
	}

	const urlParams = new URLSearchParams(window.location.search);

	// @todo Provide a way to disable it if needed
	if (urlParams.has("enable-remote-devtools")) {
	  enableRemoteDevtools();
	}

	exports.Component = Component;
	exports.Not = Not;
	exports.System = System;
	exports.SystemStateComponent = SystemStateComponent;
	exports.TagComponent = TagComponent;
	exports.Types = Types;
	exports.Version = Version;
	exports.World = World;
	exports.createComponentClass = createComponentClass;
	exports.createType = createType;
	exports.enableRemoteDevtools = enableRemoteDevtools;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL1N5c3RlbU1hbmFnZXIuanMiLCIuLi9zcmMvRXZlbnREaXNwYXRjaGVyLmpzIiwiLi4vc3JjL1V0aWxzLmpzIiwiLi4vc3JjL1F1ZXJ5LmpzIiwiLi4vc3JjL0VudGl0eS5qcyIsIi4uL3NyYy9PYmplY3RQb29sLmpzIiwiLi4vc3JjL1F1ZXJ5TWFuYWdlci5qcyIsIi4uL3NyYy9TeXN0ZW1TdGF0ZUNvbXBvbmVudC5qcyIsIi4uL3NyYy9FbnRpdHlNYW5hZ2VyLmpzIiwiLi4vc3JjL0R1bW15T2JqZWN0UG9vbC5qcyIsIi4uL3NyYy9Db21wb25lbnRNYW5hZ2VyLmpzIiwiLi4vc3JjL1ZlcnNpb24uanMiLCIuLi9zcmMvV29ybGQuanMiLCIuLi9zcmMvU3lzdGVtLmpzIiwiLi4vc3JjL0NvbXBvbmVudC5qcyIsIi4uL3NyYy9UYWdDb21wb25lbnQuanMiLCIuLi9zcmMvQ3JlYXRlVHlwZS5qcyIsIi4uL3NyYy9TdGFuZGFyZFR5cGVzLmpzIiwiLi4vc3JjL0luZmVyVHlwZS5qcyIsIi4uL3NyYy9DcmVhdGVDb21wb25lbnRDbGFzcy5qcyIsIi4uL3NyYy9SZW1vdGVEZXZUb29scy91dGlscy5qcyIsIi4uL3NyYy9SZW1vdGVEZXZUb29scy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY2xhc3MgU3lzdGVtTWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy5fc3lzdGVtcyA9IFtdO1xuICAgIHRoaXMuX2V4ZWN1dGVTeXN0ZW1zID0gW107IC8vIFN5c3RlbXMgdGhhdCBoYXZlIGBleGVjdXRlYCBtZXRob2RcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgdGhpcy5sYXN0RXhlY3V0ZWRTeXN0ZW0gPSBudWxsO1xuICB9XG5cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtLCBhdHRyaWJ1dGVzKSB7XG4gICAgaWYgKFxuICAgICAgdGhpcy5fc3lzdGVtcy5maW5kKHMgPT4gcy5jb25zdHJ1Y3Rvci5uYW1lID09PSBTeXN0ZW0ubmFtZSkgIT09IHVuZGVmaW5lZFxuICAgICkge1xuICAgICAgY29uc29sZS53YXJuKGBTeXN0ZW0gJyR7U3lzdGVtLm5hbWV9JyBhbHJlYWR5IHJlZ2lzdGVyZWQuYCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICB2YXIgc3lzdGVtID0gbmV3IFN5c3RlbSh0aGlzLndvcmxkLCBhdHRyaWJ1dGVzKTtcbiAgICBpZiAoc3lzdGVtLmluaXQpIHN5c3RlbS5pbml0KCk7XG4gICAgc3lzdGVtLm9yZGVyID0gdGhpcy5fc3lzdGVtcy5sZW5ndGg7XG4gICAgdGhpcy5fc3lzdGVtcy5wdXNoKHN5c3RlbSk7XG4gICAgaWYgKHN5c3RlbS5leGVjdXRlKSB7XG4gICAgICB0aGlzLl9leGVjdXRlU3lzdGVtcy5wdXNoKHN5c3RlbSk7XG4gICAgICB0aGlzLnNvcnRTeXN0ZW1zKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc29ydFN5c3RlbXMoKSB7XG4gICAgdGhpcy5fZXhlY3V0ZVN5c3RlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgcmV0dXJuIGEucHJpb3JpdHkgLSBiLnByaW9yaXR5IHx8IGEub3JkZXIgLSBiLm9yZGVyO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0U3lzdGVtKFN5c3RlbSkge1xuICAgIHJldHVybiB0aGlzLl9zeXN0ZW1zLmZpbmQocyA9PiBzIGluc3RhbmNlb2YgU3lzdGVtKTtcbiAgfVxuXG4gIGdldFN5c3RlbXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N5c3RlbXM7XG4gIH1cblxuICByZW1vdmVTeXN0ZW0oU3lzdGVtKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5fc3lzdGVtcy5pbmRleE9mKFN5c3RlbSk7XG4gICAgaWYgKCF+aW5kZXgpIHJldHVybjtcblxuICAgIHRoaXMuX3N5c3RlbXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgfVxuXG4gIGV4ZWN1dGVTeXN0ZW0oc3lzdGVtLCBkZWx0YSwgdGltZSkge1xuICAgIGlmIChzeXN0ZW0uaW5pdGlhbGl6ZWQpIHtcbiAgICAgIGlmIChzeXN0ZW0uY2FuRXhlY3V0ZSgpKSB7XG4gICAgICAgIGxldCBzdGFydFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgc3lzdGVtLmV4ZWN1dGUoZGVsdGEsIHRpbWUpO1xuICAgICAgICBzeXN0ZW0uZXhlY3V0ZVRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgdGhpcy5sYXN0RXhlY3V0ZWRTeXN0ZW0gPSBzeXN0ZW07XG4gICAgICAgIHN5c3RlbS5jbGVhckV2ZW50cygpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHN0b3AoKSB7XG4gICAgdGhpcy5fZXhlY3V0ZVN5c3RlbXMuZm9yRWFjaChzeXN0ZW0gPT4gc3lzdGVtLnN0b3AoKSk7XG4gIH1cblxuICBleGVjdXRlKGRlbHRhLCB0aW1lLCBmb3JjZVBsYXkpIHtcbiAgICB0aGlzLl9leGVjdXRlU3lzdGVtcy5mb3JFYWNoKFxuICAgICAgc3lzdGVtID0+XG4gICAgICAgIChmb3JjZVBsYXkgfHwgc3lzdGVtLmVuYWJsZWQpICYmIHRoaXMuZXhlY3V0ZVN5c3RlbShzeXN0ZW0sIGRlbHRhLCB0aW1lKVxuICAgICk7XG4gIH1cblxuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBudW1TeXN0ZW1zOiB0aGlzLl9zeXN0ZW1zLmxlbmd0aCxcbiAgICAgIHN5c3RlbXM6IHt9XG4gICAgfTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fc3lzdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN5c3RlbSA9IHRoaXMuX3N5c3RlbXNbaV07XG4gICAgICB2YXIgc3lzdGVtU3RhdHMgPSAoc3RhdHMuc3lzdGVtc1tzeXN0ZW0uY29uc3RydWN0b3IubmFtZV0gPSB7XG4gICAgICAgIHF1ZXJpZXM6IHt9XG4gICAgICB9KTtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gc3lzdGVtLmN0eCkge1xuICAgICAgICBzeXN0ZW1TdGF0cy5xdWVyaWVzW25hbWVdID0gc3lzdGVtLmN0eFtuYW1lXS5zdGF0cygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuIiwiLyoqXG4gKiBAcHJpdmF0ZVxuICogQGNsYXNzIEV2ZW50RGlzcGF0Y2hlclxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFdmVudERpc3BhdGNoZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLl9saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLnN0YXRzID0ge1xuICAgICAgZmlyZWQ6IDAsXG4gICAgICBoYW5kbGVkOiAwXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBsaXN0ZW5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgdG8gdHJpZ2dlciB3aGVuIHRoZSBldmVudCBpcyBmaXJlZFxuICAgKi9cbiAgYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgbGV0IGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50TmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICB9XG5cbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihsaXN0ZW5lcikgPT09IC0xKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXS5wdXNoKGxpc3RlbmVyKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgYW4gZXZlbnQgbGlzdGVuZXIgaXMgYWxyZWFkeSBhZGRlZCB0byB0aGUgbGlzdCBvZiBsaXN0ZW5lcnNcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBjaGVja1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayBmb3IgdGhlIHNwZWNpZmllZCBldmVudFxuICAgKi9cbiAgaGFzRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdICE9PSB1bmRlZmluZWQgJiZcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdLmluZGV4T2YobGlzdGVuZXIpICE9PSAtMVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFuIGV2ZW50IGxpc3RlbmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50XG4gICAqL1xuICByZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICB2YXIgbGlzdGVuZXJBcnJheSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xuICAgIGlmIChsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBpbmRleCA9IGxpc3RlbmVyQXJyYXkuaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGxpc3RlbmVyQXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGlzcGF0Y2ggYW4gZXZlbnRcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBkaXNwYXRjaFxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IChPcHRpb25hbCkgRW50aXR5IHRvIGVtaXRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IGNvbXBvbmVudFxuICAgKi9cbiAgZGlzcGF0Y2hFdmVudChldmVudE5hbWUsIGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgdGhpcy5zdGF0cy5maXJlZCsrO1xuXG4gICAgdmFyIGxpc3RlbmVyQXJyYXkgPSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXTtcbiAgICBpZiAobGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgYXJyYXkgPSBsaXN0ZW5lckFycmF5LnNsaWNlKDApO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGFycmF5W2ldLmNhbGwodGhpcywgZW50aXR5LCBjb21wb25lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCBzdGF0cyBjb3VudGVyc1xuICAgKi9cbiAgcmVzZXRDb3VudGVycygpIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkID0gdGhpcy5zdGF0cy5oYW5kbGVkID0gMDtcbiAgfVxufVxuIiwiLyoqXG4gKiBSZXR1cm4gdGhlIG5hbWUgb2YgYSBjb21wb25lbnRcbiAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXROYW1lKENvbXBvbmVudCkge1xuICByZXR1cm4gQ29tcG9uZW50Lm5hbWU7XG59XG5cbi8qKlxuICogUmV0dXJuIGEgdmFsaWQgcHJvcGVydHkgbmFtZSBmb3IgdGhlIENvbXBvbmVudFxuICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpIHtcbiAgcmV0dXJuIGdldE5hbWUoQ29tcG9uZW50KTtcbn1cblxuLyoqXG4gKiBHZXQgYSBrZXkgZnJvbSBhIGxpc3Qgb2YgY29tcG9uZW50c1xuICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIEFycmF5IG9mIGNvbXBvbmVudHMgdG8gZ2VuZXJhdGUgdGhlIGtleVxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1ZXJ5S2V5KENvbXBvbmVudHMpIHtcbiAgdmFyIG5hbWVzID0gW107XG4gIGZvciAodmFyIG4gPSAwOyBuIDwgQ29tcG9uZW50cy5sZW5ndGg7IG4rKykge1xuICAgIHZhciBUID0gQ29tcG9uZW50c1tuXTtcbiAgICBpZiAodHlwZW9mIFQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIHZhciBvcGVyYXRvciA9IFQub3BlcmF0b3IgPT09IFwibm90XCIgPyBcIiFcIiA6IFQub3BlcmF0b3I7XG4gICAgICBuYW1lcy5wdXNoKG9wZXJhdG9yICsgZ2V0TmFtZShULkNvbXBvbmVudCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lcy5wdXNoKGdldE5hbWUoVCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lcy5zb3J0KCkuam9pbihcIi1cIik7XG59XG4iLCJpbXBvcnQgRXZlbnREaXNwYXRjaGVyIGZyb20gXCIuL0V2ZW50RGlzcGF0Y2hlci5qc1wiO1xuaW1wb3J0IHsgcXVlcnlLZXkgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBRdWVyeSB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgTGlzdCBvZiB0eXBlcyBvZiBjb21wb25lbnRzIHRvIHF1ZXJ5XG4gICAqL1xuICBjb25zdHJ1Y3RvcihDb21wb25lbnRzLCBtYW5hZ2VyKSB7XG4gICAgdGhpcy5Db21wb25lbnRzID0gW107XG4gICAgdGhpcy5Ob3RDb21wb25lbnRzID0gW107XG5cbiAgICBDb21wb25lbnRzLmZvckVhY2goY29tcG9uZW50ID0+IHtcbiAgICAgIGlmICh0eXBlb2YgY29tcG9uZW50ID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHRoaXMuTm90Q29tcG9uZW50cy5wdXNoKGNvbXBvbmVudC5Db21wb25lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5Db21wb25lbnRzLnB1c2goY29tcG9uZW50KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICh0aGlzLkNvbXBvbmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjcmVhdGUgYSBxdWVyeSB3aXRob3V0IGNvbXBvbmVudHNcIik7XG4gICAgfVxuXG4gICAgdGhpcy5lbnRpdGllcyA9IFtdO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG5cbiAgICAvLyBUaGlzIHF1ZXJ5IGlzIGJlaW5nIHVzZWQgYnkgYSByZWFjdGl2ZSBzeXN0ZW1cbiAgICB0aGlzLnJlYWN0aXZlID0gZmFsc2U7XG5cbiAgICB0aGlzLmtleSA9IHF1ZXJ5S2V5KENvbXBvbmVudHMpO1xuXG4gICAgLy8gRmlsbCB0aGUgcXVlcnkgd2l0aCB0aGUgZXhpc3RpbmcgZW50aXRpZXNcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hbmFnZXIuX2VudGl0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZW50aXR5ID0gbWFuYWdlci5fZW50aXRpZXNbaV07XG4gICAgICBpZiAodGhpcy5tYXRjaChlbnRpdHkpKSB7XG4gICAgICAgIC8vIEB0b2RvID8/PyB0aGlzLmFkZEVudGl0eShlbnRpdHkpOyA9PiBwcmV2ZW50aW5nIHRoZSBldmVudCB0byBiZSBnZW5lcmF0ZWRcbiAgICAgICAgZW50aXR5LnF1ZXJpZXMucHVzaCh0aGlzKTtcbiAgICAgICAgdGhpcy5lbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBlbnRpdHkgdG8gdGhpcyBxdWVyeVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5XG4gICAqL1xuICBhZGRFbnRpdHkoZW50aXR5KSB7XG4gICAgZW50aXR5LnF1ZXJpZXMucHVzaCh0aGlzKTtcbiAgICB0aGlzLmVudGl0aWVzLnB1c2goZW50aXR5KTtcblxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCwgZW50aXR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgZW50aXR5IGZyb20gdGhpcyBxdWVyeVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5XG4gICAqL1xuICByZW1vdmVFbnRpdHkoZW50aXR5KSB7XG4gICAgbGV0IGluZGV4ID0gdGhpcy5lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgaWYgKH5pbmRleCkge1xuICAgICAgdGhpcy5lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICBpbmRleCA9IGVudGl0eS5xdWVyaWVzLmluZGV4T2YodGhpcyk7XG4gICAgICBlbnRpdHkucXVlcmllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBRdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQsXG4gICAgICAgIGVudGl0eVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBtYXRjaChlbnRpdHkpIHtcbiAgICByZXR1cm4gKFxuICAgICAgZW50aXR5Lmhhc0FsbENvbXBvbmVudHModGhpcy5Db21wb25lbnRzKSAmJlxuICAgICAgIWVudGl0eS5oYXNBbnlDb21wb25lbnRzKHRoaXMuTm90Q29tcG9uZW50cylcbiAgICApO1xuICB9XG5cbiAgdG9KU09OKCkge1xuICAgIHJldHVybiB7XG4gICAgICBrZXk6IHRoaXMua2V5LFxuICAgICAgcmVhY3RpdmU6IHRoaXMucmVhY3RpdmUsXG4gICAgICBjb21wb25lbnRzOiB7XG4gICAgICAgIGluY2x1ZGVkOiB0aGlzLkNvbXBvbmVudHMubWFwKEMgPT4gQy5uYW1lKSxcbiAgICAgICAgbm90OiB0aGlzLk5vdENvbXBvbmVudHMubWFwKEMgPT4gQy5uYW1lKVxuICAgICAgfSxcbiAgICAgIG51bUVudGl0aWVzOiB0aGlzLmVudGl0aWVzLmxlbmd0aFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHN0YXRzIGZvciB0aGlzIHF1ZXJ5XG4gICAqL1xuICBzdGF0cygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbnVtQ29tcG9uZW50czogdGhpcy5Db21wb25lbnRzLmxlbmd0aCxcbiAgICAgIG51bUVudGl0aWVzOiB0aGlzLmVudGl0aWVzLmxlbmd0aFxuICAgIH07XG4gIH1cbn1cblxuUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCA9IFwiUXVlcnkjRU5USVRZX0FEREVEXCI7XG5RdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQgPSBcIlF1ZXJ5I0VOVElUWV9SRU1PVkVEXCI7XG5RdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQgPSBcIlF1ZXJ5I0NPTVBPTkVOVF9DSEFOR0VEXCI7XG4iLCJpbXBvcnQgUXVlcnkgZnJvbSBcIi4vUXVlcnkuanNcIjtcbmltcG9ydCB3cmFwSW1tdXRhYmxlQ29tcG9uZW50IGZyb20gXCIuL1dyYXBJbW11dGFibGVDb21wb25lbnQuanNcIjtcblxuLy8gQHRvZG8gVGFrZSB0aGlzIG91dCBmcm9tIHRoZXJlIG9yIHVzZSBFTlZcbmNvbnN0IERFQlVHID0gZmFsc2U7XG5cbnZhciBuZXh0SWQgPSAwO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFbnRpdHkge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMuX3dvcmxkID0gd29ybGQgfHwgbnVsbDtcblxuICAgIC8vIFVuaXF1ZSBJRCBmb3IgdGhpcyBlbnRpdHlcbiAgICB0aGlzLmlkID0gbmV4dElkKys7XG5cbiAgICAvLyBMaXN0IG9mIGNvbXBvbmVudHMgdHlwZXMgdGhlIGVudGl0eSBoYXNcbiAgICB0aGlzLl9Db21wb25lbnRUeXBlcyA9IFtdO1xuXG4gICAgLy8gSW5zdGFuY2Ugb2YgdGhlIGNvbXBvbmVudHNcbiAgICB0aGlzLl9jb21wb25lbnRzID0ge307XG5cbiAgICB0aGlzLl9jb21wb25lbnRzVG9SZW1vdmUgPSB7fTtcblxuICAgIC8vIFF1ZXJpZXMgd2hlcmUgdGhlIGVudGl0eSBpcyBhZGRlZFxuICAgIHRoaXMucXVlcmllcyA9IFtdO1xuXG4gICAgLy8gVXNlZCBmb3IgZGVmZXJyZWQgcmVtb3ZhbFxuICAgIHRoaXMuX0NvbXBvbmVudFR5cGVzVG9SZW1vdmUgPSBbXTtcblxuICAgIHRoaXMuYWxpdmUgPSBmYWxzZTtcbiAgfVxuXG4gIC8vIENPTVBPTkVOVFNcblxuICBnZXRDb21wb25lbnQoQ29tcG9uZW50LCBpbmNsdWRlUmVtb3ZlZCkge1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXTtcblxuICAgIGlmICghY29tcG9uZW50ICYmIGluY2x1ZGVSZW1vdmVkID09PSB0cnVlKSB7XG4gICAgICBjb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnRzVG9SZW1vdmVbQ29tcG9uZW50Lm5hbWVdO1xuICAgIH1cblxuICAgIHJldHVybiBERUJVRyA/IHdyYXBJbW11dGFibGVDb21wb25lbnQoQ29tcG9uZW50LCBjb21wb25lbnQpIDogY29tcG9uZW50O1xuICB9XG5cbiAgZ2V0UmVtb3ZlZENvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICByZXR1cm4gdGhpcy5fY29tcG9uZW50c1RvUmVtb3ZlW0NvbXBvbmVudC5uYW1lXTtcbiAgfVxuXG4gIGdldENvbXBvbmVudHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudHM7XG4gIH1cblxuICBnZXRDb21wb25lbnRzVG9SZW1vdmUoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudHNUb1JlbW92ZTtcbiAgfVxuXG4gIGdldENvbXBvbmVudFR5cGVzKCkge1xuICAgIHJldHVybiB0aGlzLl9Db21wb25lbnRUeXBlcztcbiAgfVxuXG4gIGdldE11dGFibGVDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IHRoaXMuX2NvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5xdWVyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaV07XG4gICAgICAvLyBAdG9kbyBhY2NlbGVyYXRlIHRoaXMgY2hlY2suIE1heWJlIGhhdmluZyBxdWVyeS5fQ29tcG9uZW50cyBhcyBhbiBvYmplY3RcbiAgICAgIGlmIChxdWVyeS5yZWFjdGl2ZSAmJiBxdWVyeS5Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAhPT0gLTEpIHtcbiAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoXG4gICAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgY29tcG9uZW50XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjb21wb25lbnQ7XG4gIH1cblxuICBhZGRDb21wb25lbnQoQ29tcG9uZW50LCB2YWx1ZXMpIHtcbiAgICB0aGlzLl93b3JsZC5lbnRpdHlBZGRDb21wb25lbnQodGhpcywgQ29tcG9uZW50LCB2YWx1ZXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcmVtb3ZlQ29tcG9uZW50KENvbXBvbmVudCwgZm9yY2VSZW1vdmUpIHtcbiAgICB0aGlzLl93b3JsZC5lbnRpdHlSZW1vdmVDb21wb25lbnQodGhpcywgQ29tcG9uZW50LCBmb3JjZVJlbW92ZSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBoYXNDb21wb25lbnQoQ29tcG9uZW50LCBpbmNsdWRlUmVtb3ZlZCkge1xuICAgIHJldHVybiAoXG4gICAgICAhIX50aGlzLl9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCkgfHxcbiAgICAgIChpbmNsdWRlUmVtb3ZlZCA9PT0gdHJ1ZSAmJiB0aGlzLmhhc1JlbW92ZWRDb21wb25lbnQoQ29tcG9uZW50KSlcbiAgICApO1xuICB9XG5cbiAgaGFzUmVtb3ZlZENvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICByZXR1cm4gISF+dGhpcy5fQ29tcG9uZW50VHlwZXNUb1JlbW92ZS5pbmRleE9mKENvbXBvbmVudCk7XG4gIH1cblxuICBoYXNBbGxDb21wb25lbnRzKENvbXBvbmVudHMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IENvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICghdGhpcy5oYXNDb21wb25lbnQoQ29tcG9uZW50c1tpXSkpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBoYXNBbnlDb21wb25lbnRzKENvbXBvbmVudHMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IENvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLmhhc0NvbXBvbmVudChDb21wb25lbnRzW2ldKSkgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJlbW92ZUFsbENvbXBvbmVudHMoZm9yY2VSZW1vdmUpIHtcbiAgICByZXR1cm4gdGhpcy5fd29ybGQuZW50aXR5UmVtb3ZlQWxsQ29tcG9uZW50cyh0aGlzLCBmb3JjZVJlbW92ZSk7XG4gIH1cblxuICAvLyBFWFRSQVNcblxuICAvLyBJbml0aWFsaXplIHRoZSBlbnRpdHkuIFRvIGJlIHVzZWQgd2hlbiByZXR1cm5pbmcgYW4gZW50aXR5IHRvIHRoZSBwb29sXG4gIHJlc2V0KCkge1xuICAgIHRoaXMuaWQgPSBuZXh0SWQrKztcbiAgICB0aGlzLl93b3JsZCA9IG51bGw7XG4gICAgdGhpcy5fQ29tcG9uZW50VHlwZXMubGVuZ3RoID0gMDtcbiAgICB0aGlzLnF1ZXJpZXMubGVuZ3RoID0gMDtcbiAgICB0aGlzLl9jb21wb25lbnRzID0ge307XG4gIH1cblxuICByZW1vdmUoZm9yY2VSZW1vdmUpIHtcbiAgICByZXR1cm4gdGhpcy5fd29ybGQucmVtb3ZlRW50aXR5KHRoaXMsIGZvcmNlUmVtb3ZlKTtcbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgT2JqZWN0UG9vbCB7XG4gIC8vIEB0b2RvIEFkZCBpbml0aWFsIHNpemVcbiAgY29uc3RydWN0b3IoVCwgaW5pdGlhbFNpemUpIHtcbiAgICB0aGlzLmZyZWVMaXN0ID0gW107XG4gICAgdGhpcy5jb3VudCA9IDA7XG4gICAgdGhpcy5UID0gVDtcbiAgICB0aGlzLmlzT2JqZWN0UG9vbCA9IHRydWU7XG5cbiAgICB2YXIgZXh0cmFBcmdzID0gbnVsbDtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGV4dHJhQXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICBleHRyYUFyZ3Muc2hpZnQoKTtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0ZUVsZW1lbnQgPSBleHRyYUFyZ3NcbiAgICAgID8gKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgVCguLi5leHRyYUFyZ3MpO1xuICAgICAgICB9XG4gICAgICA6ICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFQoKTtcbiAgICAgICAgfTtcblxuICAgIGlmICh0eXBlb2YgaW5pdGlhbFNpemUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHRoaXMuZXhwYW5kKGluaXRpYWxTaXplKTtcbiAgICB9XG4gIH1cblxuICBhcXVpcmUoKSB7XG4gICAgLy8gR3JvdyB0aGUgbGlzdCBieSAyMCVpc2ggaWYgd2UncmUgb3V0XG4gICAgaWYgKHRoaXMuZnJlZUxpc3QubGVuZ3RoIDw9IDApIHtcbiAgICAgIHRoaXMuZXhwYW5kKE1hdGgucm91bmQodGhpcy5jb3VudCAqIDAuMikgKyAxKTtcbiAgICB9XG5cbiAgICB2YXIgaXRlbSA9IHRoaXMuZnJlZUxpc3QucG9wKCk7XG5cbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuXG4gIHJlbGVhc2UoaXRlbSkge1xuICAgIGl0ZW0ucmVzZXQoKTtcbiAgICB0aGlzLmZyZWVMaXN0LnB1c2goaXRlbSk7XG4gIH1cblxuICBleHBhbmQoY291bnQpIHtcbiAgICBmb3IgKHZhciBuID0gMDsgbiA8IGNvdW50OyBuKyspIHtcbiAgICAgIHRoaXMuZnJlZUxpc3QucHVzaCh0aGlzLmNyZWF0ZUVsZW1lbnQoKSk7XG4gICAgfVxuICAgIHRoaXMuY291bnQgKz0gY291bnQ7XG4gIH1cblxuICB0b3RhbFNpemUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY291bnQ7XG4gIH1cblxuICB0b3RhbEZyZWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuZnJlZUxpc3QubGVuZ3RoO1xuICB9XG5cbiAgdG90YWxVc2VkKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50IC0gdGhpcy5mcmVlTGlzdC5sZW5ndGg7XG4gIH1cbn1cbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuaW1wb3J0IHsgcXVlcnlLZXkgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG4vKipcbiAqIEBwcml2YXRlXG4gKiBAY2xhc3MgUXVlcnlNYW5hZ2VyXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFF1ZXJ5TWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy5fd29ybGQgPSB3b3JsZDtcblxuICAgIC8vIFF1ZXJpZXMgaW5kZXhlZCBieSBhIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgY29tcG9uZW50cyBpdCBoYXNcbiAgICB0aGlzLl9xdWVyaWVzID0ge307XG4gIH1cblxuICBvbkVudGl0eVJlbW92ZWQoZW50aXR5KSB7XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgIGlmIChlbnRpdHkucXVlcmllcy5pbmRleE9mKHF1ZXJ5KSAhPT0gLTEpIHtcbiAgICAgICAgcXVlcnkucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdoZW4gYSBjb21wb25lbnQgaXMgYWRkZWQgdG8gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRoYXQganVzdCBnb3QgdGhlIG5ldyBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgYWRkZWQgdG8gdGhlIGVudGl0eVxuICAgKi9cbiAgb25FbnRpdHlDb21wb25lbnRBZGRlZChlbnRpdHksIENvbXBvbmVudCkge1xuICAgIC8vIEB0b2RvIFVzZSBiaXRtYXNrIGZvciBjaGVja2luZyBjb21wb25lbnRzP1xuXG4gICAgLy8gQ2hlY2sgZWFjaCBpbmRleGVkIHF1ZXJ5IHRvIHNlZSBpZiB3ZSBuZWVkIHRvIGFkZCB0aGlzIGVudGl0eSB0byB0aGUgbGlzdFxuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIGlmIChcbiAgICAgICAgISF+cXVlcnkuTm90Q29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgICAgfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIHF1ZXJ5LnJlbW92ZUVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIHRoZSBlbnRpdHkgb25seSBpZjpcbiAgICAgIC8vIENvbXBvbmVudCBpcyBpbiB0aGUgcXVlcnlcbiAgICAgIC8vIGFuZCBFbnRpdHkgaGFzIEFMTCB0aGUgY29tcG9uZW50cyBvZiB0aGUgcXVlcnlcbiAgICAgIC8vIGFuZCBFbnRpdHkgaXMgbm90IGFscmVhZHkgaW4gdGhlIHF1ZXJ5XG4gICAgICBpZiAoXG4gICAgICAgICF+cXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgfHxcbiAgICAgICAgIXF1ZXJ5Lm1hdGNoKGVudGl0eSkgfHxcbiAgICAgICAgfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KVxuICAgICAgKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgcXVlcnkuYWRkRW50aXR5KGVudGl0eSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdoZW4gYSBjb21wb25lbnQgaXMgcmVtb3ZlZCBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBmcm9tXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIG9uRW50aXR5Q29tcG9uZW50UmVtb3ZlZChlbnRpdHksIENvbXBvbmVudCkge1xuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIGlmIChcbiAgICAgICAgISF+cXVlcnkuTm90Q29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgICAgIX5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSkgJiZcbiAgICAgICAgcXVlcnkubWF0Y2goZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIHF1ZXJ5LmFkZEVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICAhIX5xdWVyeS5Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgICAhIX5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSkgJiZcbiAgICAgICAgIXF1ZXJ5Lm1hdGNoKGVudGl0eSlcbiAgICAgICkge1xuICAgICAgICBxdWVyeS5yZW1vdmVFbnRpdHkoZW50aXR5KTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHF1ZXJ5IGZvciB0aGUgc3BlY2lmaWVkIGNvbXBvbmVudHNcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudHMgQ29tcG9uZW50cyB0aGF0IHRoZSBxdWVyeSBzaG91bGQgaGF2ZVxuICAgKi9cbiAgZ2V0UXVlcnkoQ29tcG9uZW50cykge1xuICAgIHZhciBrZXkgPSBxdWVyeUtleShDb21wb25lbnRzKTtcbiAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW2tleV07XG4gICAgaWYgKCFxdWVyeSkge1xuICAgICAgdGhpcy5fcXVlcmllc1trZXldID0gcXVlcnkgPSBuZXcgUXVlcnkoQ29tcG9uZW50cywgdGhpcy5fd29ybGQpO1xuICAgIH1cbiAgICByZXR1cm4gcXVlcnk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHNvbWUgc3RhdHMgZnJvbSB0aGlzIGNsYXNzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7fTtcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgc3RhdHNbcXVlcnlOYW1lXSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXS5zdGF0cygpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cbiIsImV4cG9ydCBjbGFzcyBTeXN0ZW1TdGF0ZUNvbXBvbmVudCB7fVxuXG5TeXN0ZW1TdGF0ZUNvbXBvbmVudC5pc1N5c3RlbVN0YXRlQ29tcG9uZW50ID0gdHJ1ZTtcbiIsImltcG9ydCBFbnRpdHkgZnJvbSBcIi4vRW50aXR5LmpzXCI7XG5pbXBvcnQgT2JqZWN0UG9vbCBmcm9tIFwiLi9PYmplY3RQb29sLmpzXCI7XG5pbXBvcnQgUXVlcnlNYW5hZ2VyIGZyb20gXCIuL1F1ZXJ5TWFuYWdlci5qc1wiO1xuaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcbmltcG9ydCB7IGNvbXBvbmVudFByb3BlcnR5TmFtZSwgZ2V0TmFtZSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5pbXBvcnQgeyBTeXN0ZW1TdGF0ZUNvbXBvbmVudCB9IGZyb20gXCIuL1N5c3RlbVN0YXRlQ29tcG9uZW50LmpzXCI7XG5cbi8qKlxuICogQHByaXZhdGVcbiAqIEBjbGFzcyBFbnRpdHlNYW5hZ2VyXG4gKi9cbmV4cG9ydCBjbGFzcyBFbnRpdHlNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlciA9IHdvcmxkLmNvbXBvbmVudHNNYW5hZ2VyO1xuXG4gICAgLy8gQWxsIHRoZSBlbnRpdGllcyBpbiB0aGlzIGluc3RhbmNlXG4gICAgdGhpcy5fZW50aXRpZXMgPSBbXTtcblxuICAgIHRoaXMuX3F1ZXJ5TWFuYWdlciA9IG5ldyBRdWVyeU1hbmFnZXIodGhpcyk7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG4gICAgdGhpcy5fZW50aXR5UG9vbCA9IG5ldyBPYmplY3RQb29sKEVudGl0eSk7XG5cbiAgICAvLyBEZWZlcnJlZCBkZWxldGlvblxuICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlID0gW107XG4gICAgdGhpcy5lbnRpdGllc1RvUmVtb3ZlID0gW107XG4gICAgdGhpcy5kZWZlcnJlZFJlbW92YWxFbmFibGVkID0gdHJ1ZTtcblxuICAgIHRoaXMubnVtU3RhdGVDb21wb25lbnRzID0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgZW50aXR5XG4gICAqL1xuICBjcmVhdGVFbnRpdHkoKSB7XG4gICAgdmFyIGVudGl0eSA9IHRoaXMuX2VudGl0eVBvb2wuYXF1aXJlKCk7XG4gICAgZW50aXR5LmFsaXZlID0gdHJ1ZTtcbiAgICBlbnRpdHkuX3dvcmxkID0gdGhpcztcbiAgICB0aGlzLl9lbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChFTlRJVFlfQ1JFQVRFRCwgZW50aXR5KTtcbiAgICByZXR1cm4gZW50aXR5O1xuICB9XG5cbiAgLy8gQ09NUE9ORU5UU1xuXG4gIC8qKlxuICAgKiBBZGQgYSBjb21wb25lbnQgdG8gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHdoZXJlIHRoZSBjb21wb25lbnQgd2lsbCBiZSBhZGRlZFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCB0byBiZSBhZGRlZCB0byB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZXMgT3B0aW9uYWwgdmFsdWVzIHRvIHJlcGxhY2UgdGhlIGRlZmF1bHQgYXR0cmlidXRlc1xuICAgKi9cbiAgZW50aXR5QWRkQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50LCB2YWx1ZXMpIHtcbiAgICBpZiAofmVudGl0eS5fQ29tcG9uZW50VHlwZXMuaW5kZXhPZihDb21wb25lbnQpKSByZXR1cm47XG5cbiAgICBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLnB1c2goQ29tcG9uZW50KTtcblxuICAgIGlmIChDb21wb25lbnQuX19wcm90b19fID09PSBTeXN0ZW1TdGF0ZUNvbXBvbmVudCkge1xuICAgICAgdGhpcy5udW1TdGF0ZUNvbXBvbmVudHMrKztcbiAgICB9XG5cbiAgICB2YXIgY29tcG9uZW50UG9vbCA9IHRoaXMud29ybGQuY29tcG9uZW50c01hbmFnZXIuZ2V0Q29tcG9uZW50c1Bvb2woXG4gICAgICBDb21wb25lbnRcbiAgICApO1xuICAgIHZhciBjb21wb25lbnQgPSBjb21wb25lbnRQb29sLmFxdWlyZSgpO1xuXG4gICAgZW50aXR5Ll9jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IGNvbXBvbmVudDtcblxuICAgIGlmICh2YWx1ZXMpIHtcbiAgICAgIGlmIChjb21wb25lbnQuY29weSkge1xuICAgICAgICBjb21wb25lbnQuY29weSh2YWx1ZXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yICh2YXIgbmFtZSBpbiB2YWx1ZXMpIHtcbiAgICAgICAgICBjb21wb25lbnRbbmFtZV0gPSB2YWx1ZXNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIub25FbnRpdHlDb21wb25lbnRBZGRlZChlbnRpdHksIENvbXBvbmVudCk7XG4gICAgdGhpcy53b3JsZC5jb21wb25lbnRzTWFuYWdlci5jb21wb25lbnRBZGRlZFRvRW50aXR5KENvbXBvbmVudCk7XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KENPTVBPTkVOVF9BRERFRCwgZW50aXR5LCBDb21wb25lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIGNvbXBvbmVudCBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB3aGljaCB3aWxsIGdldCByZW1vdmVkIHRoZSBjb21wb25lbnRcbiAgICogQHBhcmFtIHsqfSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtCb29sfSBpbW1lZGlhdGVseSBJZiB5b3Ugd2FudCB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBpbW1lZGlhdGVseSBpbnN0ZWFkIG9mIGRlZmVycmVkIChEZWZhdWx0IGlzIGZhbHNlKVxuICAgKi9cbiAgZW50aXR5UmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50LCBpbW1lZGlhdGVseSkge1xuICAgIHZhciBpbmRleCA9IGVudGl0eS5fQ29tcG9uZW50VHlwZXMuaW5kZXhPZihDb21wb25lbnQpO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KENPTVBPTkVOVF9SRU1PVkUsIGVudGl0eSwgQ29tcG9uZW50KTtcblxuICAgIGlmIChpbW1lZGlhdGVseSkge1xuICAgICAgdGhpcy5fZW50aXR5UmVtb3ZlQ29tcG9uZW50U3luYyhlbnRpdHksIENvbXBvbmVudCwgaW5kZXgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZW50aXR5Ll9Db21wb25lbnRUeXBlc1RvUmVtb3ZlLmxlbmd0aCA9PT0gMClcbiAgICAgICAgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUucHVzaChlbnRpdHkpO1xuXG4gICAgICBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICBlbnRpdHkuX0NvbXBvbmVudFR5cGVzVG9SZW1vdmUucHVzaChDb21wb25lbnQpO1xuXG4gICAgICB2YXIgY29tcG9uZW50TmFtZSA9IGdldE5hbWUoQ29tcG9uZW50KTtcbiAgICAgIGVudGl0eS5fY29tcG9uZW50c1RvUmVtb3ZlW2NvbXBvbmVudE5hbWVdID1cbiAgICAgICAgZW50aXR5Ll9jb21wb25lbnRzW2NvbXBvbmVudE5hbWVdO1xuICAgICAgZGVsZXRlIGVudGl0eS5fY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBlYWNoIGluZGV4ZWQgcXVlcnkgdG8gc2VlIGlmIHdlIG5lZWQgdG8gcmVtb3ZlIGl0XG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5Q29tcG9uZW50UmVtb3ZlZChlbnRpdHksIENvbXBvbmVudCk7XG5cbiAgICBpZiAoQ29tcG9uZW50Ll9fcHJvdG9fXyA9PT0gU3lzdGVtU3RhdGVDb21wb25lbnQpIHtcbiAgICAgIHRoaXMubnVtU3RhdGVDb21wb25lbnRzLS07XG5cbiAgICAgIC8vIENoZWNrIGlmIHRoZSBlbnRpdHkgd2FzIGEgZ2hvc3Qgd2FpdGluZyBmb3IgdGhlIGxhc3Qgc3lzdGVtIHN0YXRlIGNvbXBvbmVudCB0byBiZSByZW1vdmVkXG4gICAgICBpZiAodGhpcy5udW1TdGF0ZUNvbXBvbmVudHMgPT09IDAgJiYgIWVudGl0eS5hbGl2ZSkge1xuICAgICAgICBlbnRpdHkucmVtb3ZlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2VudGl0eVJlbW92ZUNvbXBvbmVudFN5bmMoZW50aXR5LCBDb21wb25lbnQsIGluZGV4KSB7XG4gICAgLy8gUmVtb3ZlIFQgbGlzdGluZyBvbiBlbnRpdHkgYW5kIHByb3BlcnR5IHJlZiwgdGhlbiBmcmVlIHRoZSBjb21wb25lbnQuXG4gICAgZW50aXR5Ll9Db21wb25lbnRUeXBlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIHZhciBwcm9wTmFtZSA9IGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpO1xuICAgIHZhciBjb21wb25lbnROYW1lID0gZ2V0TmFtZShDb21wb25lbnQpO1xuICAgIHZhciBjb21wb25lbnQgPSBlbnRpdHkuX2NvbXBvbmVudHNbY29tcG9uZW50TmFtZV07XG4gICAgZGVsZXRlIGVudGl0eS5fY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLl9jb21wb25lbnRQb29sW3Byb3BOYW1lXS5yZWxlYXNlKGNvbXBvbmVudCk7XG4gICAgdGhpcy53b3JsZC5jb21wb25lbnRzTWFuYWdlci5jb21wb25lbnRSZW1vdmVkRnJvbUVudGl0eShDb21wb25lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbGwgdGhlIGNvbXBvbmVudHMgZnJvbSBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgZnJvbSB3aGljaCB0aGUgY29tcG9uZW50cyB3aWxsIGJlIHJlbW92ZWRcbiAgICovXG4gIGVudGl0eVJlbW92ZUFsbENvbXBvbmVudHMoZW50aXR5LCBpbW1lZGlhdGVseSkge1xuICAgIGxldCBDb21wb25lbnRzID0gZW50aXR5Ll9Db21wb25lbnRUeXBlcztcblxuICAgIGZvciAobGV0IGogPSBDb21wb25lbnRzLmxlbmd0aCAtIDE7IGogPj0gMDsgai0tKSB7XG4gICAgICBpZiAoQ29tcG9uZW50c1tqXS5fX3Byb3RvX18gIT09IFN5c3RlbVN0YXRlQ29tcG9uZW50KVxuICAgICAgICB0aGlzLmVudGl0eVJlbW92ZUNvbXBvbmVudChlbnRpdHksIENvbXBvbmVudHNbal0sIGltbWVkaWF0ZWx5KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBlbnRpdHkgZnJvbSB0aGlzIG1hbmFnZXIuIEl0IHdpbGwgY2xlYXIgYWxzbyBpdHMgY29tcG9uZW50c1xuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0byByZW1vdmUgZnJvbSB0aGUgbWFuYWdlclxuICAgKiBAcGFyYW0ge0Jvb2x9IGltbWVkaWF0ZWx5IElmIHlvdSB3YW50IHRvIHJlbW92ZSB0aGUgY29tcG9uZW50IGltbWVkaWF0ZWx5IGluc3RlYWQgb2YgZGVmZXJyZWQgKERlZmF1bHQgaXMgZmFsc2UpXG4gICAqL1xuICByZW1vdmVFbnRpdHkoZW50aXR5LCBpbW1lZGlhdGVseSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuX2VudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcblxuICAgIGlmICghfmluZGV4KSB0aHJvdyBuZXcgRXJyb3IoXCJUcmllZCB0byByZW1vdmUgZW50aXR5IG5vdCBpbiBsaXN0XCIpO1xuXG4gICAgZW50aXR5LmFsaXZlID0gZmFsc2U7XG5cbiAgICBpZiAodGhpcy5udW1TdGF0ZUNvbXBvbmVudHMgPT09IDApIHtcbiAgICAgIC8vIFJlbW92ZSBmcm9tIGVudGl0eSBsaXN0XG4gICAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KEVOVElUWV9SRU1PVkVELCBlbnRpdHkpO1xuICAgICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5UmVtb3ZlZChlbnRpdHkpO1xuICAgICAgaWYgKGltbWVkaWF0ZWx5ID09PSB0cnVlKSB7XG4gICAgICAgIHRoaXMuX3JlbGVhc2VFbnRpdHkoZW50aXR5LCBpbmRleCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUucHVzaChlbnRpdHkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuZW50aXR5UmVtb3ZlQWxsQ29tcG9uZW50cyhlbnRpdHksIGltbWVkaWF0ZWx5KTtcbiAgfVxuXG4gIF9yZWxlYXNlRW50aXR5KGVudGl0eSwgaW5kZXgpIHtcbiAgICB0aGlzLl9lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgLy8gUHJldmVudCBhbnkgYWNjZXNzIGFuZCBmcmVlXG4gICAgZW50aXR5Ll93b3JsZCA9IG51bGw7XG4gICAgdGhpcy5fZW50aXR5UG9vbC5yZWxlYXNlKGVudGl0eSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCBlbnRpdGllcyBmcm9tIHRoaXMgbWFuYWdlclxuICAgKi9cbiAgcmVtb3ZlQWxsRW50aXRpZXMoKSB7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMuX2VudGl0aWVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB0aGlzLnJlbW92ZUVudGl0eSh0aGlzLl9lbnRpdGllc1tpXSk7XG4gICAgfVxuICB9XG5cbiAgcHJvY2Vzc0RlZmVycmVkUmVtb3ZhbCgpIHtcbiAgICBpZiAoIXRoaXMuZGVmZXJyZWRSZW1vdmFsRW5hYmxlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5lbnRpdGllc1RvUmVtb3ZlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgZW50aXR5ID0gdGhpcy5lbnRpdGllc1RvUmVtb3ZlW2ldO1xuICAgICAgbGV0IGluZGV4ID0gdGhpcy5fZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuICAgICAgdGhpcy5fcmVsZWFzZUVudGl0eShlbnRpdHksIGluZGV4KTtcbiAgICB9XG4gICAgdGhpcy5lbnRpdGllc1RvUmVtb3ZlLmxlbmd0aCA9IDA7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgZW50aXR5ID0gdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmVbaV07XG4gICAgICB3aGlsZSAoZW50aXR5Ll9Db21wb25lbnRUeXBlc1RvUmVtb3ZlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbGV0IENvbXBvbmVudCA9IGVudGl0eS5fQ29tcG9uZW50VHlwZXNUb1JlbW92ZS5wb3AoKTtcblxuICAgICAgICB2YXIgcHJvcE5hbWUgPSBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KTtcbiAgICAgICAgdmFyIGNvbXBvbmVudE5hbWUgPSBnZXROYW1lKENvbXBvbmVudCk7XG4gICAgICAgIHZhciBjb21wb25lbnQgPSBlbnRpdHkuX2NvbXBvbmVudHNUb1JlbW92ZVtjb21wb25lbnROYW1lXTtcbiAgICAgICAgZGVsZXRlIGVudGl0eS5fY29tcG9uZW50c1RvUmVtb3ZlW2NvbXBvbmVudE5hbWVdO1xuICAgICAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLl9jb21wb25lbnRQb29sW3Byb3BOYW1lXS5yZWxlYXNlKGNvbXBvbmVudCk7XG4gICAgICAgIHRoaXMud29ybGQuY29tcG9uZW50c01hbmFnZXIuY29tcG9uZW50UmVtb3ZlZEZyb21FbnRpdHkoQ29tcG9uZW50KTtcblxuICAgICAgICAvL3RoaXMuX2VudGl0eVJlbW92ZUNvbXBvbmVudFN5bmMoZW50aXR5LCBDb21wb25lbnQsIGluZGV4KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZS5sZW5ndGggPSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHF1ZXJ5IGJhc2VkIG9uIGEgbGlzdCBvZiBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBMaXN0IG9mIGNvbXBvbmVudHMgdGhhdCB3aWxsIGZvcm0gdGhlIHF1ZXJ5XG4gICAqL1xuICBxdWVyeUNvbXBvbmVudHMoQ29tcG9uZW50cykge1xuICAgIHJldHVybiB0aGlzLl9xdWVyeU1hbmFnZXIuZ2V0UXVlcnkoQ29tcG9uZW50cyk7XG4gIH1cblxuICAvLyBFWFRSQVNcblxuICAvKipcbiAgICogUmV0dXJuIG51bWJlciBvZiBlbnRpdGllc1xuICAgKi9cbiAgY291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2VudGl0aWVzLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc29tZSBzdGF0c1xuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge1xuICAgICAgbnVtRW50aXRpZXM6IHRoaXMuX2VudGl0aWVzLmxlbmd0aCxcbiAgICAgIG51bVF1ZXJpZXM6IE9iamVjdC5rZXlzKHRoaXMuX3F1ZXJ5TWFuYWdlci5fcXVlcmllcykubGVuZ3RoLFxuICAgICAgcXVlcmllczogdGhpcy5fcXVlcnlNYW5hZ2VyLnN0YXRzKCksXG4gICAgICBudW1Db21wb25lbnRQb29sOiBPYmplY3Qua2V5cyh0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLl9jb21wb25lbnRQb29sKVxuICAgICAgICAubGVuZ3RoLFxuICAgICAgY29tcG9uZW50UG9vbDoge30sXG4gICAgICBldmVudERpc3BhdGNoZXI6IHRoaXMuZXZlbnREaXNwYXRjaGVyLnN0YXRzXG4gICAgfTtcblxuICAgIGZvciAodmFyIGNuYW1lIGluIHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2wpIHtcbiAgICAgIHZhciBwb29sID0gdGhpcy5jb21wb25lbnRzTWFuYWdlci5fY29tcG9uZW50UG9vbFtjbmFtZV07XG4gICAgICBzdGF0cy5jb21wb25lbnRQb29sW2NuYW1lXSA9IHtcbiAgICAgICAgdXNlZDogcG9vbC50b3RhbFVzZWQoKSxcbiAgICAgICAgc2l6ZTogcG9vbC5jb3VudFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cblxuY29uc3QgRU5USVRZX0NSRUFURUQgPSBcIkVudGl0eU1hbmFnZXIjRU5USVRZX0NSRUFURVwiO1xuY29uc3QgRU5USVRZX1JFTU9WRUQgPSBcIkVudGl0eU1hbmFnZXIjRU5USVRZX1JFTU9WRURcIjtcbmNvbnN0IENPTVBPTkVOVF9BRERFRCA9IFwiRW50aXR5TWFuYWdlciNDT01QT05FTlRfQURERURcIjtcbmNvbnN0IENPTVBPTkVOVF9SRU1PVkUgPSBcIkVudGl0eU1hbmFnZXIjQ09NUE9ORU5UX1JFTU9WRVwiO1xuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgRHVtbXlPYmplY3RQb29sIHtcbiAgY29uc3RydWN0b3IoVCkge1xuICAgIHRoaXMuaXNEdW1teU9iamVjdFBvb2wgPSB0cnVlO1xuICAgIHRoaXMuY291bnQgPSAwO1xuICAgIHRoaXMudXNlZCA9IDA7XG4gICAgdGhpcy5UID0gVDtcbiAgfVxuXG4gIGFxdWlyZSgpIHtcbiAgICB0aGlzLnVzZWQrKztcbiAgICB0aGlzLmNvdW50Kys7XG4gICAgcmV0dXJuIG5ldyB0aGlzLlQoKTtcbiAgfVxuXG4gIHJlbGVhc2UoKSB7XG4gICAgdGhpcy51c2VkLS07XG4gIH1cblxuICB0b3RhbFNpemUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY291bnQ7XG4gIH1cblxuICB0b3RhbEZyZWUoKSB7XG4gICAgcmV0dXJuIEluZmluaXR5O1xuICB9XG5cbiAgdG90YWxVc2VkKCkge1xuICAgIHJldHVybiB0aGlzLnVzZWQ7XG4gIH1cbn1cbiIsImltcG9ydCBPYmplY3RQb29sIGZyb20gXCIuL09iamVjdFBvb2wuanNcIjtcbmltcG9ydCBEdW1teU9iamVjdFBvb2wgZnJvbSBcIi4vRHVtbXlPYmplY3RQb29sLmpzXCI7XG5pbXBvcnQgeyBjb21wb25lbnRQcm9wZXJ0eU5hbWUgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG5leHBvcnQgY2xhc3MgQ29tcG9uZW50TWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuQ29tcG9uZW50cyA9IHt9O1xuICAgIHRoaXMuX2NvbXBvbmVudFBvb2wgPSB7fTtcbiAgICB0aGlzLm51bUNvbXBvbmVudHMgPSB7fTtcbiAgfVxuXG4gIHJlZ2lzdGVyQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIGlmICh0aGlzLkNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdKSB7XG4gICAgICBjb25zb2xlLndhcm4oYENvbXBvbmVudCB0eXBlOiAnJHtDb21wb25lbnQubmFtZX0nIGFscmVhZHkgcmVnaXN0ZXJlZC5gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLkNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gQ29tcG9uZW50O1xuICAgIHRoaXMubnVtQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSAwO1xuICB9XG5cbiAgY29tcG9uZW50QWRkZWRUb0VudGl0eShDb21wb25lbnQpIHtcbiAgICBpZiAoIXRoaXMuQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0pIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KTtcbiAgICB9XG5cbiAgICB0aGlzLm51bUNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdKys7XG4gIH1cblxuICBjb21wb25lbnRSZW1vdmVkRnJvbUVudGl0eShDb21wb25lbnQpIHtcbiAgICB0aGlzLm51bUNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdLS07XG4gIH1cblxuICBnZXRDb21wb25lbnRzUG9vbChDb21wb25lbnQpIHtcbiAgICB2YXIgY29tcG9uZW50TmFtZSA9IGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpO1xuXG4gICAgaWYgKCF0aGlzLl9jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdKSB7XG4gICAgICBpZiAoQ29tcG9uZW50LnByb3RvdHlwZS5yZXNldCkge1xuICAgICAgICB0aGlzLl9jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdID0gbmV3IE9iamVjdFBvb2woQ29tcG9uZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBgQ29tcG9uZW50ICcke0NvbXBvbmVudC5uYW1lfScgd29uJ3QgYmVuZWZpdCBmcm9tIHBvb2xpbmcgYmVjYXVzZSAncmVzZXQnIG1ldGhvZCB3YXMgbm90IGltcGxlbWVudGVkLmBcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXSA9IG5ldyBEdW1teU9iamVjdFBvb2woQ29tcG9uZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXTtcbiAgfVxufVxuIiwiaW1wb3J0IHBqc29uIGZyb20gXCIuLi9wYWNrYWdlLmpzb25cIjtcbmV4cG9ydCBjb25zdCBWZXJzaW9uID0gcGpzb24udmVyc2lvbjtcbiIsImltcG9ydCB7IFN5c3RlbU1hbmFnZXIgfSBmcm9tIFwiLi9TeXN0ZW1NYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBFbnRpdHlNYW5hZ2VyIH0gZnJvbSBcIi4vRW50aXR5TWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgQ29tcG9uZW50TWFuYWdlciB9IGZyb20gXCIuL0NvbXBvbmVudE1hbmFnZXIuanNcIjtcbmltcG9ydCB7IFZlcnNpb24gfSBmcm9tIFwiLi9WZXJzaW9uLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBXb3JsZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIgPSBuZXcgQ29tcG9uZW50TWFuYWdlcih0aGlzKTtcbiAgICB0aGlzLmVudGl0eU1hbmFnZXIgPSBuZXcgRW50aXR5TWFuYWdlcih0aGlzKTtcbiAgICB0aGlzLnN5c3RlbU1hbmFnZXIgPSBuZXcgU3lzdGVtTWFuYWdlcih0aGlzKTtcblxuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cbiAgICB0aGlzLmV2ZW50UXVldWVzID0ge307XG5cbiAgICBpZiAodHlwZW9mIEN1c3RvbUV2ZW50ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICB2YXIgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoXCJlY3N5LXdvcmxkLWNyZWF0ZWRcIiwge1xuICAgICAgICBkZXRhaWw6IHsgd29ybGQ6IHRoaXMsIHZlcnNpb246IFZlcnNpb24gfVxuICAgICAgfSk7XG4gICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChldmVudCk7XG4gICAgfVxuXG4gICAgdGhpcy5sYXN0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICB9XG5cbiAgcmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5yZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtLCBhdHRyaWJ1dGVzKSB7XG4gICAgdGhpcy5zeXN0ZW1NYW5hZ2VyLnJlZ2lzdGVyU3lzdGVtKFN5c3RlbSwgYXR0cmlidXRlcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBnZXRTeXN0ZW0oU3lzdGVtQ2xhc3MpIHtcbiAgICByZXR1cm4gdGhpcy5zeXN0ZW1NYW5hZ2VyLmdldFN5c3RlbShTeXN0ZW1DbGFzcyk7XG4gIH1cblxuICBnZXRTeXN0ZW1zKCkge1xuICAgIHJldHVybiB0aGlzLnN5c3RlbU1hbmFnZXIuZ2V0U3lzdGVtcygpO1xuICB9XG5cbiAgZXhlY3V0ZShkZWx0YSwgdGltZSkge1xuICAgIGlmICghZGVsdGEpIHtcbiAgICAgIGxldCB0aW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBkZWx0YSA9IHRpbWUgLSB0aGlzLmxhc3RUaW1lO1xuICAgICAgdGhpcy5sYXN0VGltZSA9IHRpbWU7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZW5hYmxlZCkge1xuICAgICAgdGhpcy5zeXN0ZW1NYW5hZ2VyLmV4ZWN1dGUoZGVsdGEsIHRpbWUpO1xuICAgICAgdGhpcy5lbnRpdHlNYW5hZ2VyLnByb2Nlc3NEZWZlcnJlZFJlbW92YWwoKTtcbiAgICB9XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICB9XG5cbiAgcGxheSgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuICB9XG5cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLmVudGl0eU1hbmFnZXIuY3JlYXRlRW50aXR5KCk7XG4gIH1cblxuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBlbnRpdGllczogdGhpcy5lbnRpdHlNYW5hZ2VyLnN0YXRzKCksXG4gICAgICBzeXN0ZW06IHRoaXMuc3lzdGVtTWFuYWdlci5zdGF0cygpXG4gICAgfTtcblxuICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHN0YXRzLCBudWxsLCAyKSk7XG4gIH1cbn1cbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgU3lzdGVtIHtcbiAgY2FuRXhlY3V0ZSgpIHtcbiAgICBpZiAodGhpcy5fbWFuZGF0b3J5UXVlcmllcy5sZW5ndGggPT09IDApIHJldHVybiB0cnVlO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzW2ldO1xuICAgICAgaWYgKHF1ZXJ5LmVudGl0aWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcih3b3JsZCwgYXR0cmlidXRlcykge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgLy8gQHRvZG8gQmV0dGVyIG5hbWluZyA6KVxuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgICB0aGlzLnF1ZXJpZXMgPSB7fTtcblxuICAgIHRoaXMucHJpb3JpdHkgPSAwO1xuXG4gICAgLy8gVXNlZCBmb3Igc3RhdHNcbiAgICB0aGlzLmV4ZWN1dGVUaW1lID0gMDtcblxuICAgIGlmIChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXMucHJpb3JpdHkpIHtcbiAgICAgIHRoaXMucHJpb3JpdHkgPSBhdHRyaWJ1dGVzLnByaW9yaXR5O1xuICAgIH1cblxuICAgIHRoaXMuX21hbmRhdG9yeVF1ZXJpZXMgPSBbXTtcblxuICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgaWYgKHRoaXMuY29uc3RydWN0b3IucXVlcmllcykge1xuICAgICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuY29uc3RydWN0b3IucXVlcmllcykge1xuICAgICAgICB2YXIgcXVlcnlDb25maWcgPSB0aGlzLmNvbnN0cnVjdG9yLnF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAgdmFyIENvbXBvbmVudHMgPSBxdWVyeUNvbmZpZy5jb21wb25lbnRzO1xuICAgICAgICBpZiAoIUNvbXBvbmVudHMgfHwgQ29tcG9uZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCInY29tcG9uZW50cycgYXR0cmlidXRlIGNhbid0IGJlIGVtcHR5IGluIGEgcXVlcnlcIik7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy53b3JsZC5lbnRpdHlNYW5hZ2VyLnF1ZXJ5Q29tcG9uZW50cyhDb21wb25lbnRzKTtcbiAgICAgICAgdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdID0gcXVlcnk7XG4gICAgICAgIGlmIChxdWVyeUNvbmZpZy5tYW5kYXRvcnkgPT09IHRydWUpIHtcbiAgICAgICAgICB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzLnB1c2gocXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucXVlcmllc1txdWVyeU5hbWVdID0ge1xuICAgICAgICAgIHJlc3VsdHM6IHF1ZXJ5LmVudGl0aWVzXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmVhY3RpdmUgY29uZmlndXJhdGlvbiBhZGRlZC9yZW1vdmVkL2NoYW5nZWRcbiAgICAgICAgdmFyIHZhbGlkRXZlbnRzID0gW1wiYWRkZWRcIiwgXCJyZW1vdmVkXCIsIFwiY2hhbmdlZFwiXTtcblxuICAgICAgICBjb25zdCBldmVudE1hcHBpbmcgPSB7XG4gICAgICAgICAgYWRkZWQ6IFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQsXG4gICAgICAgICAgcmVtb3ZlZDogUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICAgIGNoYW5nZWQ6IFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCAvLyBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0NIQU5HRURcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAocXVlcnlDb25maWcubGlzdGVuKSB7XG4gICAgICAgICAgdmFsaWRFdmVudHMuZm9yRWFjaChldmVudE5hbWUgPT4ge1xuICAgICAgICAgICAgLy8gSXMgdGhlIGV2ZW50IGVuYWJsZWQgb24gdGhpcyBzeXN0ZW0ncyBxdWVyeT9cbiAgICAgICAgICAgIGlmIChxdWVyeUNvbmZpZy5saXN0ZW5bZXZlbnROYW1lXSkge1xuICAgICAgICAgICAgICBsZXQgZXZlbnQgPSBxdWVyeUNvbmZpZy5saXN0ZW5bZXZlbnROYW1lXTtcblxuICAgICAgICAgICAgICBpZiAoZXZlbnROYW1lID09PSBcImNoYW5nZWRcIikge1xuICAgICAgICAgICAgICAgIHF1ZXJ5LnJlYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgIC8vIEFueSBjaGFuZ2Ugb24gdGhlIGVudGl0eSBmcm9tIHRoZSBjb21wb25lbnRzIGluIHRoZSBxdWVyeVxuICAgICAgICAgICAgICAgICAgbGV0IGV2ZW50TGlzdCA9ICh0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXVtldmVudE5hbWVdID0gW10pO1xuICAgICAgICAgICAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyBBdm9pZCBkdXBsaWNhdGVzXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50TGlzdC5pbmRleE9mKGVudGl0eSkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZXZlbnQpKSB7XG4gICAgICAgICAgICAgICAgICBsZXQgZXZlbnRMaXN0ID0gKHRoaXMucXVlcmllc1txdWVyeU5hbWVdW2V2ZW50TmFtZV0gPSBbXSk7XG4gICAgICAgICAgICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICAgICAgICAgICAgICAoZW50aXR5LCBjaGFuZ2VkQ29tcG9uZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8gQXZvaWQgZHVwbGljYXRlc1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LmluZGV4T2YoY2hhbmdlZENvbXBvbmVudC5jb25zdHJ1Y3RvcikgIT09IC0xICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QuaW5kZXhPZihlbnRpdHkpID09PSAtMVxuICAgICAgICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRMaXN0LnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgICAvLyBDaGVja2luZyBqdXN0IHNwZWNpZmljIGNvbXBvbmVudHNcbiAgICAgICAgICAgICAgICAgIGxldCBjaGFuZ2VkTGlzdCA9ICh0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXVtldmVudE5hbWVdID0ge30pO1xuICAgICAgICAgICAgICAgICAgZXZlbnQuZm9yRWFjaChjb21wb25lbnQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgZXZlbnRMaXN0ID0gKGNoYW5nZWRMaXN0W1xuICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFByb3BlcnR5TmFtZShjb21wb25lbnQpXG4gICAgICAgICAgICAgICAgICAgIF0gPSBbXSk7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAgICAgICAoZW50aXR5LCBjaGFuZ2VkQ29tcG9uZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZWRDb21wb25lbnQuY29uc3RydWN0b3IgPT09IGNvbXBvbmVudCAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QuaW5kZXhPZihlbnRpdHkpID09PSAtMVxuICAgICAgICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50TGlzdC5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgZXZlbnRMaXN0ID0gKHRoaXMucXVlcmllc1txdWVyeU5hbWVdW2V2ZW50TmFtZV0gPSBbXSk7XG5cbiAgICAgICAgICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgIGV2ZW50TWFwcGluZ1tldmVudE5hbWVdLFxuICAgICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQGZpeG1lIG92ZXJoZWFkP1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnRMaXN0LmluZGV4T2YoZW50aXR5KSA9PT0gLTEpXG4gICAgICAgICAgICAgICAgICAgICAgZXZlbnRMaXN0LnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHRoaXMuZXhlY3V0ZVRpbWUgPSAwO1xuICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICB9XG5cbiAgcGxheSgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuICB9XG5cbiAgLy8gQHF1ZXN0aW9uIHJlbmFtZSB0byBjbGVhciBxdWV1ZXM/XG4gIGNsZWFyRXZlbnRzKCkge1xuICAgIGZvciAobGV0IHF1ZXJ5TmFtZSBpbiB0aGlzLnF1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMucXVlcmllc1txdWVyeU5hbWVdO1xuICAgICAgaWYgKHF1ZXJ5LmFkZGVkKSB7XG4gICAgICAgIHF1ZXJ5LmFkZGVkLmxlbmd0aCA9IDA7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkucmVtb3ZlZCkge1xuICAgICAgICBxdWVyeS5yZW1vdmVkLmxlbmd0aCA9IDA7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkuY2hhbmdlZCkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShxdWVyeS5jaGFuZ2VkKSkge1xuICAgICAgICAgIHF1ZXJ5LmNoYW5nZWQubGVuZ3RoID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmb3IgKGxldCBuYW1lIGluIHF1ZXJ5LmNoYW5nZWQpIHtcbiAgICAgICAgICAgIHF1ZXJ5LmNoYW5nZWRbbmFtZV0ubGVuZ3RoID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0b0pTT04oKSB7XG4gICAgdmFyIGpzb24gPSB7XG4gICAgICBuYW1lOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICBlbmFibGVkOiB0aGlzLmVuYWJsZWQsXG4gICAgICBleGVjdXRlVGltZTogdGhpcy5leGVjdXRlVGltZSxcbiAgICAgIHByaW9yaXR5OiB0aGlzLnByaW9yaXR5LFxuICAgICAgcXVlcmllczoge31cbiAgICB9O1xuXG4gICAgaWYgKHRoaXMuY29uc3RydWN0b3IucXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJpZXMgPSB0aGlzLmNvbnN0cnVjdG9yLnF1ZXJpZXM7XG4gICAgICBmb3IgKGxldCBxdWVyeU5hbWUgaW4gcXVlcmllcykge1xuICAgICAgICBsZXQgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAgbGV0IHF1ZXJ5RGVmaW5pdGlvbiA9IHF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAgbGV0IGpzb25RdWVyeSA9IChqc29uLnF1ZXJpZXNbcXVlcnlOYW1lXSA9IHtcbiAgICAgICAgICBrZXk6IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXS5rZXlcbiAgICAgICAgfSk7XG5cbiAgICAgICAganNvblF1ZXJ5Lm1hbmRhdG9yeSA9IHF1ZXJ5RGVmaW5pdGlvbi5tYW5kYXRvcnkgPT09IHRydWU7XG4gICAgICAgIGpzb25RdWVyeS5yZWFjdGl2ZSA9XG4gICAgICAgICAgcXVlcnlEZWZpbml0aW9uLmxpc3RlbiAmJlxuICAgICAgICAgIChxdWVyeURlZmluaXRpb24ubGlzdGVuLmFkZGVkID09PSB0cnVlIHx8XG4gICAgICAgICAgICBxdWVyeURlZmluaXRpb24ubGlzdGVuLnJlbW92ZWQgPT09IHRydWUgfHxcbiAgICAgICAgICAgIHF1ZXJ5RGVmaW5pdGlvbi5saXN0ZW4uY2hhbmdlZCA9PT0gdHJ1ZSB8fFxuICAgICAgICAgICAgQXJyYXkuaXNBcnJheShxdWVyeURlZmluaXRpb24ubGlzdGVuLmNoYW5nZWQpKTtcblxuICAgICAgICBpZiAoanNvblF1ZXJ5LnJlYWN0aXZlKSB7XG4gICAgICAgICAganNvblF1ZXJ5Lmxpc3RlbiA9IHt9O1xuXG4gICAgICAgICAgY29uc3QgbWV0aG9kcyA9IFtcImFkZGVkXCIsIFwicmVtb3ZlZFwiLCBcImNoYW5nZWRcIl07XG4gICAgICAgICAgbWV0aG9kcy5mb3JFYWNoKG1ldGhvZCA9PiB7XG4gICAgICAgICAgICBpZiAocXVlcnlbbWV0aG9kXSkge1xuICAgICAgICAgICAgICBqc29uUXVlcnkubGlzdGVuW21ldGhvZF0gPSB7XG4gICAgICAgICAgICAgICAgZW50aXRpZXM6IHF1ZXJ5W21ldGhvZF0ubGVuZ3RoXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ganNvbjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gTm90KENvbXBvbmVudCkge1xuICByZXR1cm4ge1xuICAgIG9wZXJhdG9yOiBcIm5vdFwiLFxuICAgIENvbXBvbmVudDogQ29tcG9uZW50XG4gIH07XG59XG4iLCJleHBvcnQgY2xhc3MgQ29tcG9uZW50IHt9XG5cbkNvbXBvbmVudC5pc0NvbXBvbmVudCA9IHRydWU7XG4iLCJleHBvcnQgY2xhc3MgVGFnQ29tcG9uZW50IHtcbiAgcmVzZXQoKSB7fVxufVxuXG5UYWdDb21wb25lbnQuaXNUYWdDb21wb25lbnQgPSB0cnVlO1xuIiwiZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVR5cGUodHlwZURlZmluaXRpb24pIHtcbiAgdmFyIG1hbmRhdG9yeUZ1bmN0aW9ucyA9IFtcbiAgICBcImNyZWF0ZVwiLFxuICAgIFwicmVzZXRcIixcbiAgICBcImNsZWFyXCJcbiAgICAvKlwiY29weVwiKi9cbiAgXTtcblxuICB2YXIgdW5kZWZpbmVkRnVuY3Rpb25zID0gbWFuZGF0b3J5RnVuY3Rpb25zLmZpbHRlcihmID0+IHtcbiAgICByZXR1cm4gIXR5cGVEZWZpbml0aW9uW2ZdO1xuICB9KTtcblxuICBpZiAodW5kZWZpbmVkRnVuY3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgY3JlYXRlVHlwZSBleHBlY3QgdHlwZSBkZWZpbml0aW9uIHRvIGltcGxlbWVudHMgdGhlIGZvbGxvd2luZyBmdW5jdGlvbnM6ICR7dW5kZWZpbmVkRnVuY3Rpb25zLmpvaW4oXG4gICAgICAgIFwiLCBcIlxuICAgICAgKX1gXG4gICAgKTtcbiAgfVxuXG4gIHR5cGVEZWZpbml0aW9uLmlzVHlwZSA9IHRydWU7XG4gIHJldHVybiB0eXBlRGVmaW5pdGlvbjtcbn1cbiIsImltcG9ydCB7IGNyZWF0ZVR5cGUgfSBmcm9tIFwiLi9DcmVhdGVUeXBlXCI7XG5cbi8qKlxuICogU3RhbmRhcmQgdHlwZXNcbiAqL1xudmFyIFR5cGVzID0ge307XG5cblR5cGVzLk51bWJlciA9IGNyZWF0ZVR5cGUoe1xuICBiYXNlVHlwZTogTnVtYmVyLFxuICBpc1NpbXBsZVR5cGU6IHRydWUsXG4gIGNyZWF0ZTogZGVmYXVsdFZhbHVlID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIGRlZmF1bHRWYWx1ZSAhPT0gXCJ1bmRlZmluZWRcIiA/IGRlZmF1bHRWYWx1ZSA6IDA7XG4gIH0sXG4gIHJlc2V0OiAoc3JjLCBrZXksIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICBzcmNba2V5XSA9IGRlZmF1bHRWYWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3JjW2tleV0gPSAwO1xuICAgIH1cbiAgfSxcbiAgY2xlYXI6IChzcmMsIGtleSkgPT4ge1xuICAgIHNyY1trZXldID0gMDtcbiAgfVxufSk7XG5cblR5cGVzLkJvb2xlYW4gPSBjcmVhdGVUeXBlKHtcbiAgYmFzZVR5cGU6IEJvb2xlYW4sXG4gIGlzU2ltcGxlVHlwZTogdHJ1ZSxcbiAgY3JlYXRlOiBkZWZhdWx0VmFsdWUgPT4ge1xuICAgIHJldHVybiB0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiID8gZGVmYXVsdFZhbHVlIDogZmFsc2U7XG4gIH0sXG4gIHJlc2V0OiAoc3JjLCBrZXksIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICBzcmNba2V5XSA9IGRlZmF1bHRWYWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3JjW2tleV0gPSBmYWxzZTtcbiAgICB9XG4gIH0sXG4gIGNsZWFyOiAoc3JjLCBrZXkpID0+IHtcbiAgICBzcmNba2V5XSA9IGZhbHNlO1xuICB9XG59KTtcblxuVHlwZXMuU3RyaW5nID0gY3JlYXRlVHlwZSh7XG4gIGJhc2VUeXBlOiBTdHJpbmcsXG4gIGlzU2ltcGxlVHlwZTogdHJ1ZSxcbiAgY3JlYXRlOiBkZWZhdWx0VmFsdWUgPT4ge1xuICAgIHJldHVybiB0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiID8gZGVmYXVsdFZhbHVlIDogXCJcIjtcbiAgfSxcbiAgcmVzZXQ6IChzcmMsIGtleSwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkZWZhdWx0VmFsdWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHNyY1trZXldID0gZGVmYXVsdFZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBzcmNba2V5XSA9IFwiXCI7XG4gICAgfVxuICB9LFxuICBjbGVhcjogKHNyYywga2V5KSA9PiB7XG4gICAgc3JjW2tleV0gPSBcIlwiO1xuICB9XG59KTtcblxuVHlwZXMuQXJyYXkgPSBjcmVhdGVUeXBlKHtcbiAgYmFzZVR5cGU6IEFycmF5LFxuICBjcmVhdGU6IGRlZmF1bHRWYWx1ZSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkZWZhdWx0VmFsdWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHJldHVybiBkZWZhdWx0VmFsdWUuc2xpY2UoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gW107XG4gIH0sXG4gIHJlc2V0OiAoc3JjLCBrZXksIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICBzcmNba2V5XSA9IGRlZmF1bHRWYWx1ZS5zbGljZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzcmNba2V5XS5sZW5ndGggPSAwO1xuICAgIH1cbiAgfSxcbiAgY2xlYXI6IChzcmMsIGtleSkgPT4ge1xuICAgIHNyY1trZXldLmxlbmd0aCA9IDA7XG4gIH0sXG4gIGNvcHk6IChzcmMsIGRzdCwga2V5KSA9PiB7XG4gICAgc3JjW2tleV0gPSBkc3Rba2V5XS5zbGljZSgpO1xuICB9XG59KTtcblxuZXhwb3J0IHsgVHlwZXMgfTtcbiIsImltcG9ydCB7IFR5cGVzIH0gZnJvbSBcIi4vU3RhbmRhcmRUeXBlc1wiO1xuXG52YXIgc3RhbmRhcmRUeXBlcyA9IHtcbiAgbnVtYmVyOiBUeXBlcy5OdW1iZXIsXG4gIGJvb2xlYW46IFR5cGVzLkJvb2xlYW4sXG4gIHN0cmluZzogVHlwZXMuU3RyaW5nXG59O1xuXG4vKipcbiAqIFRyeSB0byBpbmZlciB0aGUgdHlwZSBvZiB0aGUgdmFsdWVcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEByZXR1cm4ge1N0cmluZ30gVHlwZSBvZiB0aGUgYXR0cmlidXRlXG4gKiBAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5mZXJUeXBlKHZhbHVlKSB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiBUeXBlcy5BcnJheTtcbiAgfVxuXG4gIGlmIChzdGFuZGFyZFR5cGVzW3R5cGVvZiB2YWx1ZV0pIHtcbiAgICByZXR1cm4gc3RhbmRhcmRUeXBlc1t0eXBlb2YgdmFsdWVdO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG4iLCJpbXBvcnQgeyBpbmZlclR5cGUgfSBmcm9tIFwiLi9JbmZlclR5cGVcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudENsYXNzKHNjaGVtYSwgbmFtZSkge1xuICAvL3ZhciBDb21wb25lbnQgPSBuZXcgRnVuY3Rpb24oYHJldHVybiBmdW5jdGlvbiAke25hbWV9KCkge31gKSgpO1xuICBmb3IgKGxldCBrZXkgaW4gc2NoZW1hKSB7XG4gICAgbGV0IHR5cGUgPSBzY2hlbWFba2V5XS50eXBlO1xuICAgIGlmICghdHlwZSkge1xuICAgICAgc2NoZW1hW2tleV0udHlwZSA9IGluZmVyVHlwZShzY2hlbWFba2V5XS5kZWZhdWx0KTtcbiAgICB9XG4gIH1cblxuICB2YXIgQ29tcG9uZW50ID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgICAgdmFyIGF0dHIgPSBzY2hlbWFba2V5XTtcbiAgICAgIGxldCB0eXBlID0gYXR0ci50eXBlO1xuICAgICAgaWYgKHR5cGUgJiYgdHlwZS5pc1R5cGUpIHtcbiAgICAgICAgdGhpc1trZXldID0gdHlwZS5jcmVhdGUoYXR0ci5kZWZhdWx0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXNba2V5XSA9IGF0dHIuZGVmYXVsdDtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgaWYgKHR5cGVvZiBuYW1lICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbXBvbmVudCwgXCJuYW1lXCIsIHsgdmFsdWU6IG5hbWUgfSk7XG4gIH1cblxuICBDb21wb25lbnQucHJvdG90eXBlLnNjaGVtYSA9IHNjaGVtYTtcblxuICB2YXIga25vd25UeXBlcyA9IHRydWU7XG4gIGZvciAobGV0IGtleSBpbiBzY2hlbWEpIHtcbiAgICB2YXIgYXR0ciA9IHNjaGVtYVtrZXldO1xuICAgIGlmICghYXR0ci50eXBlKSB7XG4gICAgICBhdHRyLnR5cGUgPSBpbmZlclR5cGUoYXR0ci5kZWZhdWx0KTtcbiAgICB9XG5cbiAgICB2YXIgdHlwZSA9IGF0dHIudHlwZTtcbiAgICBpZiAoIXR5cGUpIHtcbiAgICAgIGNvbnNvbGUud2FybihgVW5rbm93biB0eXBlIGRlZmluaXRpb24gZm9yIGF0dHJpYnV0ZSAnJHtrZXl9J2ApO1xuICAgICAga25vd25UeXBlcyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGlmICgha25vd25UeXBlcykge1xuICAgIGNvbnNvbGUud2FybihcbiAgICAgIGBUaGlzIGNvbXBvbmVudCBjYW4ndCB1c2UgcG9vbGluZyBiZWNhdXNlIHNvbWUgZGF0YSB0eXBlcyBhcmUgbm90IHJlZ2lzdGVyZWQuIFBsZWFzZSBwcm92aWRlIGEgdHlwZSBjcmVhdGVkIHdpdGggJ2NyZWF0ZVR5cGUnYFxuICAgICk7XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gc2NoZW1hKSB7XG4gICAgICBsZXQgYXR0ciA9IHNjaGVtYVtrZXldO1xuICAgICAgQ29tcG9uZW50LnByb3RvdHlwZVtrZXldID0gYXR0ci5kZWZhdWx0O1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBDb21wb25lbnQucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbihzcmMpIHtcbiAgICAgIGZvciAobGV0IGtleSBpbiBzY2hlbWEpIHtcbiAgICAgICAgaWYgKHNyY1trZXldKSB7XG4gICAgICAgICAgbGV0IHR5cGUgPSBzY2hlbWFba2V5XS50eXBlO1xuICAgICAgICAgIGlmICh0eXBlLmlzU2ltcGxlVHlwZSkge1xuICAgICAgICAgICAgdGhpc1trZXldID0gc3JjW2tleV07XG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlLmNvcHkpIHtcbiAgICAgICAgICAgIHR5cGUuY29weSh0aGlzLCBzcmMsIGtleSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEB0b2RvIERldGVjdCB0aGF0IGl0J3Mgbm90IHBvc3NpYmxlIHRvIGNvcHkgYWxsIHRoZSBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAvLyBhbmQganVzdCBhdm9pZCBjcmVhdGluZyB0aGUgY29weSBmdW5jdGlvblxuICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICBgVW5rbm93biBjb3B5IGZ1bmN0aW9uIGZvciBhdHRyaWJ1dGUgJyR7a2V5fScgZGF0YSB0eXBlYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgICAgICBsZXQgYXR0ciA9IHNjaGVtYVtrZXldO1xuICAgICAgICBsZXQgdHlwZSA9IGF0dHIudHlwZTtcbiAgICAgICAgaWYgKHR5cGUucmVzZXQpIHR5cGUucmVzZXQodGhpcywga2V5LCBhdHRyLmRlZmF1bHQpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBDb21wb25lbnQucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKGxldCBrZXkgaW4gc2NoZW1hKSB7XG4gICAgICAgIGxldCB0eXBlID0gc2NoZW1hW2tleV0udHlwZTtcbiAgICAgICAgaWYgKHR5cGUuY2xlYXIpIHR5cGUuY2xlYXIodGhpcywga2V5KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgICAgbGV0IGF0dHIgPSBzY2hlbWFba2V5XTtcbiAgICAgIGxldCB0eXBlID0gYXR0ci50eXBlO1xuICAgICAgQ29tcG9uZW50LnByb3RvdHlwZVtrZXldID0gYXR0ci5kZWZhdWx0O1xuXG4gICAgICBpZiAodHlwZS5yZXNldCkge1xuICAgICAgICB0eXBlLnJlc2V0KENvbXBvbmVudC5wcm90b3R5cGUsIGtleSwgYXR0ci5kZWZhdWx0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gQ29tcG9uZW50O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlSWQobGVuZ3RoKSB7XG4gIHZhciByZXN1bHQgPSBcIlwiO1xuICB2YXIgY2hhcmFjdGVycyA9IFwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5XCI7XG4gIHZhciBjaGFyYWN0ZXJzTGVuZ3RoID0gY2hhcmFjdGVycy5sZW5ndGg7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICByZXN1bHQgKz0gY2hhcmFjdGVycy5jaGFyQXQoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogY2hhcmFjdGVyc0xlbmd0aCkpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3RTY3JpcHQoc3JjLCBvbkxvYWQpIHtcbiAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7XG4gIC8vIEB0b2RvIFVzZSBsaW5rIHRvIHRoZSBlY3N5LWRldnRvb2xzIHJlcG8/XG4gIHNjcmlwdC5zcmMgPSBzcmM7XG4gIHNjcmlwdC5vbmxvYWQgPSBvbkxvYWQ7XG4gIChkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcbn1cbiIsIi8qIGdsb2JhbCBQZWVyICovXG5pbXBvcnQgeyBpbmplY3RTY3JpcHQsIGdlbmVyYXRlSWQgfSBmcm9tIFwiLi91dGlscy5qc1wiO1xuXG5mdW5jdGlvbiBob29rQ29uc29sZUFuZEVycm9ycyhjb25uZWN0aW9uKSB7XG4gIHZhciB3cmFwRnVuY3Rpb25zID0gW1wiZXJyb3JcIiwgXCJ3YXJuaW5nXCIsIFwibG9nXCJdO1xuICB3cmFwRnVuY3Rpb25zLmZvckVhY2goa2V5ID0+IHtcbiAgICBpZiAodHlwZW9mIGNvbnNvbGVba2V5XSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB2YXIgZm4gPSBjb25zb2xlW2tleV0uYmluZChjb25zb2xlKTtcbiAgICAgIGNvbnNvbGVba2V5XSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGNvbm5lY3Rpb24uc2VuZCh7XG4gICAgICAgICAgbWV0aG9kOiBcImNvbnNvbGVcIixcbiAgICAgICAgICB0eXBlOiBrZXksXG4gICAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoYXJncylcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH07XG4gICAgfVxuICB9KTtcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsIGVycm9yID0+IHtcbiAgICBjb25uZWN0aW9uLnNlbmQoe1xuICAgICAgbWV0aG9kOiBcImVycm9yXCIsXG4gICAgICBlcnJvcjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBtZXNzYWdlOiBlcnJvci5lcnJvci5tZXNzYWdlLFxuICAgICAgICBzdGFjazogZXJyb3IuZXJyb3Iuc3RhY2tcbiAgICAgIH0pXG4gICAgfSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBpbmNsdWRlUmVtb3RlSWRIVE1MKHJlbW90ZUlkKSB7XG4gIGxldCBpbmZvRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgaW5mb0Rpdi5zdHlsZS5jc3NUZXh0ID0gYFxuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogIzMzMztcbiAgICBjb2xvcjogI2FhYTtcbiAgICBkaXNwbGF5OmZsZXg7XG4gICAgZm9udC1mYW1pbHk6IEFyaWFsO1xuICAgIGZvbnQtc2l6ZTogMS4xZW07XG4gICAgaGVpZ2h0OiA0MHB4O1xuICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIGxlZnQ6IDA7XG4gICAgb3BhY2l0eTogMC45O1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICByaWdodDogMDtcbiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgdG9wOiAwO1xuICBgO1xuXG4gIGluZm9EaXYuaW5uZXJIVE1MID0gYE9wZW4gRUNTWSBkZXZ0b29scyB0byBjb25uZWN0IHRvIHRoaXMgcGFnZSB1c2luZyB0aGUgY29kZTombmJzcDs8YiBzdHlsZT1cImNvbG9yOiAjZmZmXCI+JHtyZW1vdGVJZH08L2I+Jm5ic3A7PGJ1dHRvbiBvbkNsaWNrPVwiZ2VuZXJhdGVOZXdDb2RlKClcIj5HZW5lcmF0ZSBuZXcgY29kZTwvYnV0dG9uPmA7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaW5mb0Rpdik7XG5cbiAgcmV0dXJuIGluZm9EaXY7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbmFibGVSZW1vdGVEZXZ0b29scyhyZW1vdGVJZCkge1xuICB3aW5kb3cuZ2VuZXJhdGVOZXdDb2RlID0gKCkgPT4ge1xuICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2UuY2xlYXIoKTtcbiAgICByZW1vdGVJZCA9IGdlbmVyYXRlSWQoNik7XG4gICAgd2luZG93LmxvY2FsU3RvcmFnZS5zZXRJdGVtKFwiZWNzeVJlbW90ZUlkXCIsIHJlbW90ZUlkKTtcbiAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKGZhbHNlKTtcbiAgfTtcblxuICByZW1vdGVJZCA9IHJlbW90ZUlkIHx8IHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShcImVjc3lSZW1vdGVJZFwiKTtcbiAgaWYgKCFyZW1vdGVJZCkge1xuICAgIHJlbW90ZUlkID0gZ2VuZXJhdGVJZCg2KTtcbiAgICB3aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJlY3N5UmVtb3RlSWRcIiwgcmVtb3RlSWQpO1xuICB9XG5cbiAgbGV0IGluZm9EaXYgPSBpbmNsdWRlUmVtb3RlSWRIVE1MKHJlbW90ZUlkKTtcblxuICB3aW5kb3cuX19FQ1NZX1JFTU9URV9ERVZUT09MU19JTkpFQ1RFRCA9IHRydWU7XG4gIHdpbmRvdy5fX0VDU1lfUkVNT1RFX0RFVlRPT0xTID0ge307XG5cbiAgbGV0IFZlcnNpb24gPSBcIlwiO1xuXG4gIC8vIFRoaXMgaXMgdXNlZCB0byBjb2xsZWN0IHRoZSB3b3JsZHMgY3JlYXRlZCBiZWZvcmUgdGhlIGNvbW11bmljYXRpb24gaXMgYmVpbmcgZXN0YWJsaXNoZWRcbiAgbGV0IHdvcmxkc0JlZm9yZUxvYWRpbmcgPSBbXTtcbiAgbGV0IG9uV29ybGRDcmVhdGVkID0gZSA9PiB7XG4gICAgdmFyIHdvcmxkID0gZS5kZXRhaWwud29ybGQ7XG4gICAgVmVyc2lvbiA9IGUuZGV0YWlsLnZlcnNpb247XG4gICAgd29ybGRzQmVmb3JlTG9hZGluZy5wdXNoKHdvcmxkKTtcbiAgfTtcbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJlY3N5LXdvcmxkLWNyZWF0ZWRcIiwgb25Xb3JsZENyZWF0ZWQpO1xuXG4gIGxldCBvbkxvYWRlZCA9ICgpID0+IHtcbiAgICB2YXIgcGVlciA9IG5ldyBQZWVyKHJlbW90ZUlkKTtcbiAgICBwZWVyLm9uKFwib3BlblwiLCAoLyogaWQgKi8pID0+IHtcbiAgICAgIHBlZXIub24oXCJjb25uZWN0aW9uXCIsIGNvbm5lY3Rpb24gPT4ge1xuICAgICAgICB3aW5kb3cuX19FQ1NZX1JFTU9URV9ERVZUT09MUy5jb25uZWN0aW9uID0gY29ubmVjdGlvbjtcbiAgICAgICAgY29ubmVjdGlvbi5vbihcIm9wZW5cIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgLy8gaW5mb0Rpdi5zdHlsZS52aXNpYmlsaXR5ID0gXCJoaWRkZW5cIjtcbiAgICAgICAgICBpbmZvRGl2LmlubmVySFRNTCA9IFwiQ29ubmVjdGVkXCI7XG5cbiAgICAgICAgICAvLyBSZWNlaXZlIG1lc3NhZ2VzXG4gICAgICAgICAgY29ubmVjdGlvbi5vbihcImRhdGFcIiwgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgaWYgKGRhdGEudHlwZSA9PT0gXCJpbml0XCIpIHtcbiAgICAgICAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7XG4gICAgICAgICAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIFwidGV4dC9qYXZhc2NyaXB0XCIpO1xuICAgICAgICAgICAgICBzY3JpcHQub25sb2FkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdCk7XG5cbiAgICAgICAgICAgICAgICAvLyBPbmNlIHRoZSBzY3JpcHQgaXMgaW5qZWN0ZWQgd2UgZG9uJ3QgbmVlZCB0byBsaXN0ZW5cbiAgICAgICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgIFwiZWNzeS13b3JsZC1jcmVhdGVkXCIsXG4gICAgICAgICAgICAgICAgICBvbldvcmxkQ3JlYXRlZFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgd29ybGRzQmVmb3JlTG9hZGluZy5mb3JFYWNoKHdvcmxkID0+IHtcbiAgICAgICAgICAgICAgICAgIHZhciBldmVudCA9IG5ldyBDdXN0b21FdmVudChcImVjc3ktd29ybGQtY3JlYXRlZFwiLCB7XG4gICAgICAgICAgICAgICAgICAgIGRldGFpbDogeyB3b3JsZDogd29ybGQsIHZlcnNpb246IFZlcnNpb24gfVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChldmVudCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIHNjcmlwdC5pbm5lckhUTUwgPSBkYXRhLnNjcmlwdDtcbiAgICAgICAgICAgICAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzY3JpcHQpO1xuICAgICAgICAgICAgICBzY3JpcHQub25sb2FkKCk7XG5cbiAgICAgICAgICAgICAgaG9va0NvbnNvbGVBbmRFcnJvcnMoY29ubmVjdGlvbik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRhdGEudHlwZSA9PT0gXCJleGVjdXRlU2NyaXB0XCIpIHtcbiAgICAgICAgICAgICAgbGV0IHZhbHVlID0gZXZhbChkYXRhLnNjcmlwdCk7XG4gICAgICAgICAgICAgIGlmIChkYXRhLnJldHVybkV2YWwpIHtcbiAgICAgICAgICAgICAgICBjb25uZWN0aW9uLnNlbmQoe1xuICAgICAgICAgICAgICAgICAgbWV0aG9kOiBcImV2YWxSZXR1cm5cIixcbiAgICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gSW5qZWN0IFBlZXJKUyBzY3JpcHRcbiAgaW5qZWN0U2NyaXB0KFxuICAgIFwiaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0L25wbS9wZWVyanNAMC4zLjIwL2Rpc3QvcGVlci5taW4uanNcIixcbiAgICBvbkxvYWRlZFxuICApO1xufVxuXG5jb25zdCB1cmxQYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xuXG4vLyBAdG9kbyBQcm92aWRlIGEgd2F5IHRvIGRpc2FibGUgaXQgaWYgbmVlZGVkXG5pZiAodXJsUGFyYW1zLmhhcyhcImVuYWJsZS1yZW1vdGUtZGV2dG9vbHNcIikpIHtcbiAgZW5hYmxlUmVtb3RlRGV2dG9vbHMoKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztDQUFPLE1BQU0sYUFBYSxDQUFDO0NBQzNCLEVBQUUsV0FBVyxDQUFDLEtBQUssRUFBRTtDQUNyQixJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO0NBQ3ZCLElBQUksSUFBSSxDQUFDLGVBQWUsR0FBRyxFQUFFLENBQUM7Q0FDOUIsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztDQUN2QixJQUFJLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7Q0FDbkMsR0FBRztBQUNIO0NBQ0EsRUFBRSxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRTtDQUNyQyxJQUFJO0NBQ0osTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVM7Q0FDL0UsTUFBTTtDQUNOLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQztDQUNsRSxNQUFNLE9BQU8sSUFBSSxDQUFDO0NBQ2xCLEtBQUs7QUFDTDtDQUNBLElBQUksSUFBSSxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztD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
