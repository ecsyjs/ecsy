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

	    // This query is being used by a ReactiveSystem
	    this.reactive = false;

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
	      var reactive = false;

	      if (this.onEntitiesAdded) {
	        reactive = true;
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
	        reactive = true;
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
	        reactive = true;
	        this.queries[name].changed = [];
	        query.eventDispatcher.addEventListener(
	          Query.prototype.COMPONENT_CHANGED,
	          entity => {
	            this.queries[name].changed.push(entity);
	            this.counters.changed++;
	          }
	        );
	      }

	      query.reactive = reactive;

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

	class Entity {
	  constructor(manager) {
	    this._manager = manager || null;

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
	    this._ComponentTypes.length = 0;
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
	    if (~entity._ComponentTypes.indexOf(Component)) return;

	    entity._ComponentTypes.push(Component);

	    var componentPool = this._getComponentsPool(Component);
	    var component = componentPool.aquire();

	    entity._components[Component.name] = component;

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
	    var index = entity._ComponentTypes.indexOf(Component);
	    if (!~index) return;

	    this.eventDispatcher.dispatchEvent(COMPONENT_REMOVE, entity, Component);

	    // Check each indexed query to see if we need to remove it
	    this._queryManager.onEntityRemoved(entity, Component);

	    // Remove T listing on entity and property ref, then free the component.
	    entity._ComponentTypes.splice(index, 1);
	    var propName = componentPropertyName(Component);
	    var component = entity._components[getName(Component)];
	    //var component = entity[propName];
	    //delete entity[propName];
	    this._componentPool[propName].release(component);
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

	exports.ReactiveSystem = ReactiveSystem;
	exports.SchemaTypes = SchemaTypes;
	exports.System = System;
	exports.World = World;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL0V2ZW50RGlzcGF0Y2hlci5qcyIsIi4uL3NyYy9VdGlscy5qcyIsIi4uL3NyYy9RdWVyeS5qcyIsIi4uL3NyYy9SZWFjdGl2ZVN5c3RlbS5qcyIsIi4uL3NyYy9TeXN0ZW1NYW5hZ2VyLmpzIiwiLi4vc3JjL1dyYXBJbW11dGFibGVDb21wb25lbnQuanMiLCIuLi9zcmMvRW50aXR5LmpzIiwiLi4vc3JjL09iamVjdFBvb2wuanMiLCIuLi9zcmMvUXVlcnlNYW5hZ2VyLmpzIiwiLi4vc3JjL0VudGl0eU1hbmFnZXIuanMiLCIuLi9zcmMvQ29tcG9uZW50TWFuYWdlci5qcyIsIi4uL3NyYy9Xb3JsZC5qcyIsIi4uL3NyYy9TeXN0ZW0uanMiLCIuLi9zcmMvU2NoZW1hVHlwZXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgY2xhc3MgRXZlbnREaXNwYXRjaGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5fbGlzdGVuZXJzID0ge307XG4gICAgdGhpcy5zdGF0cyA9IHtcbiAgICAgIGZpcmVkOiAwLFxuICAgICAgaGFuZGxlZDogMFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQWRkIGFuIGV2ZW50IGxpc3RlbmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gbGlzdGVuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIHRvIHRyaWdnZXIgd2hlbiB0aGUgZXZlbnQgaXMgZmlyZWRcbiAgICovXG4gIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIGxldCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG4gICAgaWYgKGxpc3RlbmVyc1tldmVudE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudE5hbWVdID0gW107XG4gICAgfVxuXG4gICAgaWYgKGxpc3RlbmVyc1tldmVudE5hbWVdLmluZGV4T2YobGlzdGVuZXIpID09PSAtMSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50TmFtZV0ucHVzaChsaXN0ZW5lcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIGFuIGV2ZW50IGxpc3RlbmVyIGlzIGFscmVhZHkgYWRkZWQgdG8gdGhlIGxpc3Qgb2YgbGlzdGVuZXJzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gY2hlY2tcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnRcbiAgICovXG4gIGhhc0V2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXS5pbmRleE9mKGxpc3RlbmVyKSAhPT0gLTFcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbiBldmVudCBsaXN0ZW5lclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIHJlbW92ZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayBmb3IgdGhlIHNwZWNpZmllZCBldmVudFxuICAgKi9cbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgdmFyIGxpc3RlbmVyQXJyYXkgPSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXTtcbiAgICBpZiAobGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgaW5kZXggPSBsaXN0ZW5lckFycmF5LmluZGV4T2YobGlzdGVuZXIpO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICBsaXN0ZW5lckFycmF5LnNwbGljZShpbmRleCwgMSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIERpc3BhdGNoIGFuIGV2ZW50XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gZGlzcGF0Y2hcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAoT3B0aW9uYWwpIEVudGl0eSB0byBlbWl0XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBjb21wb25lbnRcbiAgICovXG4gIGRpc3BhdGNoRXZlbnQoZXZlbnROYW1lLCBlbnRpdHksIGNvbXBvbmVudCkge1xuICAgIHRoaXMuc3RhdHMuZmlyZWQrKztcblxuICAgIHZhciBsaXN0ZW5lckFycmF5ID0gdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV07XG4gICAgaWYgKGxpc3RlbmVyQXJyYXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGFycmF5ID0gbGlzdGVuZXJBcnJheS5zbGljZSgwKTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICBhcnJheVtpXS5jYWxsKHRoaXMsIGVudGl0eSwgY29tcG9uZW50KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVzZXQgc3RhdHMgY291bnRlcnNcbiAgICovXG4gIHJlc2V0Q291bnRlcnMoKSB7XG4gICAgdGhpcy5zdGF0cy5maXJlZCA9IHRoaXMuc3RhdHMuaGFuZGxlZCA9IDA7XG4gIH1cbn1cbiIsIi8qKlxuICogUmV0dXJuIHRoZSBuYW1lIG9mIGEgY29tcG9uZW50XG4gKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXROYW1lKENvbXBvbmVudCkge1xuICByZXR1cm4gQ29tcG9uZW50Lm5hbWU7XG59XG5cbi8qKlxuICogUmV0dXJuIGEgdmFsaWQgcHJvcGVydHkgbmFtZSBmb3IgdGhlIENvbXBvbmVudFxuICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCkge1xuICB2YXIgbmFtZSA9IGdldE5hbWUoQ29tcG9uZW50KTtcbiAgcmV0dXJuIG5hbWUuY2hhckF0KDApLnRvTG93ZXJDYXNlKCkgKyBuYW1lLnNsaWNlKDEpO1xufVxuXG4vKipcbiAqIEdldCBhIGtleSBmcm9tIGEgbGlzdCBvZiBjb21wb25lbnRzXG4gKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgQXJyYXkgb2YgY29tcG9uZW50cyB0byBnZW5lcmF0ZSB0aGUga2V5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBxdWVyeUtleShDb21wb25lbnRzKSB7XG4gIHZhciBuYW1lcyA9IFtdO1xuICBmb3IgKHZhciBuID0gMDsgbiA8IENvbXBvbmVudHMubGVuZ3RoOyBuKyspIHtcbiAgICB2YXIgVCA9IENvbXBvbmVudHNbbl07XG4gICAgbmFtZXMucHVzaChnZXROYW1lKFQpKTtcbiAgfVxuXG4gIHJldHVybiBuYW1lc1xuICAgIC5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHgudG9Mb3dlckNhc2UoKTtcbiAgICB9KVxuICAgIC5zb3J0KClcbiAgICAuam9pbihcIi1cIik7XG59XG4iLCJpbXBvcnQgRXZlbnREaXNwYXRjaGVyIGZyb20gXCIuL0V2ZW50RGlzcGF0Y2hlci5qc1wiO1xuaW1wb3J0IHsgcXVlcnlLZXkgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBRdWVyeSB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgTGlzdCBvZiB0eXBlcyBvZiBjb21wb25lbnRzIHRvIHF1ZXJ5XG4gICAqL1xuICBjb25zdHJ1Y3RvcihDb21wb25lbnRzLCBtYW5hZ2VyKSB7XG4gICAgdGhpcy5Db21wb25lbnRzID0gQ29tcG9uZW50cztcbiAgICB0aGlzLmVudGl0aWVzID0gW107XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG5cbiAgICAvLyBUaGlzIHF1ZXJ5IGlzIGJlaW5nIHVzZWQgYnkgYSBSZWFjdGl2ZVN5c3RlbVxuICAgIHRoaXMucmVhY3RpdmUgPSBmYWxzZTtcblxuICAgIHRoaXMua2V5ID0gcXVlcnlLZXkoQ29tcG9uZW50cyk7XG5cbiAgICAvLyBGaWxsIHRoZSBxdWVyeSB3aXRoIHRoZSBleGlzdGluZyBlbnRpdGllc1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbWFuYWdlci5fZW50aXRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBlbnRpdHkgPSBtYW5hZ2VyLl9lbnRpdGllc1tpXTtcbiAgICAgIGlmIChlbnRpdHkuaGFzQWxsQ29tcG9uZW50cyhDb21wb25lbnRzKSkge1xuICAgICAgICB0aGlzLmVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHN0YXRzIGZvciB0aGlzIHF1ZXJ5XG4gICAqL1xuICBzdGF0cygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbnVtQ29tcG9uZW50czogdGhpcy5Db21wb25lbnRzLmxlbmd0aCxcbiAgICAgIG51bUVudGl0aWVzOiB0aGlzLmVudGl0aWVzLmxlbmd0aFxuICAgIH07XG4gIH1cbn1cblxuUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCA9IFwiUXVlcnkjRU5USVRZX0FEREVEXCI7XG5RdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQgPSBcIlF1ZXJ5I0VOVElUWV9SRU1PVkVEXCI7XG5RdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQgPSBcIlF1ZXJ5I0NPTVBPTkVOVF9DSEFOR0VEXCI7XG4iLCJpbXBvcnQgUXVlcnkgZnJvbSBcIi4vUXVlcnkuanNcIjtcblxuZXhwb3J0IGNsYXNzIFJlYWN0aXZlU3lzdGVtIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgICB0aGlzLnF1ZXJ5Q29tcG9uZW50cyA9IHRoaXMuaW5pdCA/IHRoaXMuaW5pdCgpIDogbnVsbDtcbiAgICB0aGlzLl9xdWVyaWVzID0ge307XG4gICAgdGhpcy5xdWVyaWVzID0ge307XG5cbiAgICB0aGlzLmNvdW50ZXJzID0ge1xuICAgICAgYWRkZWQ6IDAsXG4gICAgICByZW1vdmVkOiAwLFxuICAgICAgY2hhbmdlZDogMCxcbiAgICAgIGNvbXBvbmVudENoYW5nZWQ6IDBcbiAgICB9O1xuXG4gICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLnF1ZXJ5Q29tcG9uZW50cykge1xuICAgICAgdmFyIENvbXBvbmVudHMgPSB0aGlzLnF1ZXJ5Q29tcG9uZW50c1tuYW1lXTtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMud29ybGQuZW50aXR5TWFuYWdlci5xdWVyeUNvbXBvbmVudHMoQ29tcG9uZW50cyk7XG4gICAgICB0aGlzLl9xdWVyaWVzW25hbWVdID0gcXVlcnk7XG4gICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0gPSB7fTtcbiAgICAgIHZhciByZWFjdGl2ZSA9IGZhbHNlO1xuXG4gICAgICBpZiAodGhpcy5vbkVudGl0aWVzQWRkZWQpIHtcbiAgICAgICAgcmVhY3RpdmUgPSB0cnVlO1xuICAgICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0uYWRkZWQgPSBbXTtcbiAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCxcbiAgICAgICAgICBlbnRpdHkgPT4ge1xuICAgICAgICAgICAgdGhpcy5xdWVyaWVzW25hbWVdLmFkZGVkLnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgIHRoaXMuY291bnRlcnMuYWRkZWQrKztcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLm9uRW50aXRpZXNSZW1vdmVkKSB7XG4gICAgICAgIHJlYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5xdWVyaWVzW25hbWVdLnJlbW92ZWQgPSBbXTtcbiAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICAgIGVudGl0eSA9PiB7XG4gICAgICAgICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0ucmVtb3ZlZC5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICB0aGlzLmNvdW50ZXJzLnJlbW92ZWQrKztcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLm9uRW50aXRpZXNDaGFuZ2VkKSB7XG4gICAgICAgIHJlYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5xdWVyaWVzW25hbWVdLmNoYW5nZWQgPSBbXTtcbiAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICAgIGVudGl0eSA9PiB7XG4gICAgICAgICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0uY2hhbmdlZC5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICB0aGlzLmNvdW50ZXJzLmNoYW5nZWQrKztcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHF1ZXJ5LnJlYWN0aXZlID0gcmVhY3RpdmU7XG5cbi8qXG4gICAgICBAdG9kb1xuICAgICAgaWYgKHRoaXMub25Db21wb25lbnRDaGFuZ2VkKSB7XG4gICAgICAgIHRoaXMucXVlcmllc1tuYW1lXS5jb21wb25lbnRDaGFuZ2VkID0gW107XG4gICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICBlbnRpdHkgPT4ge1xuICAgICAgICAgICAgdGhpcy5xdWVyaWVzW25hbWVdLmNvbXBvbmVudENoYW5nZWQucHVzaCh7ZW50aXR5OiBlbnRpdHksIGNvbXBvbmVudDogY29tcG9uZW50fSk7XG4gICAgICAgICAgICB0aGlzLmNvdW50ZXJzLmNvbXBvbmVudENoYW5nZWQrKztcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG4qL1xuICAgIH1cbiAgfVxuXG4gIGNsZWFyUXVlcmllcygpIHtcbiAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMucXVlcmllcykge1xuICAgICAgbGV0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW25hbWVdO1xuICAgICAgZm9yICh2YXIgZXZlbnQgaW4gcXVlcnkpIHtcbiAgICAgICAgcXVlcnlbZXZlbnRdLmxlbmd0aCA9IDA7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuY291bnRlcnMuYWRkZWQgPSB0aGlzLmNvdW50ZXJzLnJlbW92ZWQgPSB0aGlzLmNvdW50ZXJzLmNoYW5nZWQgPSB0aGlzLmNvdW50ZXJzLmNvbXBvbmVudENoYW5nZWQgPSAwO1xuICB9XG59XG4iLCJpbXBvcnQgeyBSZWFjdGl2ZVN5c3RlbSB9IGZyb20gXCIuL1JlYWN0aXZlU3lzdGVtLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBTeXN0ZW1NYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLnN5c3RlbXMgPSBbXTtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzeXN0ZW1cbiAgICogQHBhcmFtIHtTeXN0ZW19IFN5c3RlbSBTeXN0ZW0gdG8gcmVnaXN0ZXJcbiAgICovXG4gIHJlZ2lzdGVyU3lzdGVtKFN5c3RlbSkge1xuICAgIHRoaXMuc3lzdGVtcy5wdXNoKG5ldyBTeXN0ZW0odGhpcy53b3JsZCkpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIHN5c3RlbVxuICAgKiBAcGFyYW0ge1N5c3RlbX0gU3lzdGVtIFN5c3RlbSB0byByZW1vdmVcbiAgICovXG4gIHJlbW92ZVN5c3RlbShTeXN0ZW0pIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLnN5c3RlbXMuaW5kZXhPZihTeXN0ZW0pO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICB0aGlzLnN5c3RlbXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgYWxsIHRoZSBzeXN0ZW1zLiBDYWxsZWQgcGVyIGZyYW1lLlxuICAgKiBAcGFyYW0ge051bWJlcn0gZGVsdGEgRGVsdGEgdGltZSBzaW5jZSB0aGUgbGFzdCBmcmFtZVxuICAgKiBAcGFyYW0ge051bWJlcn0gdGltZSBFbGFwc2VkIHRpbWVcbiAgICovXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUpIHtcbiAgICB0aGlzLnN5c3RlbXMuZm9yRWFjaChzeXN0ZW0gPT4ge1xuICAgICAgaWYgKHN5c3RlbS5lbmFibGVkKSB7XG4gICAgICAgIGlmIChzeXN0ZW0gaW5zdGFuY2VvZiBSZWFjdGl2ZVN5c3RlbSkge1xuICAgICAgICAgIGlmIChzeXN0ZW0ub25FbnRpdGllc0FkZGVkICYmIHN5c3RlbS5jb3VudGVycy5hZGRlZCkge1xuICAgICAgICAgICAgc3lzdGVtLm9uRW50aXRpZXNBZGRlZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc3lzdGVtLm9uRW50aXRpZXNSZW1vdmVkICYmIHN5c3RlbS5jb3VudGVycy5yZW1vdmVkKSB7XG4gICAgICAgICAgICBzeXN0ZW0ub25FbnRpdGllc1JlbW92ZWQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHN5c3RlbS5vbkVudGl0aWVzQ2hhbmdlZCAmJiBzeXN0ZW0uY291bnRlcnMuY2hhbmdlZCkge1xuICAgICAgICAgICAgc3lzdGVtLm9uRW50aXRpZXNDaGFuZ2VkKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHN5c3RlbS5leGVjdXRlKSB7XG4gICAgICAgICAgc3lzdGVtLmV4ZWN1dGUoZGVsdGEsIHRpbWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnN5c3RlbXMuZm9yRWFjaChzeXN0ZW0gPT4ge1xuICAgICAgaWYgKHN5c3RlbSBpbnN0YW5jZW9mIFJlYWN0aXZlU3lzdGVtKSB7XG4gICAgICAgIHN5c3RlbS5jbGVhclF1ZXJpZXMoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc3RhdHNcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIG51bVN5c3RlbXM6IHRoaXMuc3lzdGVtcy5sZW5ndGgsXG4gICAgICBzeXN0ZW1zOiB7fVxuICAgIH07XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuc3lzdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN5c3RlbSA9IHRoaXMuc3lzdGVtc1tpXTtcbiAgICAgIHZhciBzeXN0ZW1TdGF0cyA9IChzdGF0cy5zeXN0ZW1zW3N5c3RlbS5jb25zdHJ1Y3Rvci5uYW1lXSA9IHtcbiAgICAgICAgcXVlcmllczoge31cbiAgICAgIH0pO1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiBzeXN0ZW0uY3R4KSB7XG4gICAgICAgIHN5c3RlbVN0YXRzLnF1ZXJpZXNbbmFtZV0gPSBzeXN0ZW0uY3R4W25hbWVdLnN0YXRzKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG4iLCJjb25zdCBwcm94eU1hcCA9IG5ldyBXZWFrTWFwKCk7XG5cbmNvbnN0IHByb3h5SGFuZGxlciA9IHtcbiAgc2V0KHRhcmdldCwgcHJvcCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBUcmllZCB0byB3cml0ZSB0byBcIiR7dGFyZ2V0LmNvbnN0cnVjdG9yLm5hbWV9IyR7U3RyaW5nKFxuICAgICAgICBwcm9wXG4gICAgICApfVwiIG9uIGltbXV0YWJsZSBjb21wb25lbnQuIFVzZSAuZ2V0TXV0YWJsZUNvbXBvbmVudCgpIHRvIG1vZGlmeSBhIGNvbXBvbmVudC5gXG4gICAgKTtcbiAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gd3JhcEltbXV0YWJsZUNvbXBvbmVudChULCBjb21wb25lbnQpIHtcbiAgaWYgKGNvbXBvbmVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGxldCB3cmFwcGVkQ29tcG9uZW50ID0gcHJveHlNYXAuZ2V0KGNvbXBvbmVudCk7XG5cbiAgaWYgKCF3cmFwcGVkQ29tcG9uZW50KSB7XG4gICAgd3JhcHBlZENvbXBvbmVudCA9IG5ldyBQcm94eShjb21wb25lbnQsIHByb3h5SGFuZGxlcik7XG4gICAgcHJveHlNYXAuc2V0KGNvbXBvbmVudCwgd3JhcHBlZENvbXBvbmVudCk7XG4gIH1cblxuICByZXR1cm4gd3JhcHBlZENvbXBvbmVudDtcbn1cbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuaW1wb3J0IHdyYXBJbW11dGFibGVDb21wb25lbnQgZnJvbSBcIi4vV3JhcEltbXV0YWJsZUNvbXBvbmVudC5qc1wiO1xuXG4vLyBAdG9kbyBUYWtlIHRoaXMgb3V0IGZyb20gdGhlcmUgb3IgdXNlIEVOVlxuY29uc3QgREVCVUcgPSB0cnVlO1xuXG4vLyBAdG9kbyByZXNldCBpdCBieSB3b3JsZD9cbnZhciBuZXh0SWQgPSAwO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFbnRpdHkge1xuICBjb25zdHJ1Y3RvcihtYW5hZ2VyKSB7XG4gICAgdGhpcy5fbWFuYWdlciA9IG1hbmFnZXIgfHwgbnVsbDtcblxuICAgIC8vIFVuaXF1ZSBJRCBmb3IgdGhpcyBlbnRpdHlcbiAgICB0aGlzLmlkID0gbmV4dElkKys7XG5cbiAgICAvLyBMaXN0IG9mIGNvbXBvbmVudHMgdHlwZXMgdGhlIGVudGl0eSBoYXNcbiAgICB0aGlzLl9Db21wb25lbnRUeXBlcyA9IFtdO1xuXG4gICAgLy8gSW5zdGFuY2Ugb2YgdGhlIGNvbXBvbmVudHNcbiAgICB0aGlzLl9jb21wb25lbnRzID0ge307XG5cbiAgICAvLyBMaXN0IG9mIHRhZ3MgdGhpcyBlbnRpdHkgaGFzXG4gICAgdGhpcy5fdGFncyA9IFtdO1xuXG4gICAgLy8gUXVlcmllcyB3aGVyZSB0aGUgZW50aXR5IGlzIGFkZGVkXG4gICAgdGhpcy5xdWVyaWVzID0gW107XG4gIH1cblxuICAvLyBDT01QT05FTlRTXG5cbiAgLyoqXG4gICAqIFJldHVybiBhbiBpbW11dGFibGUgcmVmZXJlbmNlIG9mIGEgY29tcG9uZW50XG4gICAqIE5vdGU6IEEgcHJveHkgd2lsbCBiZSB1c2VkIG9uIGRlYnVnIG1vZGUsIGFuZCBpdCB3aWxsIGp1c3QgYWZmZWN0XG4gICAqICAgICAgIHRoZSBmaXJzdCBsZXZlbCBhdHRyaWJ1dGVzIG9uIHRoZSBvYmplY3QsIGl0IHdvbid0IHdvcmsgcmVjdXJzaXZlbHkuXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBUeXBlIG9mIGNvbXBvbmVudCB0byBnZXRcbiAgICogQHJldHVybiB7Q29tcG9uZW50fSBJbW11dGFibGUgY29tcG9uZW50IHJlZmVyZW5jZVxuICAgKi9cbiAgZ2V0Q29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXTtcbiAgICBpZiAoREVCVUcpIHJldHVybiB3cmFwSW1tdXRhYmxlQ29tcG9uZW50KENvbXBvbmVudCwgY29tcG9uZW50KTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIG11dGFibGUgcmVmZXJlbmNlIG9mIGEgY29tcG9uZW50LlxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gVHlwZSBvZiBjb21wb25lbnQgdG8gZ2V0XG4gICAqIEByZXR1cm4ge0NvbXBvbmVudH0gTXV0YWJsZSBjb21wb25lbnQgcmVmZXJlbmNlXG4gICAqL1xuICBnZXRNdXRhYmxlQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucXVlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW2ldO1xuICAgICAgaWYgKHF1ZXJ5LnJlYWN0aXZlKSB7XG4gICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgIGNvbXBvbmVudFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY29tcG9uZW50O1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIGNvbXBvbmVudCB0byB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgdG8gYWRkIHRvIHRoaXMgZW50aXR5XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBPcHRpb25hbCB2YWx1ZXMgdG8gcmVwbGFjZSB0aGUgZGVmYXVsdCBhdHRyaWJ1dGVzIG9uIHRoZSBjb21wb25lbnRcbiAgICovXG4gIGFkZENvbXBvbmVudChDb21wb25lbnQsIHZhbHVlcykge1xuICAgIHRoaXMuX21hbmFnZXIuZW50aXR5QWRkQ29tcG9uZW50KHRoaXMsIENvbXBvbmVudCwgdmFsdWVzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBjb21wb25lbnQgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgdG8gcmVtb3ZlIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuX21hbmFnZXIuZW50aXR5UmVtb3ZlQ29tcG9uZW50KHRoaXMsIENvbXBvbmVudCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhlIGVudGl0eSBoYXMgYSBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCB0byBjaGVja1xuICAgKi9cbiAgaGFzQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHJldHVybiAhIX50aGlzLl9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCk7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhlIGVudGl0eSBoYXMgYSBsaXN0IG9mIGNvbXBvbmVudHNcbiAgICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIHRvIGNoZWNrXG4gICAqL1xuICBoYXNBbGxDb21wb25lbnRzKENvbXBvbmVudHMpIHtcbiAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0ID0gcmVzdWx0ICYmICEhfnRoaXMuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50c1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRoZSBjb21wb25lbnRzIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlQWxsQ29tcG9uZW50cygpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFuYWdlci5lbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKHRoaXMpO1xuICB9XG5cbiAgLy8gVEFHU1xuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGUgZW50aXR5IGhhcyBhIHRhZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byBjaGVja1xuICAgKi9cbiAgaGFzVGFnKHRhZykge1xuICAgIHJldHVybiAhIX50aGlzLl90YWdzLmluZGV4T2YodGFnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSB0YWcgdG8gdGhpcyBlbnRpdHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZyBUYWcgdG8gYWRkIHRvIHRoaXMgZW50aXR5XG4gICAqL1xuICBhZGRUYWcodGFnKSB7XG4gICAgdGhpcy5fbWFuYWdlci5lbnRpdHlBZGRUYWcodGhpcywgdGFnKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSB0YWcgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZVRhZyh0YWcpIHtcbiAgICB0aGlzLl9tYW5hZ2VyLmVudGl0eVJlbW92ZVRhZyh0aGlzLCB0YWcpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gRVhUUkFTXG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgdGhlIGVudGl0eS4gVG8gYmUgdXNlZCB3aGVuIHJldHVybmluZyBhbiBlbnRpdHkgdG8gdGhlIHBvb2xcbiAgICovXG4gIF9faW5pdCgpIHtcbiAgICB0aGlzLmlkID0gbmV4dElkKys7XG4gICAgdGhpcy5fbWFuYWdlciA9IG51bGw7XG4gICAgdGhpcy5fQ29tcG9uZW50VHlwZXMubGVuZ3RoID0gMDtcbiAgICB0aGlzLl90YWdzLmxlbmd0aCA9IDA7XG4gIH1cblxuICAvKipcbiAgICogRGlzcG9zZSB0aGUgZW50aXR5IGZyb20gdGhlIG1hbmFnZXJcbiAgICovXG4gIGRpc3Bvc2UoKSB7XG4gICAgcmV0dXJuIHRoaXMuX21hbmFnZXIucmVtb3ZlRW50aXR5KHRoaXMpO1xuICB9XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBPYmplY3RQb29sIHtcbiAgY29uc3RydWN0b3IoVCkge1xuICAgIHRoaXMuZnJlZUxpc3QgPSBbXTtcbiAgICB0aGlzLmNvdW50ID0gMDtcbiAgICB0aGlzLlQgPSBUO1xuXG4gICAgdmFyIGV4dHJhQXJncyA9IG51bGw7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICBleHRyYUFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgZXh0cmFBcmdzLnNoaWZ0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5jcmVhdGVFbGVtZW50ID0gZXh0cmFBcmdzXG4gICAgICA/ICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFQoLi4uZXh0cmFBcmdzKTtcbiAgICAgICAgfVxuICAgICAgOiAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBUKCk7XG4gICAgICAgIH07XG5cbiAgICB0aGlzLmluaXRpYWxPYmplY3QgPSB0aGlzLmNyZWF0ZUVsZW1lbnQoKTtcbiAgfVxuXG4gIGFxdWlyZSgpIHtcbiAgICAvLyBHcm93IHRoZSBsaXN0IGJ5IDIwJWlzaCBpZiB3ZSdyZSBvdXRcbiAgICBpZiAodGhpcy5mcmVlTGlzdC5sZW5ndGggPD0gMCkge1xuICAgICAgdGhpcy5leHBhbmQoTWF0aC5yb3VuZCh0aGlzLmNvdW50ICogMC4yKSArIDEpO1xuICAgIH1cblxuICAgIHZhciBpdGVtID0gdGhpcy5mcmVlTGlzdC5wb3AoKTtcblxuICAgIC8vIFdlIGNhbiBwcm92aWRlIGV4cGxpY2l0IGluaXRpbmcsIG90aGVyd2lzZSB3ZSBjb3B5IHRoZSB2YWx1ZSBvZiB0aGUgaW5pdGlhbCBjb21wb25lbnRcbiAgICBpZiAoaXRlbS5fX2luaXQpIGl0ZW0uX19pbml0KCk7XG4gICAgZWxzZSBpZiAoaXRlbS5jb3B5KSBpdGVtLmNvcHkodGhpcy5pbml0aWFsT2JqZWN0KTtcblxuICAgIHJldHVybiBpdGVtO1xuICB9XG5cbiAgcmVsZWFzZShpdGVtKSB7XG4gICAgdGhpcy5mcmVlTGlzdC5wdXNoKGl0ZW0pO1xuICB9XG5cbiAgZXhwYW5kKGNvdW50KSB7XG4gICAgZm9yICh2YXIgbiA9IDA7IG4gPCBjb3VudDsgbisrKSB7XG4gICAgICB0aGlzLmZyZWVMaXN0LnB1c2godGhpcy5jcmVhdGVFbGVtZW50KCkpO1xuICAgIH1cbiAgICB0aGlzLmNvdW50ICs9IGNvdW50O1xuICB9XG5cbiAgdG90YWxTaXplKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50O1xuICB9XG5cbiAgdG90YWxGcmVlKCkge1xuICAgIHJldHVybiB0aGlzLmZyZWVMaXN0Lmxlbmd0aDtcbiAgfVxuXG4gIHRvdGFsVXNlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5jb3VudCAtIHRoaXMuZnJlZUxpc3QubGVuZ3RoO1xuICB9XG59XG4iLCJpbXBvcnQgUXVlcnkgZnJvbSBcIi4vUXVlcnkuanNcIjtcbmltcG9ydCB7IHF1ZXJ5S2V5IH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUXVlcnlNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3IobWFuYWdlcikge1xuICAgIHRoaXMuX21hbmFnZXIgPSBtYW5hZ2VyO1xuXG4gICAgLy8gUXVlcmllcyBpbmRleGVkIGJ5IGEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBjb21wb25lbnRzIGl0IGhhc1xuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB3aGVuIGEgY29tcG9uZW50IGlzIGFkZGVkIHRvIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0aGF0IGp1c3QgZ290IHRoZSBuZXcgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IGFkZGVkIHRvIHRoZSBlbnRpdHlcbiAgICovXG4gIG9uRW50aXR5QWRkZWQoZW50aXR5LCBDb21wb25lbnQpIHtcbiAgICAvLyBAdG9kbyBVc2UgYml0bWFzayBmb3IgY2hlY2tpbmcgY29tcG9uZW50cz9cblxuICAgIC8vIENoZWNrIGVhY2ggaW5kZXhlZCBxdWVyeSB0byBzZWUgaWYgd2UgbmVlZCB0byBhZGQgdGhpcyBlbnRpdHkgdG8gdGhlIGxpc3RcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdO1xuXG4gICAgICAvLyBBZGQgdGhlIGVudGl0eSBvbmx5IGlmOlxuICAgICAgLy8gQ29tcG9uZW50IGlzIGluIHRoZSBxdWVyeVxuICAgICAgLy8gYW5kIEVudGl0eSBoYXMgQUxMIHRoZSBjb21wb25lbnRzIG9mIHRoZSBxdWVyeVxuICAgICAgLy8gYW5kIEVudGl0eSBpcyBub3QgYWxyZWFkeSBpbiB0aGUgcXVlcnlcbiAgICAgIGlmIChcbiAgICAgICAgIX5xdWVyeS5Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSB8fFxuICAgICAgICAhZW50aXR5Lmhhc0FsbENvbXBvbmVudHMocXVlcnkuQ29tcG9uZW50cykgfHxcbiAgICAgICAgfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KVxuICAgICAgKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCwgZW50aXR5KTtcblxuICAgICAgZW50aXR5LnF1ZXJpZXMucHVzaChxdWVyeSk7XG4gICAgICBxdWVyeS5lbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdoZW4gYSBjb21wb25lbnQgaXMgcmVtb3ZlZCBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBmcm9tXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIG9uRW50aXR5UmVtb3ZlZChlbnRpdHksIENvbXBvbmVudCkge1xuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIGlmICghfnF1ZXJ5LkNvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpKSBjb250aW51ZTtcbiAgICAgIGlmICghZW50aXR5Lmhhc0FsbENvbXBvbmVudHMocXVlcnkuQ29tcG9uZW50cykpIGNvbnRpbnVlO1xuXG4gICAgICB2YXIgaW5kZXggPSBxdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgICBpZiAofmluZGV4KSB7XG4gICAgICAgIHF1ZXJ5LmVudGl0aWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgICAgaW5kZXggPSBlbnRpdHkucXVlcmllcy5pbmRleE9mKHF1ZXJ5KTtcbiAgICAgICAgZW50aXR5LnF1ZXJpZXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgICBRdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQsXG4gICAgICAgICAgZW50aXR5XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHF1ZXJ5IGZvciB0aGUgc3BlY2lmaWVkIGNvbXBvbmVudHNcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudHMgQ29tcG9uZW50cyB0aGF0IHRoZSBxdWVyeSBzaG91bGQgaGF2ZVxuICAgKi9cbiAgZ2V0UXVlcnkoQ29tcG9uZW50cykge1xuICAgIHZhciBrZXkgPSBxdWVyeUtleShDb21wb25lbnRzKTtcbiAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW2tleV07XG4gICAgaWYgKCFxdWVyeSkge1xuICAgICAgdGhpcy5fcXVlcmllc1trZXldID0gcXVlcnkgPSBuZXcgUXVlcnkoQ29tcG9uZW50cywgdGhpcy5fbWFuYWdlcik7XG4gICAgfVxuICAgIHJldHVybiBxdWVyeTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc29tZSBzdGF0cyBmcm9tIHRoaXMgY2xhc3NcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHt9O1xuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICBzdGF0c1txdWVyeU5hbWVdID0gdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdLnN0YXRzKCk7XG4gICAgfVxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuIiwiaW1wb3J0IEVudGl0eSBmcm9tIFwiLi9FbnRpdHkuanNcIjtcbmltcG9ydCBPYmplY3RQb29sIGZyb20gXCIuL09iamVjdFBvb2wuanNcIjtcbmltcG9ydCBRdWVyeU1hbmFnZXIgZnJvbSBcIi4vUXVlcnlNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgRXZlbnREaXNwYXRjaGVyIGZyb20gXCIuL0V2ZW50RGlzcGF0Y2hlci5qc1wiO1xuaW1wb3J0IHsgY29tcG9uZW50UHJvcGVydHlOYW1lLCBnZXROYW1lIH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcblxuZXhwb3J0IGNsYXNzIEVudGl0eU1hbmFnZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLl9lbnRpdGllcyA9IFtdO1xuICAgIHRoaXMuX2NvbXBvbmVudFBvb2wgPSBbXTtcbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIgPSBuZXcgUXVlcnlNYW5hZ2VyKHRoaXMpO1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyID0gbmV3IEV2ZW50RGlzcGF0Y2hlcigpO1xuICAgIHRoaXMuX2VudGl0eVBvb2wgPSBuZXcgT2JqZWN0UG9vbChFbnRpdHkpO1xuICAgIHRoaXMuX3RhZ3MgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgZW50aXR5XG4gICAqL1xuICBjcmVhdGVFbnRpdHkoKSB7XG4gICAgdmFyIGVudGl0eSA9IHRoaXMuX2VudGl0eVBvb2wuYXF1aXJlKCk7XG4gICAgZW50aXR5Ll9tYW5hZ2VyID0gdGhpcztcbiAgICB0aGlzLl9lbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChFTlRJVFlfQ1JFQVRFRCwgZW50aXR5KTtcbiAgICByZXR1cm4gZW50aXR5O1xuICB9XG5cbiAgLy8gQ09NUE9ORU5UU1xuXG4gIC8qKlxuICAgKiBBZGQgYSBjb21wb25lbnQgdG8gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHdoZXJlIHRoZSBjb21wb25lbnQgd2lsbCBiZSBhZGRlZFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCB0byBiZSBhZGRlZCB0byB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZXMgT3B0aW9uYWwgdmFsdWVzIHRvIHJlcGxhY2UgdGhlIGRlZmF1bHQgYXR0cmlidXRlc1xuICAgKi9cbiAgZW50aXR5QWRkQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50LCB2YWx1ZXMpIHtcbiAgICBpZiAofmVudGl0eS5fQ29tcG9uZW50VHlwZXMuaW5kZXhPZihDb21wb25lbnQpKSByZXR1cm47XG5cbiAgICBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLnB1c2goQ29tcG9uZW50KTtcblxuICAgIHZhciBjb21wb25lbnRQb29sID0gdGhpcy5fZ2V0Q29tcG9uZW50c1Bvb2woQ29tcG9uZW50KTtcbiAgICB2YXIgY29tcG9uZW50ID0gY29tcG9uZW50UG9vbC5hcXVpcmUoKTtcblxuICAgIGVudGl0eS5fY29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBjb21wb25lbnQ7XG5cbiAgICBpZiAodmFsdWVzKSB7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHZhbHVlcykge1xuICAgICAgICBjb21wb25lbnRbbmFtZV0gPSB2YWx1ZXNbbmFtZV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5QWRkZWQoZW50aXR5LCBDb21wb25lbnQpO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChDT01QT05FTlRfQURERUQsIGVudGl0eSwgQ29tcG9uZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBjb21wb25lbnQgZnJvbSBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hpY2ggd2lsbCBnZXQgcmVtb3ZlZCB0aGUgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Kn0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZW1vdmUgZnJvbSB0aGUgZW50aXR5XG4gICAqL1xuICBlbnRpdHlSZW1vdmVDb21wb25lbnQoZW50aXR5LCBDb21wb25lbnQpIHtcbiAgICB2YXIgaW5kZXggPSBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChDT01QT05FTlRfUkVNT1ZFLCBlbnRpdHksIENvbXBvbmVudCk7XG5cbiAgICAvLyBDaGVjayBlYWNoIGluZGV4ZWQgcXVlcnkgdG8gc2VlIGlmIHdlIG5lZWQgdG8gcmVtb3ZlIGl0XG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5UmVtb3ZlZChlbnRpdHksIENvbXBvbmVudCk7XG5cbiAgICAvLyBSZW1vdmUgVCBsaXN0aW5nIG9uIGVudGl0eSBhbmQgcHJvcGVydHkgcmVmLCB0aGVuIGZyZWUgdGhlIGNvbXBvbmVudC5cbiAgICBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgdmFyIHByb3BOYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG4gICAgdmFyIGNvbXBvbmVudCA9IGVudGl0eS5fY29tcG9uZW50c1tnZXROYW1lKENvbXBvbmVudCldO1xuICAgIC8vdmFyIGNvbXBvbmVudCA9IGVudGl0eVtwcm9wTmFtZV07XG4gICAgLy9kZWxldGUgZW50aXR5W3Byb3BOYW1lXTtcbiAgICB0aGlzLl9jb21wb25lbnRQb29sW3Byb3BOYW1lXS5yZWxlYXNlKGNvbXBvbmVudCk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0aGUgY29tcG9uZW50cyBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSBmcm9tIHdoaWNoIHRoZSBjb21wb25lbnRzIHdpbGwgYmUgcmVtb3ZlZFxuICAgKi9cbiAgZW50aXR5UmVtb3ZlQWxsQ29tcG9uZW50cyhlbnRpdHkpIHtcbiAgICBsZXQgQ29tcG9uZW50cyA9IGVudGl0eS5fQ29tcG9uZW50VHlwZXM7XG5cbiAgICBmb3IgKGxldCBqID0gQ29tcG9uZW50cy5sZW5ndGggLSAxOyBqID49IDA7IGotLSkge1xuICAgICAgdmFyIEMgPSBDb21wb25lbnRzW2pdO1xuICAgICAgZW50aXR5LnJlbW92ZUNvbXBvbmVudChDKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBlbnRpdHkgZnJvbSB0aGlzIG1hbmFnZXIuIEl0IHdpbGwgY2xlYXIgYWxzbyBpdHMgY29tcG9uZW50cyBhbmQgdGFnc1xuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0byByZW1vdmUgZnJvbSB0aGUgbWFuYWdlclxuICAgKi9cbiAgcmVtb3ZlRW50aXR5KGVudGl0eSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuX2VudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcblxuICAgIGlmICghfmluZGV4KSB0aHJvdyBuZXcgRXJyb3IoXCJUcmllZCB0byByZW1vdmUgZW50aXR5IG5vdCBpbiBsaXN0XCIpO1xuXG4gICAgdGhpcy5lbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKGVudGl0eSk7XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBlbnRpdHkgbGlzdFxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoRU5USVRZX1JFTU9WRSwgZW50aXR5KTtcbiAgICB0aGlzLl9lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgLy8gUmVtb3ZlIGVudGl0eSBmcm9tIGFueSB0YWcgZ3JvdXBzIGFuZCBjbGVhciB0aGUgb24tZW50aXR5IHJlZlxuICAgIGVudGl0eS5fdGFncy5sZW5ndGggPSAwO1xuICAgIGZvciAodmFyIHRhZyBpbiB0aGlzLl90YWdzKSB7XG4gICAgICB2YXIgZW50aXRpZXMgPSB0aGlzLl90YWdzW3RhZ107XG4gICAgICB2YXIgbiA9IGVudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcbiAgICAgIGlmICh+bikgZW50aXRpZXMuc3BsaWNlKG4sIDEpO1xuICAgIH1cblxuICAgIC8vIFByZXZlbnQgYW55IGFjZWNzcyBhbmQgZnJlZVxuICAgIGVudGl0eS5tYW5hZ2VyID0gbnVsbDtcbiAgICB0aGlzLl9lbnRpdHlQb29sLnJlbGVhc2UoZW50aXR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIGVudGl0aWVzIGZyb20gdGhpcyBtYW5hZ2VyXG4gICAqL1xuICByZW1vdmVBbGxFbnRpdGllcygpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5fZW50aXRpZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHRoaXMuX2VudGl0aWVzW2ldLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG5cbiAgLy8gVEFHU1xuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRoZSBlbnRpdGllcyB0aGF0IGhhcyB0aGUgc3BlY2lmaWVkIHRhZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byBmaWx0ZXIgdGhlIGVudGl0aWVzIHRvIGJlIHJlbW92ZWRcbiAgICovXG4gIHJlbW92ZUVudGl0aWVzQnlUYWcodGFnKSB7XG4gICAgdmFyIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddO1xuXG4gICAgaWYgKCFlbnRpdGllcykgcmV0dXJuO1xuXG4gICAgZm9yICh2YXIgeCA9IGVudGl0aWVzLmxlbmd0aCAtIDE7IHggPj0gMDsgeC0tKSB7XG4gICAgICB2YXIgZW50aXR5ID0gZW50aXRpZXNbeF07XG4gICAgICBlbnRpdHkucmVtb3ZlKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCB0YWcgdG8gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHdoaWNoIHdpbGwgZ2V0IHRoZSB0YWdcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZyBUYWcgdG8gYWRkIHRvIHRoZSBlbnRpdHlcbiAgICovXG4gIGVudGl0eUFkZFRhZyhlbnRpdHksIHRhZykge1xuICAgIHZhciBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXTtcblxuICAgIGlmICghZW50aXRpZXMpIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddID0gW107XG5cbiAgICAvLyBEb24ndCBhZGQgaWYgYWxyZWFkeSB0aGVyZVxuICAgIGlmICh+ZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpKSByZXR1cm47XG5cbiAgICAvLyBBZGQgdG8gb3VyIHRhZyBpbmRleCBBTkQgdGhlIGxpc3Qgb24gdGhlIGVudGl0eVxuICAgIGVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICBlbnRpdHkuX3RhZ3MucHVzaCh0YWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIHRhZyBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0aGF0IHdpbGwgZ2V0IHJlbW92ZWQgdGhlIHRhZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byByZW1vdmVcbiAgICovXG4gIGVudGl0eVJlbW92ZVRhZyhlbnRpdHksIHRhZykge1xuICAgIHZhciBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXTtcbiAgICBpZiAoIWVudGl0aWVzKSByZXR1cm47XG5cbiAgICB2YXIgaW5kZXggPSBlbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgaWYgKCF+aW5kZXgpIHJldHVybjtcblxuICAgIC8vIFJlbW92ZSBmcm9tIG91ciBpbmRleCBBTkQgdGhlIGxpc3Qgb24gdGhlIGVudGl0eVxuICAgIGVudGl0aWVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgZW50aXR5Ll90YWdzLnNwbGljZShlbnRpdHkuX3RhZ3MuaW5kZXhPZih0YWcpLCAxKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBxdWVyeSBiYXNlZCBvbiBhIGxpc3Qgb2YgY29tcG9uZW50c1xuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgTGlzdCBvZiBjb21wb25lbnRzIHRoYXQgd2lsbCBmb3JtIHRoZSBxdWVyeVxuICAgKi9cbiAgcXVlcnlDb21wb25lbnRzKENvbXBvbmVudHMpIHtcbiAgICByZXR1cm4gdGhpcy5fcXVlcnlNYW5hZ2VyLmdldFF1ZXJ5KENvbXBvbmVudHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBjb21wb25lbnRzIHBvb2xcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBUeXBlIG9mIGNvbXBvbmVudCB0eXBlIGZvciB0aGUgcG9vbFxuICAgKi9cbiAgX2dldENvbXBvbmVudHNQb29sKENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnROYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG5cbiAgICBpZiAoIXRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0pIHtcbiAgICAgIHRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0gPSBuZXcgT2JqZWN0UG9vbChDb21wb25lbnQpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdO1xuICB9XG5cbiAgLy8gRVhUUkFTXG5cbiAgLyoqXG4gICAqIFJldHVybiBudW1iZXIgb2YgZW50aXRpZXNcbiAgICovXG4gIGNvdW50KCkge1xuICAgIHJldHVybiB0aGlzLl9lbnRpdGllcy5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHNvbWUgc3RhdHNcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIG51bUVudGl0aWVzOiB0aGlzLl9lbnRpdGllcy5sZW5ndGgsXG4gICAgICBudW1RdWVyaWVzOiBPYmplY3Qua2V5cyh0aGlzLl9xdWVyeU1hbmFnZXIuX3F1ZXJpZXMpLmxlbmd0aCxcbiAgICAgIHF1ZXJpZXM6IHRoaXMuX3F1ZXJ5TWFuYWdlci5zdGF0cygpLFxuICAgICAgbnVtQ29tcG9uZW50UG9vbDogT2JqZWN0LmtleXModGhpcy5fY29tcG9uZW50UG9vbCkubGVuZ3RoLFxuICAgICAgY29tcG9uZW50UG9vbDoge30sXG4gICAgICBldmVudERpc3BhdGNoZXI6IHRoaXMuZXZlbnREaXNwYXRjaGVyLnN0YXRzXG4gICAgfTtcblxuICAgIGZvciAodmFyIGNuYW1lIGluIHRoaXMuX2NvbXBvbmVudFBvb2wpIHtcbiAgICAgIHZhciBwb29sID0gdGhpcy5fY29tcG9uZW50UG9vbFtjbmFtZV07XG4gICAgICBzdGF0cy5jb21wb25lbnRQb29sW2NuYW1lXSA9IHtcbiAgICAgICAgdXNlZDogcG9vbC50b3RhbFVzZWQoKSxcbiAgICAgICAgc2l6ZTogcG9vbC5jb3VudFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cblxuY29uc3QgRU5USVRZX0NSRUFURUQgPSBcIkVudGl0eU1hbmFnZXIjRU5USVRZX0NSRUFURVwiO1xuY29uc3QgRU5USVRZX1JFTU9WRSA9IFwiRW50aXR5TWFuYWdlciNFTlRJVFlfUkVNT1ZFXCI7XG5jb25zdCBDT01QT05FTlRfQURERUQgPSBcIkVudGl0eU1hbmFnZXIjQ09NUE9ORU5UX0FEREVEXCI7XG5jb25zdCBDT01QT05FTlRfUkVNT1ZFID0gXCJFbnRpdHlNYW5hZ2VyI0NPTVBPTkVOVF9SRU1PVkVcIjtcbiIsImV4cG9ydCBjbGFzcyBDb21wb25lbnRNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5Db21wb25lbnRzID0ge307XG4gICAgdGhpcy5TaW5nbGV0b25Db21wb25lbnRzID0ge307XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gcmVnaXN0ZXJcbiAgICovXG4gIHJlZ2lzdGVyQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBDb21wb25lbnQ7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzaW5nbGV0b24gY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlZ2lzdGVyIGFzIHNpbmdsZXRvblxuICAgKi9cbiAgcmVnaXN0ZXJTaW5nbGV0b25Db21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5TaW5nbGV0b25Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IENvbXBvbmVudDtcbiAgfVxufVxuIiwiaW1wb3J0IHsgU3lzdGVtTWFuYWdlciB9IGZyb20gXCIuL1N5c3RlbU1hbmFnZXIuanNcIjtcbmltcG9ydCB7IEVudGl0eU1hbmFnZXIgfSBmcm9tIFwiLi9FbnRpdHlNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBDb21wb25lbnRNYW5hZ2VyIH0gZnJvbSBcIi4vQ29tcG9uZW50TWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgY29tcG9uZW50UHJvcGVydHlOYW1lIH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcblxuZXhwb3J0IGNsYXNzIFdvcmxkIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5lbnRpdHlNYW5hZ2VyID0gbmV3IEVudGl0eU1hbmFnZXIoKTtcbiAgICB0aGlzLnN5c3RlbU1hbmFnZXIgPSBuZXcgU3lzdGVtTWFuYWdlcih0aGlzKTtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyID0gbmV3IENvbXBvbmVudE1hbmFnZXIodGhpcyk7XG5cbiAgICAvLyBTdG9yYWdlIGZvciBzaW5nbGV0b24gY29tcG9uZW50c1xuICAgIHRoaXMuY29tcG9uZW50cyA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgc2luZ2xldG9uIGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IFNpbmdsZXRvbiBjb21wb25lbnRcbiAgICovXG4gIHJlZ2lzdGVyU2luZ2xldG9uQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIucmVnaXN0ZXJTaW5nbGV0b25Db21wb25lbnQoQ29tcG9uZW50KTtcbiAgICB0aGlzLmNvbXBvbmVudHNbY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCldID0gbmV3IENvbXBvbmVudCgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRcbiAgICovXG4gIHJlZ2lzdGVyQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIucmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIHN5c3RlbVxuICAgKiBAcGFyYW0ge1N5c3RlbX0gU3lzdGVtXG4gICAqL1xuICByZWdpc3RlclN5c3RlbShTeXN0ZW0pIHtcbiAgICB0aGlzLnN5c3RlbU1hbmFnZXIucmVnaXN0ZXJTeXN0ZW0oU3lzdGVtKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhlIHN5c3RlbXMgcGVyIGZyYW1lXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBkZWx0YSBEZWx0YSB0aW1lIHNpbmNlIHRoZSBsYXN0IGNhbGxcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHRpbWUgRWxhcHNlZCB0aW1lXG4gICAqL1xuICBleGVjdXRlKGRlbHRhLCB0aW1lKSB7XG4gICAgdGhpcy5zeXN0ZW1NYW5hZ2VyLmV4ZWN1dGUoZGVsdGEsIHRpbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBlbnRpdHlcbiAgICovXG4gIGNyZWF0ZUVudGl0eSgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRpdHlNYW5hZ2VyLmNyZWF0ZUVudGl0eSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBzb21lIHN0YXRzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBlbnRpdGllczogdGhpcy5lbnRpdHlNYW5hZ2VyLnN0YXRzKCksXG4gICAgICBzeXN0ZW06IHRoaXMuc3lzdGVtTWFuYWdlci5zdGF0cygpXG4gICAgfTtcblxuICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHN0YXRzLCBudWxsLCAyKSk7XG4gIH1cbn1cbiIsImV4cG9ydCBjbGFzcyBTeXN0ZW0ge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuICAgIHRoaXMucXVlcnlDb21wb25lbnRzID0gdGhpcy5pbml0ID8gdGhpcy5pbml0KCkgOiBudWxsO1xuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgICB0aGlzLnF1ZXJpZXMgPSB7fTtcblxuICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5xdWVyeUNvbXBvbmVudHMpIHtcbiAgICAgIHZhciBDb21wb25lbnRzID0gdGhpcy5xdWVyeUNvbXBvbmVudHNbbmFtZV07XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLndvcmxkLmVudGl0eU1hbmFnZXIucXVlcnlDb21wb25lbnRzKENvbXBvbmVudHMpO1xuICAgICAgdGhpcy5fcXVlcmllc1tuYW1lXSA9IHF1ZXJ5O1xuICAgICAgdGhpcy5xdWVyaWVzW25hbWVdID0gcXVlcnkuZW50aXRpZXM7XG4gICAgfVxuICB9XG59XG4iLCJjbGFzcyBGbG9hdFZhbGlkYXRvciB7XG4gIHN0YXRpYyB2YWxpZGF0ZShuKSB7XG4gICAgcmV0dXJuIE51bWJlcihuKSA9PT0gbiAmJiBuICUgMSAhPT0gMDtcbiAgfVxufVxuXG52YXIgU2NoZW1hVHlwZXMgPSB7XG4gIGZsb2F0OiBGbG9hdFZhbGlkYXRvclxuICAvKlxuICBhcnJheVxuICBib29sXG4gIGZ1bmNcbiAgbnVtYmVyXG4gIG9iamVjdFxuICBzdHJpbmdcbiAgc3ltYm9sXG5cbiAgYW55XG4gIGFycmF5T2ZcbiAgZWxlbWVudFxuICBlbGVtZW50VHlwZVxuICBpbnN0YW5jZU9mXG4gIG5vZGVcbiAgb2JqZWN0T2ZcbiAgb25lT2ZcbiAgb25lT2ZUeXBlXG4gIHNoYXBlXG4gIGV4YWN0XG4qL1xufTtcblxuZXhwb3J0IHsgU2NoZW1hVHlwZXMgfTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztDQUFlLE1BQU0sZUFBZSxDQUFDO0NBQ3JDLEVBQUUsV0FBVyxHQUFHO0NBQ2hCLElBQUksSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7Q0FDekIsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHO0NBQ2pCLE1BQU0sS0FBSyxFQUFFLENBQUM7Q0FDZCxNQUFNLE9BQU8sRUFBRSxDQUFDO0NBQ2hCLEtBQUssQ0FBQztDQUNOLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRTtDQUN4QyxJQUFJLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7Q0FDcEMsSUFBSSxJQUFJLFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxTQUFTLEVBQUU7Q0FDNUMsTUFBTSxTQUFTLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO0NBQ2hDLEtBQUs7O0NBRUws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
