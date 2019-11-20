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
	    if (system.execute) this._executeSystems.push(system);
	    this.sortSystems();
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
	      }
	      this.lastExecutedSystem = system;
	      system.clearEvents();
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
	          `Component '${Component.name}' won't benefit from pooling because 'reset' method was not implemeneted.`
	        );
	        this._componentPool[componentName] = new DummyObjectPool(Component);
	      }
	    }

	    return this._componentPool[componentName];
	  }
	}

	var name = "ecsy";
	var version = "0.1.4";
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
		"docsify-cli": "^4.3.0",
		eslint: "^5.16.0",
		"eslint-config-prettier": "^4.3.0",
		"eslint-plugin-prettier": "^3.1.1",
		"http-server": "^0.11.1",
		nodemon: "^1.19.2",
		prettier: "^1.18.2",
		rollup: "^1.21.4",
		"rollup-plugin-json": "^4.0.0",
		"rollup-plugin-terser": "^5.1.2",
		typedoc: "^0.15.0",
		"typedoc-plugin-markdown": "^2.2.6",
		typescript: "^3.6.3"
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

	/* global Peer */
	function generateId(length) {
	  var result = "";
	  var characters =
	    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	  var charactersLength = characters.length;
	  for (var i = 0; i < length; i++) {
	    result += characters.charAt(Math.floor(Math.random() * charactersLength));
	  }
	  return result.toUpperCase();
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

	  let infoDiv = document.createElement("div");
	  infoDiv.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40px;
    opacity: 0.9;
    font-size: 1.1em;
    color: #fff;
    display:flex;
    align-items: center;
    justify-content: center;
    font-family: Arial;
    text-align: center;
    background-color: #333`;

	  infoDiv.innerHTML = `Open ECSY devtools to connect to this page using the code:&nbsp;<b>${remoteId}</b>&nbsp;<button onClick="generateNewCode()">Generate new code</button>`;
	  document.body.appendChild(infoDiv);
	  window.__ECSY_REMOTE_DEVTOOLS_INJECTED = true;
	  window.__ECSY_REMOTE_DEVTOOLS = {};

	  ////////////
	  let Version = "";
	  let worldsBeforeLoading = [];
	  let onWorldCreated = e => {
	    var world = e.detail.world;
	    Version = e.detail.version;
	    worldsBeforeLoading.push(world);
	  };

	  window.addEventListener("ecsy-world-created", onWorldCreated);

	  var script = document.createElement("script");
	  // @todo Use link to the ecsy-devtools repo?
	  script.src = "https://cdn.jsdelivr.net/npm/peerjs@0.3.20/dist/peer.min.js";
	  script.onload = () => {
	    var peer = new Peer(remoteId);
	    peer.on("open", id => {
	      peer.on("connection", conn => {
	        window.__ECSY_REMOTE_DEVTOOLS.connection = conn;

	        conn.on("open", function() {
	          infoDiv.style.visibility = "hidden";

	          // Receive messages
	          conn.on("data", function(data) {
	            if (data.type === "init") {
	              var script = document.createElement("script");
	              script.textContent = data.script;
	              script.onload = () => {
	                script.parentNode.removeChild(script);
	              };
	              window.removeEventListener("ecsy-world-created", onWorldCreated);
	              setTimeout(() => {
	                worldsBeforeLoading.forEach(world => {
	                  var event = new CustomEvent("ecsy-world-created", {
	                    detail: { world: world, version: Version }
	                  });
	                  window.dispatchEvent(event);
	                });
	              }, 1000);

	              (document.head || document.documentElement).appendChild(script);

	              var wrapFunctions = ["error", "warning", "log"];
	              wrapFunctions.forEach(key => {
	                if (typeof console[key] === "function") {
	                  var fn = console[key].bind(console);
	                  console[key] = (...args) => {
	                    conn.send({
	                      method: "console",
	                      type: key,
	                      args: JSON.stringify(args)
	                    });
	                    return fn.apply(null, args);
	                  };
	                }
	              });

	              window.addEventListener("error", error => {
	                conn.send({
	                  method: "error",
	                  error: JSON.stringify({
	                    message: error.error.message,
	                    stack: error.error.stack
	                  })
	                });
	              });
	            } else if (data.type === "executeScript") {
	              let value = eval(data.script);
	              if (data.returnEval) {
	                conn.send({
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
	  (document.head || document.documentElement).appendChild(script);
	}

	const urlParams = new URLSearchParams(window.location.search);

	// @todo Provide a way to disable it if needed
	if (urlParams.has("enableRemoteDevtools")) {
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

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL1N5c3RlbU1hbmFnZXIuanMiLCIuLi9zcmMvRXZlbnREaXNwYXRjaGVyLmpzIiwiLi4vc3JjL1V0aWxzLmpzIiwiLi4vc3JjL1F1ZXJ5LmpzIiwiLi4vc3JjL0VudGl0eS5qcyIsIi4uL3NyYy9PYmplY3RQb29sLmpzIiwiLi4vc3JjL1F1ZXJ5TWFuYWdlci5qcyIsIi4uL3NyYy9TeXN0ZW1TdGF0ZUNvbXBvbmVudC5qcyIsIi4uL3NyYy9FbnRpdHlNYW5hZ2VyLmpzIiwiLi4vc3JjL0R1bW15T2JqZWN0UG9vbC5qcyIsIi4uL3NyYy9Db21wb25lbnRNYW5hZ2VyLmpzIiwiLi4vc3JjL1ZlcnNpb24uanMiLCIuLi9zcmMvV29ybGQuanMiLCIuLi9zcmMvU3lzdGVtLmpzIiwiLi4vc3JjL0NvbXBvbmVudC5qcyIsIi4uL3NyYy9UYWdDb21wb25lbnQuanMiLCIuLi9zcmMvQ3JlYXRlVHlwZS5qcyIsIi4uL3NyYy9TdGFuZGFyZFR5cGVzLmpzIiwiLi4vc3JjL0luZmVyVHlwZS5qcyIsIi4uL3NyYy9DcmVhdGVDb21wb25lbnRDbGFzcy5qcyIsIi4uL3NyYy9SZW1vdGVEZXZUb29scy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY2xhc3MgU3lzdGVtTWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy5fc3lzdGVtcyA9IFtdO1xuICAgIHRoaXMuX2V4ZWN1dGVTeXN0ZW1zID0gW107IC8vIFN5c3RlbXMgdGhhdCBoYXZlIGBleGVjdXRlYCBtZXRob2RcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgdGhpcy5sYXN0RXhlY3V0ZWRTeXN0ZW0gPSBudWxsO1xuICB9XG5cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtLCBhdHRyaWJ1dGVzKSB7XG4gICAgaWYgKFxuICAgICAgdGhpcy5fc3lzdGVtcy5maW5kKHMgPT4gcy5jb25zdHJ1Y3Rvci5uYW1lID09PSBTeXN0ZW0ubmFtZSkgIT09IHVuZGVmaW5lZFxuICAgICkge1xuICAgICAgY29uc29sZS53YXJuKGBTeXN0ZW0gJyR7U3lzdGVtLm5hbWV9JyBhbHJlYWR5IHJlZ2lzdGVyZWQuYCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICB2YXIgc3lzdGVtID0gbmV3IFN5c3RlbSh0aGlzLndvcmxkLCBhdHRyaWJ1dGVzKTtcbiAgICBpZiAoc3lzdGVtLmluaXQpIHN5c3RlbS5pbml0KCk7XG4gICAgc3lzdGVtLm9yZGVyID0gdGhpcy5fc3lzdGVtcy5sZW5ndGg7XG4gICAgdGhpcy5fc3lzdGVtcy5wdXNoKHN5c3RlbSk7XG4gICAgaWYgKHN5c3RlbS5leGVjdXRlKSB0aGlzLl9leGVjdXRlU3lzdGVtcy5wdXNoKHN5c3RlbSk7XG4gICAgdGhpcy5zb3J0U3lzdGVtcygpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc29ydFN5c3RlbXMoKSB7XG4gICAgdGhpcy5fZXhlY3V0ZVN5c3RlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgcmV0dXJuIGEucHJpb3JpdHkgLSBiLnByaW9yaXR5IHx8IGEub3JkZXIgLSBiLm9yZGVyO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0U3lzdGVtKFN5c3RlbSkge1xuICAgIHJldHVybiB0aGlzLl9zeXN0ZW1zLmZpbmQocyA9PiBzIGluc3RhbmNlb2YgU3lzdGVtKTtcbiAgfVxuXG4gIGdldFN5c3RlbXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N5c3RlbXM7XG4gIH1cblxuICByZW1vdmVTeXN0ZW0oU3lzdGVtKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5fc3lzdGVtcy5pbmRleE9mKFN5c3RlbSk7XG4gICAgaWYgKCF+aW5kZXgpIHJldHVybjtcblxuICAgIHRoaXMuX3N5c3RlbXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgfVxuXG4gIGV4ZWN1dGVTeXN0ZW0oc3lzdGVtLCBkZWx0YSwgdGltZSkge1xuICAgIGlmIChzeXN0ZW0uaW5pdGlhbGl6ZWQpIHtcbiAgICAgIGlmIChzeXN0ZW0uY2FuRXhlY3V0ZSgpKSB7XG4gICAgICAgIGxldCBzdGFydFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgc3lzdGVtLmV4ZWN1dGUoZGVsdGEsIHRpbWUpO1xuICAgICAgICBzeXN0ZW0uZXhlY3V0ZVRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubGFzdEV4ZWN1dGVkU3lzdGVtID0gc3lzdGVtO1xuICAgICAgc3lzdGVtLmNsZWFyRXZlbnRzKCk7XG4gICAgfVxuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLl9leGVjdXRlU3lzdGVtcy5mb3JFYWNoKHN5c3RlbSA9PiBzeXN0ZW0uc3RvcCgpKTtcbiAgfVxuXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUsIGZvcmNlUGxheSkge1xuICAgIHRoaXMuX2V4ZWN1dGVTeXN0ZW1zLmZvckVhY2goXG4gICAgICBzeXN0ZW0gPT5cbiAgICAgICAgKGZvcmNlUGxheSB8fCBzeXN0ZW0uZW5hYmxlZCkgJiYgdGhpcy5leGVjdXRlU3lzdGVtKHN5c3RlbSwgZGVsdGEsIHRpbWUpXG4gICAgKTtcbiAgfVxuXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIG51bVN5c3RlbXM6IHRoaXMuX3N5c3RlbXMubGVuZ3RoLFxuICAgICAgc3lzdGVtczoge31cbiAgICB9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9zeXN0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc3lzdGVtID0gdGhpcy5fc3lzdGVtc1tpXTtcbiAgICAgIHZhciBzeXN0ZW1TdGF0cyA9IChzdGF0cy5zeXN0ZW1zW3N5c3RlbS5jb25zdHJ1Y3Rvci5uYW1lXSA9IHtcbiAgICAgICAgcXVlcmllczoge31cbiAgICAgIH0pO1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiBzeXN0ZW0uY3R4KSB7XG4gICAgICAgIHN5c3RlbVN0YXRzLnF1ZXJpZXNbbmFtZV0gPSBzeXN0ZW0uY3R4W25hbWVdLnN0YXRzKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG4iLCIvKipcbiAqIEBwcml2YXRlXG4gKiBAY2xhc3MgRXZlbnREaXNwYXRjaGVyXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEV2ZW50RGlzcGF0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuX2xpc3RlbmVycyA9IHt9O1xuICAgIHRoaXMuc3RhdHMgPSB7XG4gICAgICBmaXJlZDogMCxcbiAgICAgIGhhbmRsZWQ6IDBcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhbiBldmVudCBsaXN0ZW5lclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGxpc3RlblxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayB0byB0cmlnZ2VyIHdoZW4gdGhlIGV2ZW50IGlzIGZpcmVkXG4gICAqL1xuICBhZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICBsZXQgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnROYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgIH1cblxuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnROYW1lXS5pbmRleE9mKGxpc3RlbmVyKSA9PT0gLTEpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudE5hbWVdLnB1c2gobGlzdGVuZXIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBhbiBldmVudCBsaXN0ZW5lciBpcyBhbHJlYWR5IGFkZGVkIHRvIHRoZSBsaXN0IG9mIGxpc3RlbmVyc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGNoZWNrXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50XG4gICAqL1xuICBoYXNFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihsaXN0ZW5lcikgIT09IC0xXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byByZW1vdmVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnRcbiAgICovXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIHZhciBsaXN0ZW5lckFycmF5ID0gdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV07XG4gICAgaWYgKGxpc3RlbmVyQXJyYXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGluZGV4ID0gbGlzdGVuZXJBcnJheS5pbmRleE9mKGxpc3RlbmVyKTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgbGlzdGVuZXJBcnJheS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNwYXRjaCBhbiBldmVudFxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGRpc3BhdGNoXG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgKE9wdGlvbmFsKSBFbnRpdHkgdG8gZW1pdFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XG4gICAqL1xuICBkaXNwYXRjaEV2ZW50KGV2ZW50TmFtZSwgZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkKys7XG5cbiAgICB2YXIgbGlzdGVuZXJBcnJheSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xuICAgIGlmIChsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBhcnJheSA9IGxpc3RlbmVyQXJyYXkuc2xpY2UoMCk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJyYXlbaV0uY2FsbCh0aGlzLCBlbnRpdHksIGNvbXBvbmVudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHN0YXRzIGNvdW50ZXJzXG4gICAqL1xuICByZXNldENvdW50ZXJzKCkge1xuICAgIHRoaXMuc3RhdHMuZmlyZWQgPSB0aGlzLnN0YXRzLmhhbmRsZWQgPSAwO1xuICB9XG59XG4iLCIvKipcbiAqIFJldHVybiB0aGUgbmFtZSBvZiBhIGNvbXBvbmVudFxuICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE5hbWUoQ29tcG9uZW50KSB7XG4gIHJldHVybiBDb21wb25lbnQubmFtZTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gYSB2YWxpZCBwcm9wZXJ0eSBuYW1lIGZvciB0aGUgQ29tcG9uZW50XG4gKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50XG4gKiBAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCkge1xuICB2YXIgbmFtZSA9IGdldE5hbWUoQ29tcG9uZW50KTtcbiAgcmV0dXJuIG5hbWUuY2hhckF0KDApLnRvTG93ZXJDYXNlKCkgKyBuYW1lLnNsaWNlKDEpO1xufVxuXG4vKipcbiAqIEdldCBhIGtleSBmcm9tIGEgbGlzdCBvZiBjb21wb25lbnRzXG4gKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgQXJyYXkgb2YgY29tcG9uZW50cyB0byBnZW5lcmF0ZSB0aGUga2V5XG4gKiBAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcXVlcnlLZXkoQ29tcG9uZW50cykge1xuICB2YXIgbmFtZXMgPSBbXTtcbiAgZm9yICh2YXIgbiA9IDA7IG4gPCBDb21wb25lbnRzLmxlbmd0aDsgbisrKSB7XG4gICAgdmFyIFQgPSBDb21wb25lbnRzW25dO1xuICAgIGlmICh0eXBlb2YgVCA9PT0gXCJvYmplY3RcIikge1xuICAgICAgdmFyIG9wZXJhdG9yID0gVC5vcGVyYXRvciA9PT0gXCJub3RcIiA/IFwiIVwiIDogVC5vcGVyYXRvcjtcbiAgICAgIG5hbWVzLnB1c2gob3BlcmF0b3IgKyBnZXROYW1lKFQuQ29tcG9uZW50KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hbWVzLnB1c2goZ2V0TmFtZShUKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWVzLnNvcnQoKS5qb2luKFwiLVwiKTtcbn1cbiIsImltcG9ydCBFdmVudERpc3BhdGNoZXIgZnJvbSBcIi4vRXZlbnREaXNwYXRjaGVyLmpzXCI7XG5pbXBvcnQgeyBxdWVyeUtleSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFF1ZXJ5IHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBMaXN0IG9mIHR5cGVzIG9mIGNvbXBvbmVudHMgdG8gcXVlcnlcbiAgICovXG4gIGNvbnN0cnVjdG9yKENvbXBvbmVudHMsIG1hbmFnZXIpIHtcbiAgICB0aGlzLkNvbXBvbmVudHMgPSBbXTtcbiAgICB0aGlzLk5vdENvbXBvbmVudHMgPSBbXTtcblxuICAgIENvbXBvbmVudHMuZm9yRWFjaChjb21wb25lbnQgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBjb21wb25lbnQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgdGhpcy5Ob3RDb21wb25lbnRzLnB1c2goY29tcG9uZW50LkNvbXBvbmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLkNvbXBvbmVudHMucHVzaChjb21wb25lbnQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuQ29tcG9uZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGNyZWF0ZSBhIHF1ZXJ5IHdpdGhvdXQgY29tcG9uZW50c1wiKTtcbiAgICB9XG5cbiAgICB0aGlzLmVudGl0aWVzID0gW107XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlciA9IG5ldyBFdmVudERpc3BhdGNoZXIoKTtcblxuICAgIC8vIFRoaXMgcXVlcnkgaXMgYmVpbmcgdXNlZCBieSBhIHJlYWN0aXZlIHN5c3RlbVxuICAgIHRoaXMucmVhY3RpdmUgPSBmYWxzZTtcblxuICAgIHRoaXMua2V5ID0gcXVlcnlLZXkoQ29tcG9uZW50cyk7XG5cbiAgICAvLyBGaWxsIHRoZSBxdWVyeSB3aXRoIHRoZSBleGlzdGluZyBlbnRpdGllc1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbWFuYWdlci5fZW50aXRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBlbnRpdHkgPSBtYW5hZ2VyLl9lbnRpdGllc1tpXTtcbiAgICAgIGlmICh0aGlzLm1hdGNoKGVudGl0eSkpIHtcbiAgICAgICAgLy8gQHRvZG8gPz8/IHRoaXMuYWRkRW50aXR5KGVudGl0eSk7ID0+IHByZXZlbnRpbmcgdGhlIGV2ZW50IHRvIGJlIGdlbmVyYXRlZFxuICAgICAgICBlbnRpdHkucXVlcmllcy5wdXNoKHRoaXMpO1xuICAgICAgICB0aGlzLmVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkIGVudGl0eSB0byB0aGlzIHF1ZXJ5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHlcbiAgICovXG4gIGFkZEVudGl0eShlbnRpdHkpIHtcbiAgICBlbnRpdHkucXVlcmllcy5wdXNoKHRoaXMpO1xuICAgIHRoaXMuZW50aXRpZXMucHVzaChlbnRpdHkpO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChRdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVELCBlbnRpdHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBlbnRpdHkgZnJvbSB0aGlzIHF1ZXJ5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZUVudGl0eShlbnRpdHkpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzLmVudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcbiAgICBpZiAofmluZGV4KSB7XG4gICAgICB0aGlzLmVudGl0aWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgIGluZGV4ID0gZW50aXR5LnF1ZXJpZXMuaW5kZXhPZih0aGlzKTtcbiAgICAgIGVudGl0eS5xdWVyaWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoXG4gICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfUkVNT1ZFRCxcbiAgICAgICAgZW50aXR5XG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIG1hdGNoKGVudGl0eSkge1xuICAgIHJldHVybiAoXG4gICAgICBlbnRpdHkuaGFzQWxsQ29tcG9uZW50cyh0aGlzLkNvbXBvbmVudHMpICYmXG4gICAgICAhZW50aXR5Lmhhc0FueUNvbXBvbmVudHModGhpcy5Ob3RDb21wb25lbnRzKVxuICAgICk7XG4gIH1cblxuICB0b0pTT04oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGtleTogdGhpcy5rZXksXG4gICAgICByZWFjdGl2ZTogdGhpcy5yZWFjdGl2ZSxcbiAgICAgIGNvbXBvbmVudHM6IHtcbiAgICAgICAgaW5jbHVkZWQ6IHRoaXMuQ29tcG9uZW50cy5tYXAoQyA9PiBDLm5hbWUpLFxuICAgICAgICBub3Q6IHRoaXMuTm90Q29tcG9uZW50cy5tYXAoQyA9PiBDLm5hbWUpXG4gICAgICB9LFxuICAgICAgbnVtRW50aXRpZXM6IHRoaXMuZW50aXRpZXMubGVuZ3RoXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc3RhdHMgZm9yIHRoaXMgcXVlcnlcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBudW1Db21wb25lbnRzOiB0aGlzLkNvbXBvbmVudHMubGVuZ3RoLFxuICAgICAgbnVtRW50aXRpZXM6IHRoaXMuZW50aXRpZXMubGVuZ3RoXG4gICAgfTtcbiAgfVxufVxuXG5RdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVEID0gXCJRdWVyeSNFTlRJVFlfQURERURcIjtcblF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfUkVNT1ZFRCA9IFwiUXVlcnkjRU5USVRZX1JFTU9WRURcIjtcblF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCA9IFwiUXVlcnkjQ09NUE9ORU5UX0NIQU5HRURcIjtcbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuaW1wb3J0IHdyYXBJbW11dGFibGVDb21wb25lbnQgZnJvbSBcIi4vV3JhcEltbXV0YWJsZUNvbXBvbmVudC5qc1wiO1xuXG4vLyBAdG9kbyBUYWtlIHRoaXMgb3V0IGZyb20gdGhlcmUgb3IgdXNlIEVOVlxuY29uc3QgREVCVUcgPSBmYWxzZTtcblxudmFyIG5leHRJZCA9IDA7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVudGl0eSB7XG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy5fd29ybGQgPSB3b3JsZCB8fCBudWxsO1xuXG4gICAgLy8gVW5pcXVlIElEIGZvciB0aGlzIGVudGl0eVxuICAgIHRoaXMuaWQgPSBuZXh0SWQrKztcblxuICAgIC8vIExpc3Qgb2YgY29tcG9uZW50cyB0eXBlcyB0aGUgZW50aXR5IGhhc1xuICAgIHRoaXMuX0NvbXBvbmVudFR5cGVzID0gW107XG5cbiAgICAvLyBJbnN0YW5jZSBvZiB0aGUgY29tcG9uZW50c1xuICAgIHRoaXMuX2NvbXBvbmVudHMgPSB7fTtcblxuICAgIHRoaXMuX2NvbXBvbmVudHNUb1JlbW92ZSA9IHt9O1xuXG4gICAgLy8gUXVlcmllcyB3aGVyZSB0aGUgZW50aXR5IGlzIGFkZGVkXG4gICAgdGhpcy5xdWVyaWVzID0gW107XG5cbiAgICAvLyBVc2VkIGZvciBkZWZlcnJlZCByZW1vdmFsXG4gICAgdGhpcy5fQ29tcG9uZW50VHlwZXNUb1JlbW92ZSA9IFtdO1xuXG4gICAgdGhpcy5hbGl2ZSA9IGZhbHNlO1xuICB9XG5cbiAgLy8gQ09NUE9ORU5UU1xuXG4gIGdldENvbXBvbmVudChDb21wb25lbnQsIGluY2x1ZGVSZW1vdmVkKSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IHRoaXMuX2NvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdO1xuXG4gICAgaWYgKCFjb21wb25lbnQgJiYgaW5jbHVkZVJlbW92ZWQgPT09IHRydWUpIHtcbiAgICAgIGNvbXBvbmVudCA9IHRoaXMuX2NvbXBvbmVudHNUb1JlbW92ZVtDb21wb25lbnQubmFtZV07XG4gICAgfVxuXG4gICAgcmV0dXJuIERFQlVHID8gd3JhcEltbXV0YWJsZUNvbXBvbmVudChDb21wb25lbnQsIGNvbXBvbmVudCkgOiBjb21wb25lbnQ7XG4gIH1cblxuICBnZXRSZW1vdmVkQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHJldHVybiB0aGlzLl9jb21wb25lbnRzVG9SZW1vdmVbQ29tcG9uZW50Lm5hbWVdO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50cygpIHtcbiAgICByZXR1cm4gdGhpcy5fY29tcG9uZW50cztcbiAgfVxuXG4gIGdldENvbXBvbmVudHNUb1JlbW92ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fY29tcG9uZW50c1RvUmVtb3ZlO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50VHlwZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX0NvbXBvbmVudFR5cGVzO1xuICB9XG5cbiAgZ2V0TXV0YWJsZUNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcy5fY29tcG9uZW50c1tDb21wb25lbnQubmFtZV07XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnF1ZXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMucXVlcmllc1tpXTtcbiAgICAgIC8vIEB0b2RvIGFjY2VsZXJhdGUgdGhpcyBjaGVjay4gTWF5YmUgaGF2aW5nIHF1ZXJ5Ll9Db21wb25lbnRzIGFzIGFuIG9iamVjdFxuICAgICAgaWYgKHF1ZXJ5LnJlYWN0aXZlICYmIHF1ZXJ5LkNvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpICE9PSAtMSkge1xuICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgICBRdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQsXG4gICAgICAgICAgdGhpcyxcbiAgICAgICAgICBjb21wb25lbnRcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgfVxuXG4gIGFkZENvbXBvbmVudChDb21wb25lbnQsIHZhbHVlcykge1xuICAgIHRoaXMuX3dvcmxkLmVudGl0eUFkZENvbXBvbmVudCh0aGlzLCBDb21wb25lbnQsIHZhbHVlcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICByZW1vdmVDb21wb25lbnQoQ29tcG9uZW50LCBmb3JjZVJlbW92ZSkge1xuICAgIHRoaXMuX3dvcmxkLmVudGl0eVJlbW92ZUNvbXBvbmVudCh0aGlzLCBDb21wb25lbnQsIGZvcmNlUmVtb3ZlKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGhhc0NvbXBvbmVudChDb21wb25lbnQsIGluY2x1ZGVSZW1vdmVkKSB7XG4gICAgcmV0dXJuIChcbiAgICAgICEhfnRoaXMuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KSB8fFxuICAgICAgKGluY2x1ZGVSZW1vdmVkID09PSB0cnVlICYmIHRoaXMuaGFzUmVtb3ZlZENvbXBvbmVudChDb21wb25lbnQpKVxuICAgICk7XG4gIH1cblxuICBoYXNSZW1vdmVkQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHJldHVybiAhIX50aGlzLl9Db21wb25lbnRUeXBlc1RvUmVtb3ZlLmluZGV4T2YoQ29tcG9uZW50KTtcbiAgfVxuXG4gIGhhc0FsbENvbXBvbmVudHMoQ29tcG9uZW50cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCF0aGlzLmhhc0NvbXBvbmVudChDb21wb25lbnRzW2ldKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGhhc0FueUNvbXBvbmVudHMoQ29tcG9uZW50cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuaGFzQ29tcG9uZW50KENvbXBvbmVudHNbaV0pKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmVtb3ZlQWxsQ29tcG9uZW50cyhmb3JjZVJlbW92ZSkge1xuICAgIHJldHVybiB0aGlzLl93b3JsZC5lbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKHRoaXMsIGZvcmNlUmVtb3ZlKTtcbiAgfVxuXG4gIC8vIEVYVFJBU1xuXG4gIC8vIEluaXRpYWxpemUgdGhlIGVudGl0eS4gVG8gYmUgdXNlZCB3aGVuIHJldHVybmluZyBhbiBlbnRpdHkgdG8gdGhlIHBvb2xcbiAgcmVzZXQoKSB7XG4gICAgdGhpcy5pZCA9IG5leHRJZCsrO1xuICAgIHRoaXMuX3dvcmxkID0gbnVsbDtcbiAgICB0aGlzLl9Db21wb25lbnRUeXBlcy5sZW5ndGggPSAwO1xuICAgIHRoaXMucXVlcmllcy5sZW5ndGggPSAwO1xuICAgIHRoaXMuX2NvbXBvbmVudHMgPSB7fTtcbiAgfVxuXG4gIHJlbW92ZShmb3JjZVJlbW92ZSkge1xuICAgIHJldHVybiB0aGlzLl93b3JsZC5yZW1vdmVFbnRpdHkodGhpcywgZm9yY2VSZW1vdmUpO1xuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBPYmplY3RQb29sIHtcbiAgLy8gQHRvZG8gQWRkIGluaXRpYWwgc2l6ZVxuICBjb25zdHJ1Y3RvcihULCBpbml0aWFsU2l6ZSkge1xuICAgIHRoaXMuZnJlZUxpc3QgPSBbXTtcbiAgICB0aGlzLmNvdW50ID0gMDtcbiAgICB0aGlzLlQgPSBUO1xuICAgIHRoaXMuaXNPYmplY3RQb29sID0gdHJ1ZTtcblxuICAgIHZhciBleHRyYUFyZ3MgPSBudWxsO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgZXh0cmFBcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIGV4dHJhQXJncy5zaGlmdCgpO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRlRWxlbWVudCA9IGV4dHJhQXJnc1xuICAgICAgPyAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBUKC4uLmV4dHJhQXJncyk7XG4gICAgICAgIH1cbiAgICAgIDogKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgVCgpO1xuICAgICAgICB9O1xuXG4gICAgaWYgKHR5cGVvZiBpbml0aWFsU2l6ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgdGhpcy5leHBhbmQoaW5pdGlhbFNpemUpO1xuICAgIH1cbiAgfVxuXG4gIGFxdWlyZSgpIHtcbiAgICAvLyBHcm93IHRoZSBsaXN0IGJ5IDIwJWlzaCBpZiB3ZSdyZSBvdXRcbiAgICBpZiAodGhpcy5mcmVlTGlzdC5sZW5ndGggPD0gMCkge1xuICAgICAgdGhpcy5leHBhbmQoTWF0aC5yb3VuZCh0aGlzLmNvdW50ICogMC4yKSArIDEpO1xuICAgIH1cblxuICAgIHZhciBpdGVtID0gdGhpcy5mcmVlTGlzdC5wb3AoKTtcblxuICAgIHJldHVybiBpdGVtO1xuICB9XG5cbiAgcmVsZWFzZShpdGVtKSB7XG4gICAgaXRlbS5yZXNldCgpO1xuICAgIHRoaXMuZnJlZUxpc3QucHVzaChpdGVtKTtcbiAgfVxuXG4gIGV4cGFuZChjb3VudCkge1xuICAgIGZvciAodmFyIG4gPSAwOyBuIDwgY291bnQ7IG4rKykge1xuICAgICAgdGhpcy5mcmVlTGlzdC5wdXNoKHRoaXMuY3JlYXRlRWxlbWVudCgpKTtcbiAgICB9XG4gICAgdGhpcy5jb3VudCArPSBjb3VudDtcbiAgfVxuXG4gIHRvdGFsU2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb3VudDtcbiAgfVxuXG4gIHRvdGFsRnJlZSgpIHtcbiAgICByZXR1cm4gdGhpcy5mcmVlTGlzdC5sZW5ndGg7XG4gIH1cblxuICB0b3RhbFVzZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuY291bnQgLSB0aGlzLmZyZWVMaXN0Lmxlbmd0aDtcbiAgfVxufVxuIiwiaW1wb3J0IFF1ZXJ5IGZyb20gXCIuL1F1ZXJ5LmpzXCI7XG5pbXBvcnQgeyBxdWVyeUtleSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbi8qKlxuICogQHByaXZhdGVcbiAqIEBjbGFzcyBRdWVyeU1hbmFnZXJcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUXVlcnlNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLl93b3JsZCA9IHdvcmxkO1xuXG4gICAgLy8gUXVlcmllcyBpbmRleGVkIGJ5IGEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBjb21wb25lbnRzIGl0IGhhc1xuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgfVxuXG4gIG9uRW50aXR5UmVtb3ZlZChlbnRpdHkpIHtcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdO1xuICAgICAgaWYgKGVudGl0eS5xdWVyaWVzLmluZGV4T2YocXVlcnkpICE9PSAtMSkge1xuICAgICAgICBxdWVyeS5yZW1vdmVFbnRpdHkoZW50aXR5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2hlbiBhIGNvbXBvbmVudCBpcyBhZGRlZCB0byBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdGhhdCBqdXN0IGdvdCB0aGUgbmV3IGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCBhZGRlZCB0byB0aGUgZW50aXR5XG4gICAqL1xuICBvbkVudGl0eUNvbXBvbmVudEFkZGVkKGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgLy8gQHRvZG8gVXNlIGJpdG1hc2sgZm9yIGNoZWNraW5nIGNvbXBvbmVudHM/XG5cbiAgICAvLyBDaGVjayBlYWNoIGluZGV4ZWQgcXVlcnkgdG8gc2VlIGlmIHdlIG5lZWQgdG8gYWRkIHRoaXMgZW50aXR5IHRvIHRoZSBsaXN0XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXTtcblxuICAgICAgaWYgKFxuICAgICAgICAhIX5xdWVyeS5Ob3RDb21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgICB+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpXG4gICAgICApIHtcbiAgICAgICAgcXVlcnkucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgdGhlIGVudGl0eSBvbmx5IGlmOlxuICAgICAgLy8gQ29tcG9uZW50IGlzIGluIHRoZSBxdWVyeVxuICAgICAgLy8gYW5kIEVudGl0eSBoYXMgQUxMIHRoZSBjb21wb25lbnRzIG9mIHRoZSBxdWVyeVxuICAgICAgLy8gYW5kIEVudGl0eSBpcyBub3QgYWxyZWFkeSBpbiB0aGUgcXVlcnlcbiAgICAgIGlmIChcbiAgICAgICAgIX5xdWVyeS5Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSB8fFxuICAgICAgICAhcXVlcnkubWF0Y2goZW50aXR5KSB8fFxuICAgICAgICB+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpXG4gICAgICApXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBxdWVyeS5hZGRFbnRpdHkoZW50aXR5KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2hlbiBhIGNvbXBvbmVudCBpcyByZW1vdmVkIGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRvIHJlbW92ZSB0aGUgY29tcG9uZW50IGZyb21cbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gcmVtb3ZlIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgb25FbnRpdHlDb21wb25lbnRSZW1vdmVkKGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXTtcblxuICAgICAgaWYgKFxuICAgICAgICAhIX5xdWVyeS5Ob3RDb21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgICAhfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KSAmJlxuICAgICAgICBxdWVyeS5tYXRjaChlbnRpdHkpXG4gICAgICApIHtcbiAgICAgICAgcXVlcnkuYWRkRW50aXR5KGVudGl0eSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgICEhfnF1ZXJ5LkNvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpICYmXG4gICAgICAgICEhfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KSAmJlxuICAgICAgICAhcXVlcnkubWF0Y2goZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIHF1ZXJ5LnJlbW92ZUVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgcXVlcnkgZm9yIHRoZSBzcGVjaWZpZWQgY29tcG9uZW50c1xuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50cyBDb21wb25lbnRzIHRoYXQgdGhlIHF1ZXJ5IHNob3VsZCBoYXZlXG4gICAqL1xuICBnZXRRdWVyeShDb21wb25lbnRzKSB7XG4gICAgdmFyIGtleSA9IHF1ZXJ5S2V5KENvbXBvbmVudHMpO1xuICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNba2V5XTtcbiAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICB0aGlzLl9xdWVyaWVzW2tleV0gPSBxdWVyeSA9IG5ldyBRdWVyeShDb21wb25lbnRzLCB0aGlzLl93b3JsZCk7XG4gICAgfVxuICAgIHJldHVybiBxdWVyeTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc29tZSBzdGF0cyBmcm9tIHRoaXMgY2xhc3NcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHt9O1xuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICBzdGF0c1txdWVyeU5hbWVdID0gdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdLnN0YXRzKCk7XG4gICAgfVxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuIiwiZXhwb3J0IGNsYXNzIFN5c3RlbVN0YXRlQ29tcG9uZW50IHt9XG5cblN5c3RlbVN0YXRlQ29tcG9uZW50LmlzU3lzdGVtU3RhdGVDb21wb25lbnQgPSB0cnVlO1xuIiwiaW1wb3J0IEVudGl0eSBmcm9tIFwiLi9FbnRpdHkuanNcIjtcbmltcG9ydCBPYmplY3RQb29sIGZyb20gXCIuL09iamVjdFBvb2wuanNcIjtcbmltcG9ydCBRdWVyeU1hbmFnZXIgZnJvbSBcIi4vUXVlcnlNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgRXZlbnREaXNwYXRjaGVyIGZyb20gXCIuL0V2ZW50RGlzcGF0Y2hlci5qc1wiO1xuaW1wb3J0IHsgY29tcG9uZW50UHJvcGVydHlOYW1lLCBnZXROYW1lIH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcbmltcG9ydCB7IFN5c3RlbVN0YXRlQ29tcG9uZW50IH0gZnJvbSBcIi4vU3lzdGVtU3RhdGVDb21wb25lbnQuanNcIjtcblxuLyoqXG4gKiBAcHJpdmF0ZVxuICogQGNsYXNzIEVudGl0eU1hbmFnZXJcbiAqL1xuZXhwb3J0IGNsYXNzIEVudGl0eU1hbmFnZXIge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyID0gd29ybGQuY29tcG9uZW50c01hbmFnZXI7XG5cbiAgICAvLyBBbGwgdGhlIGVudGl0aWVzIGluIHRoaXMgaW5zdGFuY2VcbiAgICB0aGlzLl9lbnRpdGllcyA9IFtdO1xuXG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyID0gbmV3IFF1ZXJ5TWFuYWdlcih0aGlzKTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlciA9IG5ldyBFdmVudERpc3BhdGNoZXIoKTtcbiAgICB0aGlzLl9lbnRpdHlQb29sID0gbmV3IE9iamVjdFBvb2woRW50aXR5KTtcblxuICAgIC8vIERlZmVycmVkIGRlbGV0aW9uXG4gICAgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUgPSBbXTtcbiAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUgPSBbXTtcbiAgICB0aGlzLmRlZmVycmVkUmVtb3ZhbEVuYWJsZWQgPSB0cnVlO1xuXG4gICAgdGhpcy5udW1TdGF0ZUNvbXBvbmVudHMgPSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBlbnRpdHlcbiAgICovXG4gIGNyZWF0ZUVudGl0eSgpIHtcbiAgICB2YXIgZW50aXR5ID0gdGhpcy5fZW50aXR5UG9vbC5hcXVpcmUoKTtcbiAgICBlbnRpdHkuYWxpdmUgPSB0cnVlO1xuICAgIGVudGl0eS5fd29ybGQgPSB0aGlzO1xuICAgIHRoaXMuX2VudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KEVOVElUWV9DUkVBVEVELCBlbnRpdHkpO1xuICAgIHJldHVybiBlbnRpdHk7XG4gIH1cblxuICAvLyBDT01QT05FTlRTXG5cbiAgLyoqXG4gICAqIEFkZCBhIGNvbXBvbmVudCB0byBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hlcmUgdGhlIGNvbXBvbmVudCB3aWxsIGJlIGFkZGVkXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIGJlIGFkZGVkIHRvIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtPYmplY3R9IHZhbHVlcyBPcHRpb25hbCB2YWx1ZXMgdG8gcmVwbGFjZSB0aGUgZGVmYXVsdCBhdHRyaWJ1dGVzXG4gICAqL1xuICBlbnRpdHlBZGRDb21wb25lbnQoZW50aXR5LCBDb21wb25lbnQsIHZhbHVlcykge1xuICAgIGlmICh+ZW50aXR5Ll9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCkpIHJldHVybjtcblxuICAgIGVudGl0eS5fQ29tcG9uZW50VHlwZXMucHVzaChDb21wb25lbnQpO1xuXG4gICAgaWYgKENvbXBvbmVudC5fX3Byb3RvX18gPT09IFN5c3RlbVN0YXRlQ29tcG9uZW50KSB7XG4gICAgICB0aGlzLm51bVN0YXRlQ29tcG9uZW50cysrO1xuICAgIH1cblxuICAgIHZhciBjb21wb25lbnRQb29sID0gdGhpcy53b3JsZC5jb21wb25lbnRzTWFuYWdlci5nZXRDb21wb25lbnRzUG9vbChcbiAgICAgIENvbXBvbmVudFxuICAgICk7XG4gICAgdmFyIGNvbXBvbmVudCA9IGNvbXBvbmVudFBvb2wuYXF1aXJlKCk7XG5cbiAgICBlbnRpdHkuX2NvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gY29tcG9uZW50O1xuXG4gICAgaWYgKHZhbHVlcykge1xuICAgICAgaWYgKGNvbXBvbmVudC5jb3B5KSB7XG4gICAgICAgIGNvbXBvbmVudC5jb3B5KHZhbHVlcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKHZhciBuYW1lIGluIHZhbHVlcykge1xuICAgICAgICAgIGNvbXBvbmVudFtuYW1lXSA9IHZhbHVlc1tuYW1lXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX3F1ZXJ5TWFuYWdlci5vbkVudGl0eUNvbXBvbmVudEFkZGVkKGVudGl0eSwgQ29tcG9uZW50KTtcbiAgICB0aGlzLndvcmxkLmNvbXBvbmVudHNNYW5hZ2VyLmNvbXBvbmVudEFkZGVkVG9FbnRpdHkoQ29tcG9uZW50KTtcblxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoQ09NUE9ORU5UX0FEREVELCBlbnRpdHksIENvbXBvbmVudCk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgY29tcG9uZW50IGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHdoaWNoIHdpbGwgZ2V0IHJlbW92ZWQgdGhlIGNvbXBvbmVudFxuICAgKiBAcGFyYW0geyp9IENvbXBvbmVudCBDb21wb25lbnQgdG8gcmVtb3ZlIGZyb20gdGhlIGVudGl0eVxuICAgKiBAcGFyYW0ge0Jvb2x9IGltbWVkaWF0ZWx5IElmIHlvdSB3YW50IHRvIHJlbW92ZSB0aGUgY29tcG9uZW50IGltbWVkaWF0ZWx5IGluc3RlYWQgb2YgZGVmZXJyZWQgKERlZmF1bHQgaXMgZmFsc2UpXG4gICAqL1xuICBlbnRpdHlSZW1vdmVDb21wb25lbnQoZW50aXR5LCBDb21wb25lbnQsIGltbWVkaWF0ZWx5KSB7XG4gICAgdmFyIGluZGV4ID0gZW50aXR5Ll9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCk7XG4gICAgaWYgKCF+aW5kZXgpIHJldHVybjtcblxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoQ09NUE9ORU5UX1JFTU9WRSwgZW50aXR5LCBDb21wb25lbnQpO1xuXG4gICAgaWYgKGltbWVkaWF0ZWx5KSB7XG4gICAgICB0aGlzLl9lbnRpdHlSZW1vdmVDb21wb25lbnRTeW5jKGVudGl0eSwgQ29tcG9uZW50LCBpbmRleCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChlbnRpdHkuX0NvbXBvbmVudFR5cGVzVG9SZW1vdmUubGVuZ3RoID09PSAwKVxuICAgICAgICB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZS5wdXNoKGVudGl0eSk7XG5cbiAgICAgIGVudGl0eS5fQ29tcG9uZW50VHlwZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIGVudGl0eS5fQ29tcG9uZW50VHlwZXNUb1JlbW92ZS5wdXNoKENvbXBvbmVudCk7XG5cbiAgICAgIHZhciBjb21wb25lbnROYW1lID0gZ2V0TmFtZShDb21wb25lbnQpO1xuICAgICAgZW50aXR5Ll9jb21wb25lbnRzVG9SZW1vdmVbY29tcG9uZW50TmFtZV0gPVxuICAgICAgICBlbnRpdHkuX2NvbXBvbmVudHNbY29tcG9uZW50TmFtZV07XG4gICAgICBkZWxldGUgZW50aXR5Ll9jb21wb25lbnRzW2NvbXBvbmVudE5hbWVdO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGVhY2ggaW5kZXhlZCBxdWVyeSB0byBzZWUgaWYgd2UgbmVlZCB0byByZW1vdmUgaXRcbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIub25FbnRpdHlDb21wb25lbnRSZW1vdmVkKGVudGl0eSwgQ29tcG9uZW50KTtcblxuICAgIGlmIChDb21wb25lbnQuX19wcm90b19fID09PSBTeXN0ZW1TdGF0ZUNvbXBvbmVudCkge1xuICAgICAgdGhpcy5udW1TdGF0ZUNvbXBvbmVudHMtLTtcblxuICAgICAgLy8gQ2hlY2sgaWYgdGhlIGVudGl0eSB3YXMgYSBnaG9zdCB3YWl0aW5nIGZvciB0aGUgbGFzdCBzeXN0ZW0gc3RhdGUgY29tcG9uZW50IHRvIGJlIHJlbW92ZWRcbiAgICAgIGlmICh0aGlzLm51bVN0YXRlQ29tcG9uZW50cyA9PT0gMCAmJiAhZW50aXR5LmFsaXZlKSB7XG4gICAgICAgIGVudGl0eS5yZW1vdmUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfZW50aXR5UmVtb3ZlQ29tcG9uZW50U3luYyhlbnRpdHksIENvbXBvbmVudCwgaW5kZXgpIHtcbiAgICAvLyBSZW1vdmUgVCBsaXN0aW5nIG9uIGVudGl0eSBhbmQgcHJvcGVydHkgcmVmLCB0aGVuIGZyZWUgdGhlIGNvbXBvbmVudC5cbiAgICBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgdmFyIHByb3BOYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG4gICAgdmFyIGNvbXBvbmVudE5hbWUgPSBnZXROYW1lKENvbXBvbmVudCk7XG4gICAgdmFyIGNvbXBvbmVudCA9IGVudGl0eS5fY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcbiAgICBkZWxldGUgZW50aXR5Ll9jb21wb25lbnRzW2NvbXBvbmVudE5hbWVdO1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2xbcHJvcE5hbWVdLnJlbGVhc2UoY29tcG9uZW50KTtcbiAgICB0aGlzLndvcmxkLmNvbXBvbmVudHNNYW5hZ2VyLmNvbXBvbmVudFJlbW92ZWRGcm9tRW50aXR5KENvbXBvbmVudCk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0aGUgY29tcG9uZW50cyBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSBmcm9tIHdoaWNoIHRoZSBjb21wb25lbnRzIHdpbGwgYmUgcmVtb3ZlZFxuICAgKi9cbiAgZW50aXR5UmVtb3ZlQWxsQ29tcG9uZW50cyhlbnRpdHksIGltbWVkaWF0ZWx5KSB7XG4gICAgbGV0IENvbXBvbmVudHMgPSBlbnRpdHkuX0NvbXBvbmVudFR5cGVzO1xuXG4gICAgZm9yIChsZXQgaiA9IENvbXBvbmVudHMubGVuZ3RoIC0gMTsgaiA+PSAwOyBqLS0pIHtcbiAgICAgIGlmIChDb21wb25lbnRzW2pdLl9fcHJvdG9fXyAhPT0gU3lzdGVtU3RhdGVDb21wb25lbnQpXG4gICAgICAgIHRoaXMuZW50aXR5UmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50c1tqXSwgaW1tZWRpYXRlbHkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhlIGVudGl0eSBmcm9tIHRoaXMgbWFuYWdlci4gSXQgd2lsbCBjbGVhciBhbHNvIGl0cyBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRvIHJlbW92ZSBmcm9tIHRoZSBtYW5hZ2VyXG4gICAqIEBwYXJhbSB7Qm9vbH0gaW1tZWRpYXRlbHkgSWYgeW91IHdhbnQgdG8gcmVtb3ZlIHRoZSBjb21wb25lbnQgaW1tZWRpYXRlbHkgaW5zdGVhZCBvZiBkZWZlcnJlZCAoRGVmYXVsdCBpcyBmYWxzZSlcbiAgICovXG4gIHJlbW92ZUVudGl0eShlbnRpdHksIGltbWVkaWF0ZWx5KSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5fZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuXG4gICAgaWYgKCF+aW5kZXgpIHRocm93IG5ldyBFcnJvcihcIlRyaWVkIHRvIHJlbW92ZSBlbnRpdHkgbm90IGluIGxpc3RcIik7XG5cbiAgICBlbnRpdHkuYWxpdmUgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLm51bVN0YXRlQ29tcG9uZW50cyA9PT0gMCkge1xuICAgICAgLy8gUmVtb3ZlIGZyb20gZW50aXR5IGxpc3RcbiAgICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoRU5USVRZX1JFTU9WRUQsIGVudGl0eSk7XG4gICAgICB0aGlzLl9xdWVyeU1hbmFnZXIub25FbnRpdHlSZW1vdmVkKGVudGl0eSk7XG4gICAgICBpZiAoaW1tZWRpYXRlbHkgPT09IHRydWUpIHtcbiAgICAgICAgdGhpcy5fcmVsZWFzZUVudGl0eShlbnRpdHksIGluZGV4KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZW50aXRpZXNUb1JlbW92ZS5wdXNoKGVudGl0eSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5lbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKGVudGl0eSwgaW1tZWRpYXRlbHkpO1xuICB9XG5cbiAgX3JlbGVhc2VFbnRpdHkoZW50aXR5LCBpbmRleCkge1xuICAgIHRoaXMuX2VudGl0aWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAvLyBQcmV2ZW50IGFueSBhY2Nlc3MgYW5kIGZyZWVcbiAgICBlbnRpdHkuX3dvcmxkID0gbnVsbDtcbiAgICB0aGlzLl9lbnRpdHlQb29sLnJlbGVhc2UoZW50aXR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIGVudGl0aWVzIGZyb20gdGhpcyBtYW5hZ2VyXG4gICAqL1xuICByZW1vdmVBbGxFbnRpdGllcygpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5fZW50aXRpZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHRoaXMucmVtb3ZlRW50aXR5KHRoaXMuX2VudGl0aWVzW2ldKTtcbiAgICB9XG4gIH1cblxuICBwcm9jZXNzRGVmZXJyZWRSZW1vdmFsKCkge1xuICAgIGlmICghdGhpcy5kZWZlcnJlZFJlbW92YWxFbmFibGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmVudGl0aWVzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBlbnRpdHkgPSB0aGlzLmVudGl0aWVzVG9SZW1vdmVbaV07XG4gICAgICBsZXQgaW5kZXggPSB0aGlzLl9lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgICB0aGlzLl9yZWxlYXNlRW50aXR5KGVudGl0eSwgaW5kZXgpO1xuICAgIH1cbiAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUubGVuZ3RoID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBlbnRpdHkgPSB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZVtpXTtcbiAgICAgIHdoaWxlIChlbnRpdHkuX0NvbXBvbmVudFR5cGVzVG9SZW1vdmUubGVuZ3RoID4gMCkge1xuICAgICAgICBsZXQgQ29tcG9uZW50ID0gZW50aXR5Ll9Db21wb25lbnRUeXBlc1RvUmVtb3ZlLnBvcCgpO1xuXG4gICAgICAgIHZhciBwcm9wTmFtZSA9IGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpO1xuICAgICAgICB2YXIgY29tcG9uZW50TmFtZSA9IGdldE5hbWUoQ29tcG9uZW50KTtcbiAgICAgICAgdmFyIGNvbXBvbmVudCA9IGVudGl0eS5fY29tcG9uZW50c1RvUmVtb3ZlW2NvbXBvbmVudE5hbWVdO1xuICAgICAgICBkZWxldGUgZW50aXR5Ll9jb21wb25lbnRzVG9SZW1vdmVbY29tcG9uZW50TmFtZV07XG4gICAgICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2xbcHJvcE5hbWVdLnJlbGVhc2UoY29tcG9uZW50KTtcbiAgICAgICAgdGhpcy53b3JsZC5jb21wb25lbnRzTWFuYWdlci5jb21wb25lbnRSZW1vdmVkRnJvbUVudGl0eShDb21wb25lbnQpO1xuXG4gICAgICAgIC8vdGhpcy5fZW50aXR5UmVtb3ZlQ29tcG9uZW50U3luYyhlbnRpdHksIENvbXBvbmVudCwgaW5kZXgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlLmxlbmd0aCA9IDA7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgcXVlcnkgYmFzZWQgb24gYSBsaXN0IG9mIGNvbXBvbmVudHNcbiAgICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIExpc3Qgb2YgY29tcG9uZW50cyB0aGF0IHdpbGwgZm9ybSB0aGUgcXVlcnlcbiAgICovXG4gIHF1ZXJ5Q29tcG9uZW50cyhDb21wb25lbnRzKSB7XG4gICAgcmV0dXJuIHRoaXMuX3F1ZXJ5TWFuYWdlci5nZXRRdWVyeShDb21wb25lbnRzKTtcbiAgfVxuXG4gIC8vIEVYVFJBU1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gbnVtYmVyIG9mIGVudGl0aWVzXG4gICAqL1xuICBjb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZW50aXRpZXMubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzb21lIHN0YXRzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBudW1FbnRpdGllczogdGhpcy5fZW50aXRpZXMubGVuZ3RoLFxuICAgICAgbnVtUXVlcmllczogT2JqZWN0LmtleXModGhpcy5fcXVlcnlNYW5hZ2VyLl9xdWVyaWVzKS5sZW5ndGgsXG4gICAgICBxdWVyaWVzOiB0aGlzLl9xdWVyeU1hbmFnZXIuc3RhdHMoKSxcbiAgICAgIG51bUNvbXBvbmVudFBvb2w6IE9iamVjdC5rZXlzKHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2wpXG4gICAgICAgIC5sZW5ndGgsXG4gICAgICBjb21wb25lbnRQb29sOiB7fSxcbiAgICAgIGV2ZW50RGlzcGF0Y2hlcjogdGhpcy5ldmVudERpc3BhdGNoZXIuc3RhdHNcbiAgICB9O1xuXG4gICAgZm9yICh2YXIgY25hbWUgaW4gdGhpcy5jb21wb25lbnRzTWFuYWdlci5fY29tcG9uZW50UG9vbCkge1xuICAgICAgdmFyIHBvb2wgPSB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLl9jb21wb25lbnRQb29sW2NuYW1lXTtcbiAgICAgIHN0YXRzLmNvbXBvbmVudFBvb2xbY25hbWVdID0ge1xuICAgICAgICB1c2VkOiBwb29sLnRvdGFsVXNlZCgpLFxuICAgICAgICBzaXplOiBwb29sLmNvdW50XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuXG5jb25zdCBFTlRJVFlfQ1JFQVRFRCA9IFwiRW50aXR5TWFuYWdlciNFTlRJVFlfQ1JFQVRFXCI7XG5jb25zdCBFTlRJVFlfUkVNT1ZFRCA9IFwiRW50aXR5TWFuYWdlciNFTlRJVFlfUkVNT1ZFRFwiO1xuY29uc3QgQ09NUE9ORU5UX0FEREVEID0gXCJFbnRpdHlNYW5hZ2VyI0NPTVBPTkVOVF9BRERFRFwiO1xuY29uc3QgQ09NUE9ORU5UX1JFTU9WRSA9IFwiRW50aXR5TWFuYWdlciNDT01QT05FTlRfUkVNT1ZFXCI7XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBEdW1teU9iamVjdFBvb2wge1xuICBjb25zdHJ1Y3RvcihUKSB7XG4gICAgdGhpcy5pc0R1bW15T2JqZWN0UG9vbCA9IHRydWU7XG4gICAgdGhpcy5jb3VudCA9IDA7XG4gICAgdGhpcy51c2VkID0gMDtcbiAgICB0aGlzLlQgPSBUO1xuICB9XG5cbiAgYXF1aXJlKCkge1xuICAgIHRoaXMudXNlZCsrO1xuICAgIHRoaXMuY291bnQrKztcbiAgICByZXR1cm4gbmV3IHRoaXMuVCgpO1xuICB9XG5cbiAgcmVsZWFzZSgpIHtcbiAgICB0aGlzLnVzZWQtLTtcbiAgfVxuXG4gIHRvdGFsU2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb3VudDtcbiAgfVxuXG4gIHRvdGFsRnJlZSgpIHtcbiAgICByZXR1cm4gSW5maW5pdHk7XG4gIH1cblxuICB0b3RhbFVzZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMudXNlZDtcbiAgfVxufVxuIiwiaW1wb3J0IE9iamVjdFBvb2wgZnJvbSBcIi4vT2JqZWN0UG9vbC5qc1wiO1xuaW1wb3J0IER1bW15T2JqZWN0UG9vbCBmcm9tIFwiLi9EdW1teU9iamVjdFBvb2wuanNcIjtcbmltcG9ydCB7IGNvbXBvbmVudFByb3BlcnR5TmFtZSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBDb21wb25lbnRNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5Db21wb25lbnRzID0ge307XG4gICAgdGhpcy5fY29tcG9uZW50UG9vbCA9IHt9O1xuICAgIHRoaXMubnVtQ29tcG9uZW50cyA9IHt9O1xuICB9XG5cbiAgcmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgaWYgKHRoaXMuQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0pIHtcbiAgICAgIGNvbnNvbGUud2FybihgQ29tcG9uZW50IHR5cGU6ICcke0NvbXBvbmVudC5uYW1lfScgYWxyZWFkeSByZWdpc3RlcmVkLmApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBDb21wb25lbnQ7XG4gICAgdGhpcy5udW1Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IDA7XG4gIH1cblxuICBjb21wb25lbnRBZGRlZFRvRW50aXR5KENvbXBvbmVudCkge1xuICAgIGlmICghdGhpcy5Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSkge1xuICAgICAgdGhpcy5yZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIH1cblxuICAgIHRoaXMubnVtQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0rKztcbiAgfVxuXG4gIGNvbXBvbmVudFJlbW92ZWRGcm9tRW50aXR5KENvbXBvbmVudCkge1xuICAgIHRoaXMubnVtQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0tLTtcbiAgfVxuXG4gIGdldENvbXBvbmVudHNQb29sKENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnROYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG5cbiAgICBpZiAoIXRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0pIHtcbiAgICAgIGlmIChDb21wb25lbnQucHJvdG90eXBlLnJlc2V0KSB7XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0gPSBuZXcgT2JqZWN0UG9vbChDb21wb25lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBDb21wb25lbnQgJyR7Q29tcG9uZW50Lm5hbWV9JyB3b24ndCBiZW5lZml0IGZyb20gcG9vbGluZyBiZWNhdXNlICdyZXNldCcgbWV0aG9kIHdhcyBub3QgaW1wbGVtZW5ldGVkLmBcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXSA9IG5ldyBEdW1teU9iamVjdFBvb2woQ29tcG9uZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXTtcbiAgfVxufVxuIiwiaW1wb3J0IHBqc29uIGZyb20gXCIuLi9wYWNrYWdlLmpzb25cIjtcbmV4cG9ydCBjb25zdCBWZXJzaW9uID0gcGpzb24udmVyc2lvbjtcbiIsImltcG9ydCB7IFN5c3RlbU1hbmFnZXIgfSBmcm9tIFwiLi9TeXN0ZW1NYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBFbnRpdHlNYW5hZ2VyIH0gZnJvbSBcIi4vRW50aXR5TWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgQ29tcG9uZW50TWFuYWdlciB9IGZyb20gXCIuL0NvbXBvbmVudE1hbmFnZXIuanNcIjtcbmltcG9ydCB7IFZlcnNpb24gfSBmcm9tIFwiLi9WZXJzaW9uLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBXb3JsZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIgPSBuZXcgQ29tcG9uZW50TWFuYWdlcih0aGlzKTtcbiAgICB0aGlzLmVudGl0eU1hbmFnZXIgPSBuZXcgRW50aXR5TWFuYWdlcih0aGlzKTtcbiAgICB0aGlzLnN5c3RlbU1hbmFnZXIgPSBuZXcgU3lzdGVtTWFuYWdlcih0aGlzKTtcblxuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cbiAgICB0aGlzLmV2ZW50UXVldWVzID0ge307XG5cbiAgICBpZiAodHlwZW9mIEN1c3RvbUV2ZW50ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICB2YXIgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoXCJlY3N5LXdvcmxkLWNyZWF0ZWRcIiwge1xuICAgICAgICBkZXRhaWw6IHsgd29ybGQ6IHRoaXMsIHZlcnNpb246IFZlcnNpb24gfVxuICAgICAgfSk7XG4gICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChldmVudCk7XG4gICAgfVxuXG4gICAgdGhpcy5sYXN0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICB9XG5cbiAgcmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5yZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtLCBhdHRyaWJ1dGVzKSB7XG4gICAgdGhpcy5zeXN0ZW1NYW5hZ2VyLnJlZ2lzdGVyU3lzdGVtKFN5c3RlbSwgYXR0cmlidXRlcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBnZXRTeXN0ZW0oU3lzdGVtQ2xhc3MpIHtcbiAgICByZXR1cm4gdGhpcy5zeXN0ZW1NYW5hZ2VyLmdldFN5c3RlbShTeXN0ZW1DbGFzcyk7XG4gIH1cblxuICBnZXRTeXN0ZW1zKCkge1xuICAgIHJldHVybiB0aGlzLnN5c3RlbU1hbmFnZXIuZ2V0U3lzdGVtcygpO1xuICB9XG5cbiAgZXhlY3V0ZShkZWx0YSwgdGltZSkge1xuICAgIGlmICghZGVsdGEpIHtcbiAgICAgIGxldCB0aW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICBkZWx0YSA9IHRpbWUgLSB0aGlzLmxhc3RUaW1lO1xuICAgICAgdGhpcy5sYXN0VGltZSA9IHRpbWU7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZW5hYmxlZCkge1xuICAgICAgdGhpcy5zeXN0ZW1NYW5hZ2VyLmV4ZWN1dGUoZGVsdGEsIHRpbWUpO1xuICAgICAgdGhpcy5lbnRpdHlNYW5hZ2VyLnByb2Nlc3NEZWZlcnJlZFJlbW92YWwoKTtcbiAgICB9XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICB9XG5cbiAgcGxheSgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuICB9XG5cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLmVudGl0eU1hbmFnZXIuY3JlYXRlRW50aXR5KCk7XG4gIH1cblxuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBlbnRpdGllczogdGhpcy5lbnRpdHlNYW5hZ2VyLnN0YXRzKCksXG4gICAgICBzeXN0ZW06IHRoaXMuc3lzdGVtTWFuYWdlci5zdGF0cygpXG4gICAgfTtcblxuICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHN0YXRzLCBudWxsLCAyKSk7XG4gIH1cbn1cbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgU3lzdGVtIHtcbiAgY2FuRXhlY3V0ZSgpIHtcbiAgICBpZiAodGhpcy5fbWFuZGF0b3J5UXVlcmllcy5sZW5ndGggPT09IDApIHJldHVybiB0cnVlO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzW2ldO1xuICAgICAgaWYgKHF1ZXJ5LmVudGl0aWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcih3b3JsZCwgYXR0cmlidXRlcykge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgLy8gQHRvZG8gQmV0dGVyIG5hbWluZyA6KVxuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgICB0aGlzLnF1ZXJpZXMgPSB7fTtcblxuICAgIHRoaXMucHJpb3JpdHkgPSAwO1xuXG4gICAgLy8gVXNlZCBmb3Igc3RhdHNcbiAgICB0aGlzLmV4ZWN1dGVUaW1lID0gMDtcblxuICAgIGlmIChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXMucHJpb3JpdHkpIHtcbiAgICAgIHRoaXMucHJpb3JpdHkgPSBhdHRyaWJ1dGVzLnByaW9yaXR5O1xuICAgIH1cblxuICAgIHRoaXMuX21hbmRhdG9yeVF1ZXJpZXMgPSBbXTtcblxuICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgaWYgKHRoaXMuY29uc3RydWN0b3IucXVlcmllcykge1xuICAgICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuY29uc3RydWN0b3IucXVlcmllcykge1xuICAgICAgICB2YXIgcXVlcnlDb25maWcgPSB0aGlzLmNvbnN0cnVjdG9yLnF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAgdmFyIENvbXBvbmVudHMgPSBxdWVyeUNvbmZpZy5jb21wb25lbnRzO1xuICAgICAgICBpZiAoIUNvbXBvbmVudHMgfHwgQ29tcG9uZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCInY29tcG9uZW50cycgYXR0cmlidXRlIGNhbid0IGJlIGVtcHR5IGluIGEgcXVlcnlcIik7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy53b3JsZC5lbnRpdHlNYW5hZ2VyLnF1ZXJ5Q29tcG9uZW50cyhDb21wb25lbnRzKTtcbiAgICAgICAgdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdID0gcXVlcnk7XG4gICAgICAgIGlmIChxdWVyeUNvbmZpZy5tYW5kYXRvcnkgPT09IHRydWUpIHtcbiAgICAgICAgICB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzLnB1c2gocXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucXVlcmllc1txdWVyeU5hbWVdID0ge1xuICAgICAgICAgIHJlc3VsdHM6IHF1ZXJ5LmVudGl0aWVzXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmVhY3RpdmUgY29uZmlndXJhdGlvbiBhZGRlZC9yZW1vdmVkL2NoYW5nZWRcbiAgICAgICAgdmFyIHZhbGlkRXZlbnRzID0gW1wiYWRkZWRcIiwgXCJyZW1vdmVkXCIsIFwiY2hhbmdlZFwiXTtcblxuICAgICAgICBjb25zdCBldmVudE1hcHBpbmcgPSB7XG4gICAgICAgICAgYWRkZWQ6IFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQsXG4gICAgICAgICAgcmVtb3ZlZDogUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICAgIGNoYW5nZWQ6IFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCAvLyBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0NIQU5HRURcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAocXVlcnlDb25maWcubGlzdGVuKSB7XG4gICAgICAgICAgdmFsaWRFdmVudHMuZm9yRWFjaChldmVudE5hbWUgPT4ge1xuICAgICAgICAgICAgLy8gSXMgdGhlIGV2ZW50IGVuYWJsZWQgb24gdGhpcyBzeXN0ZW0ncyBxdWVyeT9cbiAgICAgICAgICAgIGlmIChxdWVyeUNvbmZpZy5saXN0ZW5bZXZlbnROYW1lXSkge1xuICAgICAgICAgICAgICBsZXQgZXZlbnQgPSBxdWVyeUNvbmZpZy5saXN0ZW5bZXZlbnROYW1lXTtcblxuICAgICAgICAgICAgICBpZiAoZXZlbnROYW1lID09PSBcImNoYW5nZWRcIikge1xuICAgICAgICAgICAgICAgIHF1ZXJ5LnJlYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgIC8vIEFueSBjaGFuZ2Ugb24gdGhlIGVudGl0eSBmcm9tIHRoZSBjb21wb25lbnRzIGluIHRoZSBxdWVyeVxuICAgICAgICAgICAgICAgICAgbGV0IGV2ZW50TGlzdCA9ICh0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXVtldmVudE5hbWVdID0gW10pO1xuICAgICAgICAgICAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyBBdm9pZCBkdXBsaWNhdGVzXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50TGlzdC5pbmRleE9mKGVudGl0eSkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZXZlbnQpKSB7XG4gICAgICAgICAgICAgICAgICBsZXQgZXZlbnRMaXN0ID0gKHRoaXMucXVlcmllc1txdWVyeU5hbWVdW2V2ZW50TmFtZV0gPSBbXSk7XG4gICAgICAgICAgICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICAgICAgICAgICAgICAoZW50aXR5LCBjaGFuZ2VkQ29tcG9uZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8gQXZvaWQgZHVwbGljYXRlc1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LmluZGV4T2YoY2hhbmdlZENvbXBvbmVudC5jb25zdHJ1Y3RvcikgIT09IC0xICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QuaW5kZXhPZihlbnRpdHkpID09PSAtMVxuICAgICAgICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRMaXN0LnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgICAvLyBDaGVja2luZyBqdXN0IHNwZWNpZmljIGNvbXBvbmVudHNcbiAgICAgICAgICAgICAgICAgIGxldCBjaGFuZ2VkTGlzdCA9ICh0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXVtldmVudE5hbWVdID0ge30pO1xuICAgICAgICAgICAgICAgICAgZXZlbnQuZm9yRWFjaChjb21wb25lbnQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgZXZlbnRMaXN0ID0gKGNoYW5nZWRMaXN0W1xuICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFByb3BlcnR5TmFtZShjb21wb25lbnQpXG4gICAgICAgICAgICAgICAgICAgIF0gPSBbXSk7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAgICAgICAoZW50aXR5LCBjaGFuZ2VkQ29tcG9uZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZWRDb21wb25lbnQuY29uc3RydWN0b3IgPT09IGNvbXBvbmVudCAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QuaW5kZXhPZihlbnRpdHkpID09PSAtMVxuICAgICAgICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50TGlzdC5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgZXZlbnRMaXN0ID0gKHRoaXMucXVlcmllc1txdWVyeU5hbWVdW2V2ZW50TmFtZV0gPSBbXSk7XG5cbiAgICAgICAgICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgIGV2ZW50TWFwcGluZ1tldmVudE5hbWVdLFxuICAgICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQGZpeG1lIG92ZXJoZWFkP1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnRMaXN0LmluZGV4T2YoZW50aXR5KSA9PT0gLTEpXG4gICAgICAgICAgICAgICAgICAgICAgZXZlbnRMaXN0LnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHRoaXMuZXhlY3V0ZVRpbWUgPSAwO1xuICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICB9XG5cbiAgcGxheSgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuICB9XG5cbiAgLy8gQHF1ZXN0aW9uIHJlbmFtZSB0byBjbGVhciBxdWV1ZXM/XG4gIGNsZWFyRXZlbnRzKCkge1xuICAgIGZvciAobGV0IHF1ZXJ5TmFtZSBpbiB0aGlzLnF1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMucXVlcmllc1txdWVyeU5hbWVdO1xuICAgICAgaWYgKHF1ZXJ5LmFkZGVkKSB7XG4gICAgICAgIHF1ZXJ5LmFkZGVkLmxlbmd0aCA9IDA7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkucmVtb3ZlZCkge1xuICAgICAgICBxdWVyeS5yZW1vdmVkLmxlbmd0aCA9IDA7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkuY2hhbmdlZCkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShxdWVyeS5jaGFuZ2VkKSkge1xuICAgICAgICAgIHF1ZXJ5LmNoYW5nZWQubGVuZ3RoID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmb3IgKGxldCBuYW1lIGluIHF1ZXJ5LmNoYW5nZWQpIHtcbiAgICAgICAgICAgIHF1ZXJ5LmNoYW5nZWRbbmFtZV0ubGVuZ3RoID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0b0pTT04oKSB7XG4gICAgdmFyIGpzb24gPSB7XG4gICAgICBuYW1lOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICBlbmFibGVkOiB0aGlzLmVuYWJsZWQsXG4gICAgICBleGVjdXRlVGltZTogdGhpcy5leGVjdXRlVGltZSxcbiAgICAgIHByaW9yaXR5OiB0aGlzLnByaW9yaXR5LFxuICAgICAgcXVlcmllczoge31cbiAgICB9O1xuXG4gICAgaWYgKHRoaXMuY29uc3RydWN0b3IucXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJpZXMgPSB0aGlzLmNvbnN0cnVjdG9yLnF1ZXJpZXM7XG4gICAgICBmb3IgKGxldCBxdWVyeU5hbWUgaW4gcXVlcmllcykge1xuICAgICAgICBsZXQgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAgbGV0IHF1ZXJ5RGVmaW5pdGlvbiA9IHF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAgbGV0IGpzb25RdWVyeSA9IChqc29uLnF1ZXJpZXNbcXVlcnlOYW1lXSA9IHtcbiAgICAgICAgICBrZXk6IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXS5rZXlcbiAgICAgICAgfSk7XG5cbiAgICAgICAganNvblF1ZXJ5Lm1hbmRhdG9yeSA9IHF1ZXJ5RGVmaW5pdGlvbi5tYW5kYXRvcnkgPT09IHRydWU7XG4gICAgICAgIGpzb25RdWVyeS5yZWFjdGl2ZSA9XG4gICAgICAgICAgcXVlcnlEZWZpbml0aW9uLmxpc3RlbiAmJlxuICAgICAgICAgIChxdWVyeURlZmluaXRpb24ubGlzdGVuLmFkZGVkID09PSB0cnVlIHx8XG4gICAgICAgICAgICBxdWVyeURlZmluaXRpb24ubGlzdGVuLnJlbW92ZWQgPT09IHRydWUgfHxcbiAgICAgICAgICAgIHF1ZXJ5RGVmaW5pdGlvbi5saXN0ZW4uY2hhbmdlZCA9PT0gdHJ1ZSB8fFxuICAgICAgICAgICAgQXJyYXkuaXNBcnJheShxdWVyeURlZmluaXRpb24ubGlzdGVuLmNoYW5nZWQpKTtcblxuICAgICAgICBpZiAoanNvblF1ZXJ5LnJlYWN0aXZlKSB7XG4gICAgICAgICAganNvblF1ZXJ5Lmxpc3RlbiA9IHt9O1xuXG4gICAgICAgICAgY29uc3QgbWV0aG9kcyA9IFtcImFkZGVkXCIsIFwicmVtb3ZlZFwiLCBcImNoYW5nZWRcIl07XG4gICAgICAgICAgbWV0aG9kcy5mb3JFYWNoKG1ldGhvZCA9PiB7XG4gICAgICAgICAgICBpZiAocXVlcnlbbWV0aG9kXSkge1xuICAgICAgICAgICAgICBqc29uUXVlcnkubGlzdGVuW21ldGhvZF0gPSB7XG4gICAgICAgICAgICAgICAgZW50aXRpZXM6IHF1ZXJ5W21ldGhvZF0ubGVuZ3RoXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ganNvbjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gTm90KENvbXBvbmVudCkge1xuICByZXR1cm4ge1xuICAgIG9wZXJhdG9yOiBcIm5vdFwiLFxuICAgIENvbXBvbmVudDogQ29tcG9uZW50XG4gIH07XG59XG4iLCJleHBvcnQgY2xhc3MgQ29tcG9uZW50IHt9XG5cbkNvbXBvbmVudC5pc0NvbXBvbmVudCA9IHRydWU7XG4iLCJleHBvcnQgY2xhc3MgVGFnQ29tcG9uZW50IHtcbiAgcmVzZXQoKSB7fVxufVxuXG5UYWdDb21wb25lbnQuaXNUYWdDb21wb25lbnQgPSB0cnVlO1xuIiwiZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVR5cGUodHlwZURlZmluaXRpb24pIHtcbiAgdmFyIG1hbmRhdG9yeUZ1bmN0aW9ucyA9IFtcbiAgICBcImNyZWF0ZVwiLFxuICAgIFwicmVzZXRcIixcbiAgICBcImNsZWFyXCJcbiAgICAvKlwiY29weVwiKi9cbiAgXTtcblxuICB2YXIgdW5kZWZpbmVkRnVuY3Rpb25zID0gbWFuZGF0b3J5RnVuY3Rpb25zLmZpbHRlcihmID0+IHtcbiAgICByZXR1cm4gIXR5cGVEZWZpbml0aW9uW2ZdO1xuICB9KTtcblxuICBpZiAodW5kZWZpbmVkRnVuY3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgY3JlYXRlVHlwZSBleHBlY3QgdHlwZSBkZWZpbml0aW9uIHRvIGltcGxlbWVudHMgdGhlIGZvbGxvd2luZyBmdW5jdGlvbnM6ICR7dW5kZWZpbmVkRnVuY3Rpb25zLmpvaW4oXG4gICAgICAgIFwiLCBcIlxuICAgICAgKX1gXG4gICAgKTtcbiAgfVxuXG4gIHR5cGVEZWZpbml0aW9uLmlzVHlwZSA9IHRydWU7XG4gIHJldHVybiB0eXBlRGVmaW5pdGlvbjtcbn1cbiIsImltcG9ydCB7IGNyZWF0ZVR5cGUgfSBmcm9tIFwiLi9DcmVhdGVUeXBlXCI7XG5cbi8qKlxuICogU3RhbmRhcmQgdHlwZXNcbiAqL1xudmFyIFR5cGVzID0ge307XG5cblR5cGVzLk51bWJlciA9IGNyZWF0ZVR5cGUoe1xuICBiYXNlVHlwZTogTnVtYmVyLFxuICBpc1NpbXBsZVR5cGU6IHRydWUsXG4gIGNyZWF0ZTogZGVmYXVsdFZhbHVlID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIGRlZmF1bHRWYWx1ZSAhPT0gXCJ1bmRlZmluZWRcIiA/IGRlZmF1bHRWYWx1ZSA6IDA7XG4gIH0sXG4gIHJlc2V0OiAoc3JjLCBrZXksIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICBzcmNba2V5XSA9IGRlZmF1bHRWYWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3JjW2tleV0gPSAwO1xuICAgIH1cbiAgfSxcbiAgY2xlYXI6IChzcmMsIGtleSkgPT4ge1xuICAgIHNyY1trZXldID0gMDtcbiAgfVxufSk7XG5cblR5cGVzLkJvb2xlYW4gPSBjcmVhdGVUeXBlKHtcbiAgYmFzZVR5cGU6IEJvb2xlYW4sXG4gIGlzU2ltcGxlVHlwZTogdHJ1ZSxcbiAgY3JlYXRlOiBkZWZhdWx0VmFsdWUgPT4ge1xuICAgIHJldHVybiB0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiID8gZGVmYXVsdFZhbHVlIDogZmFsc2U7XG4gIH0sXG4gIHJlc2V0OiAoc3JjLCBrZXksIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICBzcmNba2V5XSA9IGRlZmF1bHRWYWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3JjW2tleV0gPSBmYWxzZTtcbiAgICB9XG4gIH0sXG4gIGNsZWFyOiAoc3JjLCBrZXkpID0+IHtcbiAgICBzcmNba2V5XSA9IGZhbHNlO1xuICB9XG59KTtcblxuVHlwZXMuU3RyaW5nID0gY3JlYXRlVHlwZSh7XG4gIGJhc2VUeXBlOiBTdHJpbmcsXG4gIGlzU2ltcGxlVHlwZTogdHJ1ZSxcbiAgY3JlYXRlOiBkZWZhdWx0VmFsdWUgPT4ge1xuICAgIHJldHVybiB0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiID8gZGVmYXVsdFZhbHVlIDogXCJcIjtcbiAgfSxcbiAgcmVzZXQ6IChzcmMsIGtleSwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkZWZhdWx0VmFsdWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHNyY1trZXldID0gZGVmYXVsdFZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBzcmNba2V5XSA9IFwiXCI7XG4gICAgfVxuICB9LFxuICBjbGVhcjogKHNyYywga2V5KSA9PiB7XG4gICAgc3JjW2tleV0gPSBcIlwiO1xuICB9XG59KTtcblxuVHlwZXMuQXJyYXkgPSBjcmVhdGVUeXBlKHtcbiAgYmFzZVR5cGU6IEFycmF5LFxuICBjcmVhdGU6IGRlZmF1bHRWYWx1ZSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkZWZhdWx0VmFsdWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHJldHVybiBkZWZhdWx0VmFsdWUuc2xpY2UoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gW107XG4gIH0sXG4gIHJlc2V0OiAoc3JjLCBrZXksIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgZGVmYXVsdFZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICBzcmNba2V5XSA9IGRlZmF1bHRWYWx1ZS5zbGljZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzcmNba2V5XS5sZW5ndGggPSAwO1xuICAgIH1cbiAgfSxcbiAgY2xlYXI6IChzcmMsIGtleSkgPT4ge1xuICAgIHNyY1trZXldLmxlbmd0aCA9IDA7XG4gIH0sXG4gIGNvcHk6IChzcmMsIGRzdCwga2V5KSA9PiB7XG4gICAgc3JjW2tleV0gPSBkc3Rba2V5XS5zbGljZSgpO1xuICB9XG59KTtcblxuZXhwb3J0IHsgVHlwZXMgfTtcbiIsImltcG9ydCB7IFR5cGVzIH0gZnJvbSBcIi4vU3RhbmRhcmRUeXBlc1wiO1xuXG52YXIgc3RhbmRhcmRUeXBlcyA9IHtcbiAgbnVtYmVyOiBUeXBlcy5OdW1iZXIsXG4gIGJvb2xlYW46IFR5cGVzLkJvb2xlYW4sXG4gIHN0cmluZzogVHlwZXMuU3RyaW5nXG59O1xuXG4vKipcbiAqIFRyeSB0byBpbmZlciB0aGUgdHlwZSBvZiB0aGUgdmFsdWVcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEByZXR1cm4ge1N0cmluZ30gVHlwZSBvZiB0aGUgYXR0cmlidXRlXG4gKiBAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5mZXJUeXBlKHZhbHVlKSB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiBUeXBlcy5BcnJheTtcbiAgfVxuXG4gIGlmIChzdGFuZGFyZFR5cGVzW3R5cGVvZiB2YWx1ZV0pIHtcbiAgICByZXR1cm4gc3RhbmRhcmRUeXBlc1t0eXBlb2YgdmFsdWVdO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG4iLCJpbXBvcnQgeyBpbmZlclR5cGUgfSBmcm9tIFwiLi9JbmZlclR5cGVcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudENsYXNzKHNjaGVtYSwgbmFtZSkge1xuICAvL3ZhciBDb21wb25lbnQgPSBuZXcgRnVuY3Rpb24oYHJldHVybiBmdW5jdGlvbiAke25hbWV9KCkge31gKSgpO1xuICBmb3IgKGxldCBrZXkgaW4gc2NoZW1hKSB7XG4gICAgbGV0IHR5cGUgPSBzY2hlbWFba2V5XS50eXBlO1xuICAgIGlmICghdHlwZSkge1xuICAgICAgc2NoZW1hW2tleV0udHlwZSA9IGluZmVyVHlwZShzY2hlbWFba2V5XS5kZWZhdWx0KTtcbiAgICB9XG4gIH1cblxuICB2YXIgQ29tcG9uZW50ID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgICAgdmFyIGF0dHIgPSBzY2hlbWFba2V5XTtcbiAgICAgIGxldCB0eXBlID0gYXR0ci50eXBlO1xuICAgICAgaWYgKHR5cGUgJiYgdHlwZS5pc1R5cGUpIHtcbiAgICAgICAgdGhpc1trZXldID0gdHlwZS5jcmVhdGUoYXR0ci5kZWZhdWx0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXNba2V5XSA9IGF0dHIuZGVmYXVsdDtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgaWYgKHR5cGVvZiBuYW1lICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbXBvbmVudCwgXCJuYW1lXCIsIHsgdmFsdWU6IG5hbWUgfSk7XG4gIH1cblxuICBDb21wb25lbnQucHJvdG90eXBlLnNjaGVtYSA9IHNjaGVtYTtcblxuICB2YXIga25vd25UeXBlcyA9IHRydWU7XG4gIGZvciAobGV0IGtleSBpbiBzY2hlbWEpIHtcbiAgICB2YXIgYXR0ciA9IHNjaGVtYVtrZXldO1xuICAgIGlmICghYXR0ci50eXBlKSB7XG4gICAgICBhdHRyLnR5cGUgPSBpbmZlclR5cGUoYXR0ci5kZWZhdWx0KTtcbiAgICB9XG5cbiAgICB2YXIgdHlwZSA9IGF0dHIudHlwZTtcbiAgICBpZiAoIXR5cGUpIHtcbiAgICAgIGNvbnNvbGUud2FybihgVW5rbm93biB0eXBlIGRlZmluaXRpb24gZm9yIGF0dHJpYnV0ZSAnJHtrZXl9J2ApO1xuICAgICAga25vd25UeXBlcyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGlmICgha25vd25UeXBlcykge1xuICAgIGNvbnNvbGUud2FybihcbiAgICAgIGBUaGlzIGNvbXBvbmVudCBjYW4ndCB1c2UgcG9vbGluZyBiZWNhdXNlIHNvbWUgZGF0YSB0eXBlcyBhcmUgbm90IHJlZ2lzdGVyZWQuIFBsZWFzZSBwcm92aWRlIGEgdHlwZSBjcmVhdGVkIHdpdGggJ2NyZWF0ZVR5cGUnYFxuICAgICk7XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gc2NoZW1hKSB7XG4gICAgICBsZXQgYXR0ciA9IHNjaGVtYVtrZXldO1xuICAgICAgQ29tcG9uZW50LnByb3RvdHlwZVtrZXldID0gYXR0ci5kZWZhdWx0O1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBDb21wb25lbnQucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbihzcmMpIHtcbiAgICAgIGZvciAobGV0IGtleSBpbiBzY2hlbWEpIHtcbiAgICAgICAgaWYgKHNyY1trZXldKSB7XG4gICAgICAgICAgbGV0IHR5cGUgPSBzY2hlbWFba2V5XS50eXBlO1xuICAgICAgICAgIGlmICh0eXBlLmlzU2ltcGxlVHlwZSkge1xuICAgICAgICAgICAgdGhpc1trZXldID0gc3JjW2tleV07XG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlLmNvcHkpIHtcbiAgICAgICAgICAgIHR5cGUuY29weSh0aGlzLCBzcmMsIGtleSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEB0b2RvIERldGVjdCB0aGF0IGl0J3Mgbm90IHBvc3NpYmxlIHRvIGNvcHkgYWxsIHRoZSBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAvLyBhbmQganVzdCBhdm9pZCBjcmVhdGluZyB0aGUgY29weSBmdW5jdGlvblxuICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICBgVW5rbm93biBjb3B5IGZ1bmN0aW9uIGZvciBhdHRyaWJ1dGUgJyR7a2V5fScgZGF0YSB0eXBlYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgICAgICBsZXQgYXR0ciA9IHNjaGVtYVtrZXldO1xuICAgICAgICBsZXQgdHlwZSA9IGF0dHIudHlwZTtcbiAgICAgICAgaWYgKHR5cGUucmVzZXQpIHR5cGUucmVzZXQodGhpcywga2V5LCBhdHRyLmRlZmF1bHQpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBDb21wb25lbnQucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKGxldCBrZXkgaW4gc2NoZW1hKSB7XG4gICAgICAgIGxldCB0eXBlID0gc2NoZW1hW2tleV0udHlwZTtcbiAgICAgICAgaWYgKHR5cGUuY2xlYXIpIHR5cGUuY2xlYXIodGhpcywga2V5KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZm9yIChsZXQga2V5IGluIHNjaGVtYSkge1xuICAgICAgbGV0IGF0dHIgPSBzY2hlbWFba2V5XTtcbiAgICAgIGxldCB0eXBlID0gYXR0ci50eXBlO1xuICAgICAgQ29tcG9uZW50LnByb3RvdHlwZVtrZXldID0gYXR0ci5kZWZhdWx0O1xuXG4gICAgICBpZiAodHlwZS5yZXNldCkge1xuICAgICAgICB0eXBlLnJlc2V0KENvbXBvbmVudC5wcm90b3R5cGUsIGtleSwgYXR0ci5kZWZhdWx0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gQ29tcG9uZW50O1xufVxuIiwiLyogZ2xvYmFsIFBlZXIgKi9cbmZ1bmN0aW9uIGdlbmVyYXRlSWQobGVuZ3RoKSB7XG4gIHZhciByZXN1bHQgPSBcIlwiO1xuICB2YXIgY2hhcmFjdGVycyA9XG4gICAgXCJBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OVwiO1xuICB2YXIgY2hhcmFjdGVyc0xlbmd0aCA9IGNoYXJhY3RlcnMubGVuZ3RoO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgcmVzdWx0ICs9IGNoYXJhY3RlcnMuY2hhckF0KE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGNoYXJhY3RlcnNMZW5ndGgpKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0LnRvVXBwZXJDYXNlKCk7XG59XG5cbmZ1bmN0aW9uIGxvZyhtc2cpIHtcbiAgLy9jb25zb2xlLmxvZyhtc2cpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlUmVtb3RlRGV2dG9vbHMocmVtb3RlSWQpIHtcbiAgd2luZG93LmdlbmVyYXRlTmV3Q29kZSA9ICgpID0+IHtcbiAgICB3aW5kb3cubG9jYWxTdG9yYWdlLmNsZWFyKCk7XG4gICAgcmVtb3RlSWQgPSBnZW5lcmF0ZUlkKDYpO1xuICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShcImVjc3lSZW1vdGVJZFwiLCByZW1vdGVJZCk7XG4gICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZChmYWxzZSk7XG4gIH07XG5cbiAgcmVtb3RlSWQgPSByZW1vdGVJZCB8fCB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJlY3N5UmVtb3RlSWRcIik7XG4gIGlmICghcmVtb3RlSWQpIHtcbiAgICByZW1vdGVJZCA9IGdlbmVyYXRlSWQoNik7XG4gICAgd2luZG93LmxvY2FsU3RvcmFnZS5zZXRJdGVtKFwiZWNzeVJlbW90ZUlkXCIsIHJlbW90ZUlkKTtcbiAgfVxuXG4gIGxldCBpbmZvRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgaW5mb0Rpdi5zdHlsZS5jc3NUZXh0ID0gYFxuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICB0b3A6IDA7XG4gICAgbGVmdDogMDtcbiAgICByaWdodDogMDtcbiAgICBoZWlnaHQ6IDQwcHg7XG4gICAgb3BhY2l0eTogMC45O1xuICAgIGZvbnQtc2l6ZTogMS4xZW07XG4gICAgY29sb3I6ICNmZmY7XG4gICAgZGlzcGxheTpmbGV4O1xuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgZm9udC1mYW1pbHk6IEFyaWFsO1xuICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjMzMzYDtcblxuICBpbmZvRGl2LmlubmVySFRNTCA9IGBPcGVuIEVDU1kgZGV2dG9vbHMgdG8gY29ubmVjdCB0byB0aGlzIHBhZ2UgdXNpbmcgdGhlIGNvZGU6Jm5ic3A7PGI+JHtyZW1vdGVJZH08L2I+Jm5ic3A7PGJ1dHRvbiBvbkNsaWNrPVwiZ2VuZXJhdGVOZXdDb2RlKClcIj5HZW5lcmF0ZSBuZXcgY29kZTwvYnV0dG9uPmA7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaW5mb0Rpdik7XG4gIHdpbmRvdy5fX0VDU1lfUkVNT1RFX0RFVlRPT0xTX0lOSkVDVEVEID0gdHJ1ZTtcbiAgd2luZG93Ll9fRUNTWV9SRU1PVEVfREVWVE9PTFMgPSB7fTtcblxuICAvLy8vLy8vLy8vLy9cbiAgbGV0IFZlcnNpb24gPSBcIlwiO1xuICBsZXQgd29ybGRzQmVmb3JlTG9hZGluZyA9IFtdO1xuICBsZXQgb25Xb3JsZENyZWF0ZWQgPSBlID0+IHtcbiAgICB2YXIgd29ybGQgPSBlLmRldGFpbC53b3JsZDtcbiAgICBWZXJzaW9uID0gZS5kZXRhaWwudmVyc2lvbjtcbiAgICBsb2coXCJXb3JsZCBjcmVhdGVkIGJlZm9yZVwiLCB3b3JsZCk7XG4gICAgd29ybGRzQmVmb3JlTG9hZGluZy5wdXNoKHdvcmxkKTtcbiAgfTtcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImVjc3ktd29ybGQtY3JlYXRlZFwiLCBvbldvcmxkQ3JlYXRlZCk7XG5cbiAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7XG4gIC8vIEB0b2RvIFVzZSBsaW5rIHRvIHRoZSBlY3N5LWRldnRvb2xzIHJlcG8/XG4gIHNjcmlwdC5zcmMgPSBcImh0dHBzOi8vY2RuLmpzZGVsaXZyLm5ldC9ucG0vcGVlcmpzQDAuMy4yMC9kaXN0L3BlZXIubWluLmpzXCI7XG4gIHNjcmlwdC5vbmxvYWQgPSAoKSA9PiB7XG4gICAgdmFyIHBlZXIgPSBuZXcgUGVlcihyZW1vdGVJZCk7XG4gICAgcGVlci5vbihcIm9wZW5cIiwgaWQgPT4ge1xuICAgICAgbG9nKFwiTXkgcGVlciBJRCBpczogXCIgKyBpZCk7XG4gICAgICBwZWVyLm9uKFwiY29ubmVjdGlvblwiLCBjb25uID0+IHtcbiAgICAgICAgbG9nKFwiT24gY29ubmVjdGlvblwiKTtcbiAgICAgICAgd2luZG93Ll9fRUNTWV9SRU1PVEVfREVWVE9PTFMuY29ubmVjdGlvbiA9IGNvbm47XG5cbiAgICAgICAgY29ubi5vbihcIm9wZW5cIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgbG9nKFwiT24gb3BlblwiKTtcbiAgICAgICAgICBpbmZvRGl2LnN0eWxlLnZpc2liaWxpdHkgPSBcImhpZGRlblwiO1xuXG4gICAgICAgICAgLy8gUmVjZWl2ZSBtZXNzYWdlc1xuICAgICAgICAgIGNvbm4ub24oXCJkYXRhXCIsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIGxvZyhcIk9uIGRhdGFcIik7XG4gICAgICAgICAgICBpZiAoZGF0YS50eXBlID09PSBcImluaXRcIikge1xuICAgICAgICAgICAgICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNjcmlwdFwiKTtcbiAgICAgICAgICAgICAgc2NyaXB0LnRleHRDb250ZW50ID0gZGF0YS5zY3JpcHQ7XG4gICAgICAgICAgICAgIHNjcmlwdC5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgc2NyaXB0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2NyaXB0KTtcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJlY3N5LXdvcmxkLWNyZWF0ZWRcIiwgb25Xb3JsZENyZWF0ZWQpO1xuICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICB3b3JsZHNCZWZvcmVMb2FkaW5nLmZvckVhY2god29ybGQgPT4ge1xuICAgICAgICAgICAgICAgICAgdmFyIGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KFwiZWNzeS13b3JsZC1jcmVhdGVkXCIsIHtcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsOiB7IHdvcmxkOiB3b3JsZCwgdmVyc2lvbjogVmVyc2lvbiB9XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSwgMTAwMCk7XG5cbiAgICAgICAgICAgICAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzY3JpcHQpO1xuXG4gICAgICAgICAgICAgIHZhciB3cmFwRnVuY3Rpb25zID0gW1wiZXJyb3JcIiwgXCJ3YXJuaW5nXCIsIFwibG9nXCJdO1xuICAgICAgICAgICAgICB3cmFwRnVuY3Rpb25zLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGVba2V5XSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgZm4gPSBjb25zb2xlW2tleV0uYmluZChjb25zb2xlKTtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGVba2V5XSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbm4uc2VuZCh7XG4gICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBcImNvbnNvbGVcIixcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBrZXksXG4gICAgICAgICAgICAgICAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoYXJncylcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICBjb25uLnNlbmQoe1xuICAgICAgICAgICAgICAgICAgbWV0aG9kOiBcImVycm9yXCIsXG4gICAgICAgICAgICAgICAgICBlcnJvcjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBlcnJvci5lcnJvci5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICBzdGFjazogZXJyb3IuZXJyb3Iuc3RhY2tcbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnR5cGUgPT09IFwiZXhlY3V0ZVNjcmlwdFwiKSB7XG4gICAgICAgICAgICAgIGxldCB2YWx1ZSA9IGV2YWwoZGF0YS5zY3JpcHQpO1xuICAgICAgICAgICAgICBpZiAoZGF0YS5yZXR1cm5FdmFsKSB7XG4gICAgICAgICAgICAgICAgY29ubi5zZW5kKHtcbiAgICAgICAgICAgICAgICAgIG1ldGhvZDogXCJldmFsUmV0dXJuXCIsXG4gICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuICAoZG9jdW1lbnQuaGVhZCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpLmFwcGVuZENoaWxkKHNjcmlwdCk7XG59XG5cbmNvbnN0IHVybFBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG5cbi8vIEB0b2RvIFByb3ZpZGUgYSB3YXkgdG8gZGlzYWJsZSBpdCBpZiBuZWVkZWRcbmlmICh1cmxQYXJhbXMuaGFzKFwiZW5hYmxlUmVtb3RlRGV2dG9vbHNcIikpIHtcbiAgZW5hYmxlUmVtb3RlRGV2dG9vbHMoKTtcbn1cbiJdLCJuYW1lcyI6W10s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
