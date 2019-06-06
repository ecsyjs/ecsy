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
	      var index = this._entities.indexOf(entity);
	      this._removeEntitySync(entity, index);
	    }
	    this.entitiesToRemove.length = 0;

	    for (let i = 0; i < this.entitiesWithComponentsToRemove.length; i++) {
	      let entity = this.entitiesWithComponentsToRemove[i];
	      while (entity.componentsToRemove.length > 0) {
	        var Component = entity.componentsToRemove.pop();
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

	exports.Not = Not;
	exports.SchemaTypes = SchemaTypes;
	exports.System = System;
	exports.World = World;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL1N5c3RlbU1hbmFnZXIuanMiLCIuLi9zcmMvRXZlbnREaXNwYXRjaGVyLmpzIiwiLi4vc3JjL1V0aWxzLmpzIiwiLi4vc3JjL1F1ZXJ5LmpzIiwiLi4vc3JjL1dyYXBJbW11dGFibGVDb21wb25lbnQuanMiLCIuLi9zcmMvRW50aXR5LmpzIiwiLi4vc3JjL09iamVjdFBvb2wuanMiLCIuLi9zcmMvUXVlcnlNYW5hZ2VyLmpzIiwiLi4vc3JjL0VudGl0eU1hbmFnZXIuanMiLCIuLi9zcmMvQ29tcG9uZW50TWFuYWdlci5qcyIsIi4uL3NyYy9Xb3JsZC5qcyIsIi4uL3NyYy9TeXN0ZW0uanMiLCIuLi9zcmMvU2NoZW1hVHlwZXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAY2xhc3MgU3lzdGVtTWFuYWdlclxuICovXG5leHBvcnQgY2xhc3MgU3lzdGVtTWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy5zeXN0ZW1zID0gW107XG4gICAgdGhpcy53b3JsZCA9IHdvcmxkO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgc3lzdGVtXG4gICAqIEBwYXJhbSB7U3lzdGVtfSBTeXN0ZW0gU3lzdGVtIHRvIHJlZ2lzdGVyXG4gICAqL1xuICByZWdpc3RlclN5c3RlbShTeXN0ZW0sIGF0dHJpYnV0ZXMpIHtcbiAgICB0aGlzLnN5c3RlbXMucHVzaChuZXcgU3lzdGVtKHRoaXMud29ybGQsIGF0dHJpYnV0ZXMpKTtcbiAgICB0aGlzLnNvcnRTeXN0ZW1zKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzb3J0U3lzdGVtcygpIHtcbiAgICB0aGlzLnN5c3RlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgcmV0dXJuIGIucHJpb3JpdHkgLSBhLnByaW9yaXR5O1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIHN5c3RlbVxuICAgKiBAcGFyYW0ge1N5c3RlbX0gU3lzdGVtIFN5c3RlbSB0byByZW1vdmVcbiAgICovXG4gIHJlbW92ZVN5c3RlbShTeXN0ZW0pIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLnN5c3RlbXMuaW5kZXhPZihTeXN0ZW0pO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICB0aGlzLnN5c3RlbXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgYWxsIHRoZSBzeXN0ZW1zLiBDYWxsZWQgcGVyIGZyYW1lLlxuICAgKiBAcGFyYW0ge051bWJlcn0gZGVsdGEgRGVsdGEgdGltZSBzaW5jZSB0aGUgbGFzdCBmcmFtZVxuICAgKiBAcGFyYW0ge051bWJlcn0gdGltZSBFbGFwc2VkIHRpbWVcbiAgICovXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUpIHtcbiAgICB0aGlzLnN5c3RlbXMuZm9yRWFjaChzeXN0ZW0gPT4ge1xuICAgICAgaWYgKHN5c3RlbS5lbmFibGVkKSB7XG4gICAgICAgIGlmIChzeXN0ZW0uZXhlY3V0ZSkge1xuICAgICAgICAgIGxldCBzdGFydFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICBzeXN0ZW0uZXhlY3V0ZShkZWx0YSwgdGltZSk7XG4gICAgICAgICAgc3lzdGVtLmV4ZWN1dGVUaW1lID0gcGVyZm9ybWFuY2Uubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICAgIH1cbiAgICAgICAgc3lzdGVtLmNsZWFyRXZlbnRzKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHN0YXRzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBudW1TeXN0ZW1zOiB0aGlzLnN5c3RlbXMubGVuZ3RoLFxuICAgICAgc3lzdGVtczoge31cbiAgICB9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnN5c3RlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBzeXN0ZW0gPSB0aGlzLnN5c3RlbXNbaV07XG4gICAgICB2YXIgc3lzdGVtU3RhdHMgPSAoc3RhdHMuc3lzdGVtc1tzeXN0ZW0uY29uc3RydWN0b3IubmFtZV0gPSB7XG4gICAgICAgIHF1ZXJpZXM6IHt9XG4gICAgICB9KTtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gc3lzdGVtLmN0eCkge1xuICAgICAgICBzeXN0ZW1TdGF0cy5xdWVyaWVzW25hbWVdID0gc3lzdGVtLmN0eFtuYW1lXS5zdGF0cygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuIiwiLyoqXG4gKiBAY2xhc3MgRXZlbnREaXNwYXRjaGVyXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEV2ZW50RGlzcGF0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuX2xpc3RlbmVycyA9IHt9O1xuICAgIHRoaXMuc3RhdHMgPSB7XG4gICAgICBmaXJlZDogMCxcbiAgICAgIGhhbmRsZWQ6IDBcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhbiBldmVudCBsaXN0ZW5lclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGxpc3RlblxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayB0byB0cmlnZ2VyIHdoZW4gdGhlIGV2ZW50IGlzIGZpcmVkXG4gICAqL1xuICBhZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICBsZXQgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnROYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgIH1cblxuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnROYW1lXS5pbmRleE9mKGxpc3RlbmVyKSA9PT0gLTEpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudE5hbWVdLnB1c2gobGlzdGVuZXIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBhbiBldmVudCBsaXN0ZW5lciBpcyBhbHJlYWR5IGFkZGVkIHRvIHRoZSBsaXN0IG9mIGxpc3RlbmVyc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGNoZWNrXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50XG4gICAqL1xuICBoYXNFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihsaXN0ZW5lcikgIT09IC0xXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byByZW1vdmVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnRcbiAgICovXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIHZhciBsaXN0ZW5lckFycmF5ID0gdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV07XG4gICAgaWYgKGxpc3RlbmVyQXJyYXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGluZGV4ID0gbGlzdGVuZXJBcnJheS5pbmRleE9mKGxpc3RlbmVyKTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgbGlzdGVuZXJBcnJheS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNwYXRjaCBhbiBldmVudFxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGRpc3BhdGNoXG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgKE9wdGlvbmFsKSBFbnRpdHkgdG8gZW1pdFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XG4gICAqL1xuICBkaXNwYXRjaEV2ZW50KGV2ZW50TmFtZSwgZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkKys7XG5cbiAgICB2YXIgbGlzdGVuZXJBcnJheSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xuICAgIGlmIChsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBhcnJheSA9IGxpc3RlbmVyQXJyYXkuc2xpY2UoMCk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJyYXlbaV0uY2FsbCh0aGlzLCBlbnRpdHksIGNvbXBvbmVudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHN0YXRzIGNvdW50ZXJzXG4gICAqL1xuICByZXNldENvdW50ZXJzKCkge1xuICAgIHRoaXMuc3RhdHMuZmlyZWQgPSB0aGlzLnN0YXRzLmhhbmRsZWQgPSAwO1xuICB9XG59XG4iLCIvKipcbiAqIFJldHVybiB0aGUgbmFtZSBvZiBhIGNvbXBvbmVudFxuICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TmFtZShDb21wb25lbnQpIHtcbiAgcmV0dXJuIENvbXBvbmVudC5uYW1lO1xufVxuXG4vKipcbiAqIFJldHVybiBhIHZhbGlkIHByb3BlcnR5IG5hbWUgZm9yIHRoZSBDb21wb25lbnRcbiAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpIHtcbiAgdmFyIG5hbWUgPSBnZXROYW1lKENvbXBvbmVudCk7XG4gIHJldHVybiBuYW1lLmNoYXJBdCgwKS50b0xvd2VyQ2FzZSgpICsgbmFtZS5zbGljZSgxKTtcbn1cblxuLyoqXG4gKiBHZXQgYSBrZXkgZnJvbSBhIGxpc3Qgb2YgY29tcG9uZW50c1xuICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIEFycmF5IG9mIGNvbXBvbmVudHMgdG8gZ2VuZXJhdGUgdGhlIGtleVxuICovXG5leHBvcnQgZnVuY3Rpb24gcXVlcnlLZXkoQ29tcG9uZW50cykge1xuICB2YXIgbmFtZXMgPSBbXTtcbiAgZm9yICh2YXIgbiA9IDA7IG4gPCBDb21wb25lbnRzLmxlbmd0aDsgbisrKSB7XG4gICAgdmFyIFQgPSBDb21wb25lbnRzW25dO1xuICAgIGlmICh0eXBlb2YgVCA9PT0gXCJvYmplY3RcIikge1xuICAgICAgdmFyIG9wZXJhdG9yID0gVC5vcGVyYXRvciA9PT0gXCJub3RcIiA/IFwiIVwiIDogVC5vcGVyYXRvcjtcbiAgICAgIG5hbWVzLnB1c2gob3BlcmF0b3IgKyBnZXROYW1lKFQuQ29tcG9uZW50KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hbWVzLnB1c2goZ2V0TmFtZShUKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWVzXG4gICAgLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geC50b0xvd2VyQ2FzZSgpO1xuICAgIH0pXG4gICAgLnNvcnQoKVxuICAgIC5qb2luKFwiLVwiKTtcbn1cbiIsImltcG9ydCBFdmVudERpc3BhdGNoZXIgZnJvbSBcIi4vRXZlbnREaXNwYXRjaGVyLmpzXCI7XG5pbXBvcnQgeyBxdWVyeUtleSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIFF1ZXJ5XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFF1ZXJ5IHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBMaXN0IG9mIHR5cGVzIG9mIGNvbXBvbmVudHMgdG8gcXVlcnlcbiAgICovXG4gIGNvbnN0cnVjdG9yKENvbXBvbmVudHMsIG1hbmFnZXIpIHtcbiAgICB0aGlzLkNvbXBvbmVudHMgPSBbXTtcbiAgICB0aGlzLk5vdENvbXBvbmVudHMgPSBbXTtcblxuICAgIENvbXBvbmVudHMuZm9yRWFjaChjb21wb25lbnQgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBjb21wb25lbnQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgdGhpcy5Ob3RDb21wb25lbnRzLnB1c2goY29tcG9uZW50LkNvbXBvbmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLkNvbXBvbmVudHMucHVzaChjb21wb25lbnQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuQ29tcG9uZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGNyZWF0ZSBhIHF1ZXJ5IHdpdGhvdXQgY29tcG9uZW50c1wiKTtcbiAgICB9XG5cbiAgICB0aGlzLmVudGl0aWVzID0gW107XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG5cbiAgICAvLyBUaGlzIHF1ZXJ5IGlzIGJlaW5nIHVzZWQgYnkgYSByZWFjdGl2ZSBzeXN0ZW1cbiAgICB0aGlzLnJlYWN0aXZlID0gZmFsc2U7XG5cbiAgICB0aGlzLmtleSA9IHF1ZXJ5S2V5KENvbXBvbmVudHMpO1xuXG4gICAgLy8gRmlsbCB0aGUgcXVlcnkgd2l0aCB0aGUgZXhpc3RpbmcgZW50aXRpZXNcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hbmFnZXIuX2VudGl0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZW50aXR5ID0gbWFuYWdlci5fZW50aXRpZXNbaV07XG4gICAgICBpZiAodGhpcy5tYXRjaChlbnRpdHkpKSB7XG4gICAgICAgIC8vIEB0b2RvID8/PyB0aGlzLmFkZEVudGl0eShlbnRpdHkpOyA9PiBwcmV2ZW50aW5nIHRoZSBldmVudCB0byBiZSBnZW5lcmF0ZWRcbiAgICAgICAgZW50aXR5LnF1ZXJpZXMucHVzaCh0aGlzKTtcbiAgICAgICAgdGhpcy5lbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBlbnRpdHkgdG8gdGhpcyBxdWVyeVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5XG4gICAqL1xuICBhZGRFbnRpdHkoZW50aXR5KSB7XG4gICAgZW50aXR5LnF1ZXJpZXMucHVzaCh0aGlzKTtcbiAgICB0aGlzLmVudGl0aWVzLnB1c2goZW50aXR5KTtcblxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCwgZW50aXR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgZW50aXR5IGZyb20gdGhpcyBxdWVyeVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5XG4gICAqL1xuICByZW1vdmVFbnRpdHkoZW50aXR5KSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgaWYgKH5pbmRleCkge1xuICAgICAgdGhpcy5lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICBpbmRleCA9IGVudGl0eS5xdWVyaWVzLmluZGV4T2YodGhpcyk7XG4gICAgICBlbnRpdHkucXVlcmllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBRdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQsXG4gICAgICAgIGVudGl0eVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBtYXRjaChlbnRpdHkpIHtcbiAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5Db21wb25lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHQgPSByZXN1bHQgJiYgISF+ZW50aXR5Ll9Db21wb25lbnRUeXBlcy5pbmRleE9mKHRoaXMuQ29tcG9uZW50c1tpXSk7XG4gICAgfVxuXG4gICAgLy8gTm90IGNvbXBvbmVudHNcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuTm90Q29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0ID1cbiAgICAgICAgcmVzdWx0ICYmICF+ZW50aXR5Ll9Db21wb25lbnRUeXBlcy5pbmRleE9mKHRoaXMuTm90Q29tcG9uZW50c1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc3RhdHMgZm9yIHRoaXMgcXVlcnlcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBudW1Db21wb25lbnRzOiB0aGlzLkNvbXBvbmVudHMubGVuZ3RoLFxuICAgICAgbnVtRW50aXRpZXM6IHRoaXMuZW50aXRpZXMubGVuZ3RoXG4gICAgfTtcbiAgfVxufVxuXG5RdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVEID0gXCJRdWVyeSNFTlRJVFlfQURERURcIjtcblF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfUkVNT1ZFRCA9IFwiUXVlcnkjRU5USVRZX1JFTU9WRURcIjtcblF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCA9IFwiUXVlcnkjQ09NUE9ORU5UX0NIQU5HRURcIjtcbiIsImNvbnN0IHByb3h5TWFwID0gbmV3IFdlYWtNYXAoKTtcblxuY29uc3QgcHJveHlIYW5kbGVyID0ge1xuICBzZXQodGFyZ2V0LCBwcm9wKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFRyaWVkIHRvIHdyaXRlIHRvIFwiJHt0YXJnZXQuY29uc3RydWN0b3IubmFtZX0jJHtTdHJpbmcoXG4gICAgICAgIHByb3BcbiAgICAgICl9XCIgb24gaW1tdXRhYmxlIGNvbXBvbmVudC4gVXNlIC5nZXRNdXRhYmxlQ29tcG9uZW50KCkgdG8gbW9kaWZ5IGEgY29tcG9uZW50LmBcbiAgICApO1xuICB9XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB3cmFwSW1tdXRhYmxlQ29tcG9uZW50KFQsIGNvbXBvbmVudCkge1xuICBpZiAoY29tcG9uZW50ID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgbGV0IHdyYXBwZWRDb21wb25lbnQgPSBwcm94eU1hcC5nZXQoY29tcG9uZW50KTtcblxuICBpZiAoIXdyYXBwZWRDb21wb25lbnQpIHtcbiAgICB3cmFwcGVkQ29tcG9uZW50ID0gbmV3IFByb3h5KGNvbXBvbmVudCwgcHJveHlIYW5kbGVyKTtcbiAgICBwcm94eU1hcC5zZXQoY29tcG9uZW50LCB3cmFwcGVkQ29tcG9uZW50KTtcbiAgfVxuXG4gIHJldHVybiB3cmFwcGVkQ29tcG9uZW50O1xufVxuIiwiaW1wb3J0IFF1ZXJ5IGZyb20gXCIuL1F1ZXJ5LmpzXCI7XG5pbXBvcnQgd3JhcEltbXV0YWJsZUNvbXBvbmVudCBmcm9tIFwiLi9XcmFwSW1tdXRhYmxlQ29tcG9uZW50LmpzXCI7XG5cbi8vIEB0b2RvIFRha2UgdGhpcyBvdXQgZnJvbSB0aGVyZSBvciB1c2UgRU5WXG5jb25zdCBERUJVRyA9IHRydWU7XG5cbi8vIEB0b2RvIHJlc2V0IGl0IGJ5IHdvcmxkP1xudmFyIG5leHRJZCA9IDA7XG5cbi8qKlxuICogQGNsYXNzIEVudGl0eVxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFbnRpdHkge1xuICAvKipcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBjbGFzcyBFbnRpdHlcbiAgICogQHBhcmFtIHtXb3JsZH0gd29ybGRcbiAgICovXG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy5fd29ybGQgPSB3b3JsZCB8fCBudWxsO1xuXG4gICAgLy8gVW5pcXVlIElEIGZvciB0aGlzIGVudGl0eVxuICAgIHRoaXMuaWQgPSBuZXh0SWQrKztcblxuICAgIC8vIExpc3Qgb2YgY29tcG9uZW50cyB0eXBlcyB0aGUgZW50aXR5IGhhc1xuICAgIHRoaXMuX0NvbXBvbmVudFR5cGVzID0gW107XG5cbiAgICAvLyBJbnN0YW5jZSBvZiB0aGUgY29tcG9uZW50c1xuICAgIHRoaXMuX2NvbXBvbmVudHMgPSB7fTtcblxuICAgIC8vIExpc3Qgb2YgdGFncyB0aGlzIGVudGl0eSBoYXNcbiAgICB0aGlzLl90YWdzID0gW107XG5cbiAgICAvLyBRdWVyaWVzIHdoZXJlIHRoZSBlbnRpdHkgaXMgYWRkZWRcbiAgICB0aGlzLnF1ZXJpZXMgPSBbXTtcblxuICAgIC8vIFVzZWQgZm9yIGRlZmVycmVkIHJlbW92YWxcbiAgICB0aGlzLmNvbXBvbmVudHNUb1JlbW92ZSA9IFtdO1xuICB9XG5cbiAgLy8gQ09NUE9ORU5UU1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gYW4gaW1tdXRhYmxlIHJlZmVyZW5jZSBvZiBhIGNvbXBvbmVudFxuICAgKiBOb3RlOiBBIHByb3h5IHdpbGwgYmUgdXNlZCBvbiBkZWJ1ZyBtb2RlLCBhbmQgaXQgd2lsbCBqdXN0IGFmZmVjdFxuICAgKiAgICAgICB0aGUgZmlyc3QgbGV2ZWwgYXR0cmlidXRlcyBvbiB0aGUgb2JqZWN0LCBpdCB3b24ndCB3b3JrIHJlY3Vyc2l2ZWx5LlxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gVHlwZSBvZiBjb21wb25lbnQgdG8gZ2V0XG4gICAqIEByZXR1cm4ge0NvbXBvbmVudH0gSW1tdXRhYmxlIGNvbXBvbmVudCByZWZlcmVuY2VcbiAgICovXG4gIGdldENvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcy5fY29tcG9uZW50c1tDb21wb25lbnQubmFtZV07XG4gICAgaWYgKERFQlVHKSByZXR1cm4gd3JhcEltbXV0YWJsZUNvbXBvbmVudChDb21wb25lbnQsIGNvbXBvbmVudCk7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgfVxuXG4gIGdldENvbXBvbmVudHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudHM7XG4gIH1cblxuICBnZXRDb21wb25lbnRUeXBlcygpIHtcbiAgICByZXR1cm4gdGhpcy5fQ29tcG9uZW50VHlwZXM7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGEgbXV0YWJsZSByZWZlcmVuY2Ugb2YgYSBjb21wb25lbnQuXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBUeXBlIG9mIGNvbXBvbmVudCB0byBnZXRcbiAgICogQHJldHVybiB7Q29tcG9uZW50fSBNdXRhYmxlIGNvbXBvbmVudCByZWZlcmVuY2VcbiAgICovXG4gIGdldE11dGFibGVDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IHRoaXMuX2NvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5xdWVyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaV07XG4gICAgICBpZiAocXVlcnkucmVhY3RpdmUpIHtcbiAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoXG4gICAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgY29tcG9uZW50XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjb21wb25lbnQ7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgY29tcG9uZW50IHRvIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCB0byBhZGQgdG8gdGhpcyBlbnRpdHlcbiAgICogQHBhcmFtIHtPYmplY3R9IE9wdGlvbmFsIHZhbHVlcyB0byByZXBsYWNlIHRoZSBkZWZhdWx0IGF0dHJpYnV0ZXMgb24gdGhlIGNvbXBvbmVudFxuICAgKi9cbiAgYWRkQ29tcG9uZW50KENvbXBvbmVudCwgdmFsdWVzKSB7XG4gICAgdGhpcy5fd29ybGQuZW50aXR5QWRkQ29tcG9uZW50KHRoaXMsIENvbXBvbmVudCwgdmFsdWVzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBjb21wb25lbnQgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgdG8gcmVtb3ZlIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuX3dvcmxkLmVudGl0eVJlbW92ZUNvbXBvbmVudCh0aGlzLCBDb21wb25lbnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGEgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgdG8gY2hlY2tcbiAgICovXG4gIGhhc0NvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICByZXR1cm4gISF+dGhpcy5fQ29tcG9uZW50VHlwZXMuaW5kZXhPZihDb21wb25lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGEgbGlzdCBvZiBjb21wb25lbnRzXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyB0byBjaGVja1xuICAgKi9cbiAgaGFzQWxsQ29tcG9uZW50cyhDb21wb25lbnRzKSB7XG4gICAgdmFyIHJlc3VsdCA9IHRydWU7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IENvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdCAmJiAhIX50aGlzLl9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudHNbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0aGUgY29tcG9uZW50cyBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZUFsbENvbXBvbmVudHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dvcmxkLmVudGl0eVJlbW92ZUFsbENvbXBvbmVudHModGhpcyk7XG4gIH1cblxuICAvLyBUQUdTXG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGEgdGFnXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIGNoZWNrXG4gICAqL1xuICBoYXNUYWcodGFnKSB7XG4gICAgcmV0dXJuICEhfnRoaXMuX3RhZ3MuaW5kZXhPZih0YWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIHRhZyB0byB0aGlzIGVudGl0eVxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byBhZGQgdG8gdGhpcyBlbnRpdHlcbiAgICovXG4gIGFkZFRhZyh0YWcpIHtcbiAgICB0aGlzLl93b3JsZC5lbnRpdHlBZGRUYWcodGhpcywgdGFnKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSB0YWcgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZVRhZyh0YWcpIHtcbiAgICB0aGlzLl93b3JsZC5lbnRpdHlSZW1vdmVUYWcodGhpcywgdGFnKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIEVYVFJBU1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIHRoZSBlbnRpdHkuIFRvIGJlIHVzZWQgd2hlbiByZXR1cm5pbmcgYW4gZW50aXR5IHRvIHRoZSBwb29sXG4gICAqL1xuICBfX2luaXQoKSB7XG4gICAgdGhpcy5pZCA9IG5leHRJZCsrO1xuICAgIHRoaXMuX3dvcmxkID0gbnVsbDtcbiAgICB0aGlzLl9Db21wb25lbnRUeXBlcy5sZW5ndGggPSAwO1xuICAgIHRoaXMucXVlcmllcy5sZW5ndGggPSAwO1xuICAgIHRoaXMuX2NvbXBvbmVudHMgPSB7fTtcbiAgICB0aGlzLl90YWdzLmxlbmd0aCA9IDA7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBlbnRpdHkgZnJvbSB0aGUgd29ybGRcbiAgICovXG4gIHJlbW92ZShmb3JjZVJlbW92ZSkge1xuICAgIHJldHVybiB0aGlzLl93b3JsZC5yZW1vdmVFbnRpdHkodGhpcywgZm9yY2VSZW1vdmUpO1xuICB9XG59XG4iLCIvKipcbiAqIEBjbGFzcyBPYmplY3RQb29sXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE9iamVjdFBvb2wge1xuICBjb25zdHJ1Y3RvcihUKSB7XG4gICAgdGhpcy5mcmVlTGlzdCA9IFtdO1xuICAgIHRoaXMuY291bnQgPSAwO1xuICAgIHRoaXMuVCA9IFQ7XG5cbiAgICB2YXIgZXh0cmFBcmdzID0gbnVsbDtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGV4dHJhQXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICBleHRyYUFyZ3Muc2hpZnQoKTtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0ZUVsZW1lbnQgPSBleHRyYUFyZ3NcbiAgICAgID8gKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgVCguLi5leHRyYUFyZ3MpO1xuICAgICAgICB9XG4gICAgICA6ICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFQoKTtcbiAgICAgICAgfTtcblxuICAgIHRoaXMuaW5pdGlhbE9iamVjdCA9IHRoaXMuY3JlYXRlRWxlbWVudCgpO1xuICB9XG5cbiAgYXF1aXJlKCkge1xuICAgIC8vIEdyb3cgdGhlIGxpc3QgYnkgMjAlaXNoIGlmIHdlJ3JlIG91dFxuICAgIGlmICh0aGlzLmZyZWVMaXN0Lmxlbmd0aCA8PSAwKSB7XG4gICAgICB0aGlzLmV4cGFuZChNYXRoLnJvdW5kKHRoaXMuY291bnQgKiAwLjIpICsgMSk7XG4gICAgfVxuXG4gICAgdmFyIGl0ZW0gPSB0aGlzLmZyZWVMaXN0LnBvcCgpO1xuXG4gICAgLy8gV2UgY2FuIHByb3ZpZGUgZXhwbGljaXQgaW5pdGluZywgb3RoZXJ3aXNlIHdlIGNvcHkgdGhlIHZhbHVlIG9mIHRoZSBpbml0aWFsIGNvbXBvbmVudFxuICAgIGlmIChpdGVtLl9faW5pdCkgaXRlbS5fX2luaXQoKTtcbiAgICBlbHNlIGlmIChpdGVtLmNvcHkpIGl0ZW0uY29weSh0aGlzLmluaXRpYWxPYmplY3QpO1xuXG4gICAgcmV0dXJuIGl0ZW07XG4gIH1cblxuICByZWxlYXNlKGl0ZW0pIHtcbiAgICB0aGlzLmZyZWVMaXN0LnB1c2goaXRlbSk7XG4gIH1cblxuICBleHBhbmQoY291bnQpIHtcbiAgICBmb3IgKHZhciBuID0gMDsgbiA8IGNvdW50OyBuKyspIHtcbiAgICAgIHRoaXMuZnJlZUxpc3QucHVzaCh0aGlzLmNyZWF0ZUVsZW1lbnQoKSk7XG4gICAgfVxuICAgIHRoaXMuY291bnQgKz0gY291bnQ7XG4gIH1cblxuICB0b3RhbFNpemUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY291bnQ7XG4gIH1cblxuICB0b3RhbEZyZWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuZnJlZUxpc3QubGVuZ3RoO1xuICB9XG5cbiAgdG90YWxVc2VkKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50IC0gdGhpcy5mcmVlTGlzdC5sZW5ndGg7XG4gIH1cbn1cbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuaW1wb3J0IHsgcXVlcnlLZXkgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG4vKipcbiAqIEBjbGFzcyBRdWVyeU1hbmFnZXJcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUXVlcnlNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLl93b3JsZCA9IHdvcmxkO1xuXG4gICAgLy8gUXVlcmllcyBpbmRleGVkIGJ5IGEgdW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBjb21wb25lbnRzIGl0IGhhc1xuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgfVxuXG4gIG9uRW50aXR5UmVtb3ZlZChlbnRpdHkpIHtcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdO1xuICAgICAgaWYgKGVudGl0eS5xdWVyaWVzLmluZGV4T2YocXVlcnkpICE9PSAtMSkge1xuICAgICAgICBxdWVyeS5yZW1vdmVFbnRpdHkoZW50aXR5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2hlbiBhIGNvbXBvbmVudCBpcyBhZGRlZCB0byBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdGhhdCBqdXN0IGdvdCB0aGUgbmV3IGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IENvbXBvbmVudCBhZGRlZCB0byB0aGUgZW50aXR5XG4gICAqL1xuICBvbkVudGl0eUNvbXBvbmVudEFkZGVkKGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgLy8gQHRvZG8gVXNlIGJpdG1hc2sgZm9yIGNoZWNraW5nIGNvbXBvbmVudHM/XG5cbiAgICAvLyBDaGVjayBlYWNoIGluZGV4ZWQgcXVlcnkgdG8gc2VlIGlmIHdlIG5lZWQgdG8gYWRkIHRoaXMgZW50aXR5IHRvIHRoZSBsaXN0XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXTtcblxuICAgICAgaWYgKFxuICAgICAgICAhIX5xdWVyeS5Ob3RDb21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgICB+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpXG4gICAgICApIHtcbiAgICAgICAgcXVlcnkucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgdGhlIGVudGl0eSBvbmx5IGlmOlxuICAgICAgLy8gQ29tcG9uZW50IGlzIGluIHRoZSBxdWVyeVxuICAgICAgLy8gYW5kIEVudGl0eSBoYXMgQUxMIHRoZSBjb21wb25lbnRzIG9mIHRoZSBxdWVyeVxuICAgICAgLy8gYW5kIEVudGl0eSBpcyBub3QgYWxyZWFkeSBpbiB0aGUgcXVlcnlcbiAgICAgIGlmIChcbiAgICAgICAgIX5xdWVyeS5Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSB8fFxuICAgICAgICAhcXVlcnkubWF0Y2goZW50aXR5KSB8fFxuICAgICAgICB+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpXG4gICAgICApXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBxdWVyeS5hZGRFbnRpdHkoZW50aXR5KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2hlbiBhIGNvbXBvbmVudCBpcyByZW1vdmVkIGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRvIHJlbW92ZSB0aGUgY29tcG9uZW50IGZyb21cbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gcmVtb3ZlIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgb25FbnRpdHlDb21wb25lbnRSZW1vdmVkKGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXTtcblxuICAgICAgaWYgKFxuICAgICAgICAhIX5xdWVyeS5Ob3RDb21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgICAhfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIHF1ZXJ5LmFkZEVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCF+cXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkpIGNvbnRpbnVlO1xuICAgICAgaWYgKCFxdWVyeS5tYXRjaChlbnRpdHkpKSBjb250aW51ZTtcblxuICAgICAgcXVlcnkucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHF1ZXJ5IGZvciB0aGUgc3BlY2lmaWVkIGNvbXBvbmVudHNcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudHMgQ29tcG9uZW50cyB0aGF0IHRoZSBxdWVyeSBzaG91bGQgaGF2ZVxuICAgKi9cbiAgZ2V0UXVlcnkoQ29tcG9uZW50cykge1xuICAgIHZhciBrZXkgPSBxdWVyeUtleShDb21wb25lbnRzKTtcbiAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW2tleV07XG4gICAgaWYgKCFxdWVyeSkge1xuICAgICAgdGhpcy5fcXVlcmllc1trZXldID0gcXVlcnkgPSBuZXcgUXVlcnkoQ29tcG9uZW50cywgdGhpcy5fd29ybGQpO1xuICAgIH1cbiAgICByZXR1cm4gcXVlcnk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHNvbWUgc3RhdHMgZnJvbSB0aGlzIGNsYXNzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7fTtcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5fcXVlcmllcykge1xuICAgICAgc3RhdHNbcXVlcnlOYW1lXSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXS5zdGF0cygpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cbiIsImltcG9ydCBFbnRpdHkgZnJvbSBcIi4vRW50aXR5LmpzXCI7XG5pbXBvcnQgT2JqZWN0UG9vbCBmcm9tIFwiLi9PYmplY3RQb29sLmpzXCI7XG5pbXBvcnQgUXVlcnlNYW5hZ2VyIGZyb20gXCIuL1F1ZXJ5TWFuYWdlci5qc1wiO1xuaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcbmltcG9ydCB7IGNvbXBvbmVudFByb3BlcnR5TmFtZSwgZ2V0TmFtZSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIEVudGl0eU1hbmFnZXJcbiAqL1xuZXhwb3J0IGNsYXNzIEVudGl0eU1hbmFnZXIge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyID0gd29ybGQuY29tcG9uZW50c01hbmFnZXI7XG5cbiAgICAvLyBBbGwgdGhlIGVudGl0aWVzIGluIHRoaXMgaW5zdGFuY2VcbiAgICB0aGlzLl9lbnRpdGllcyA9IFtdO1xuXG4gICAgLy8gTWFwIGJldHdlZW4gdGFnIGFuZCBlbnRpdGllc1xuICAgIHRoaXMuX3RhZ3MgPSB7fTtcblxuICAgIHRoaXMuX3F1ZXJ5TWFuYWdlciA9IG5ldyBRdWVyeU1hbmFnZXIodGhpcyk7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG4gICAgdGhpcy5fZW50aXR5UG9vbCA9IG5ldyBPYmplY3RQb29sKEVudGl0eSk7XG5cbiAgICAvLyBEZWZlcnJlZCBkZWxldGlvblxuICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlID0gW107XG4gICAgdGhpcy5lbnRpdGllc1RvUmVtb3ZlID0gW107XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGVudGl0eVxuICAgKi9cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHZhciBlbnRpdHkgPSB0aGlzLl9lbnRpdHlQb29sLmFxdWlyZSgpO1xuICAgIGVudGl0eS5fd29ybGQgPSB0aGlzO1xuICAgIHRoaXMuX2VudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KEVOVElUWV9DUkVBVEVELCBlbnRpdHkpO1xuICAgIHJldHVybiBlbnRpdHk7XG4gIH1cblxuICAvLyBDT01QT05FTlRTXG5cbiAgLyoqXG4gICAqIEFkZCBhIGNvbXBvbmVudCB0byBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hlcmUgdGhlIGNvbXBvbmVudCB3aWxsIGJlIGFkZGVkXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIGJlIGFkZGVkIHRvIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtPYmplY3R9IHZhbHVlcyBPcHRpb25hbCB2YWx1ZXMgdG8gcmVwbGFjZSB0aGUgZGVmYXVsdCBhdHRyaWJ1dGVzXG4gICAqL1xuICBlbnRpdHlBZGRDb21wb25lbnQoZW50aXR5LCBDb21wb25lbnQsIHZhbHVlcykge1xuICAgIGlmICh+ZW50aXR5Ll9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCkpIHJldHVybjtcblxuICAgIGVudGl0eS5fQ29tcG9uZW50VHlwZXMucHVzaChDb21wb25lbnQpO1xuXG4gICAgdmFyIGNvbXBvbmVudFBvb2wgPSB0aGlzLndvcmxkLmNvbXBvbmVudHNNYW5hZ2VyLmdldENvbXBvbmVudHNQb29sKFxuICAgICAgQ29tcG9uZW50XG4gICAgKTtcbiAgICB2YXIgY29tcG9uZW50ID0gY29tcG9uZW50UG9vbC5hcXVpcmUoKTtcblxuICAgIGVudGl0eS5fY29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBjb21wb25lbnQ7XG5cbiAgICBpZiAodmFsdWVzKSB7XG4gICAgICBpZiAoY29tcG9uZW50LmNvcHkpIHtcbiAgICAgICAgY29tcG9uZW50LmNvcHkodmFsdWVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4gdmFsdWVzKSB7XG4gICAgICAgICAgY29tcG9uZW50W25hbWVdID0gdmFsdWVzW25hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5Q29tcG9uZW50QWRkZWQoZW50aXR5LCBDb21wb25lbnQpO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChDT01QT05FTlRfQURERUQsIGVudGl0eSwgQ29tcG9uZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBjb21wb25lbnQgZnJvbSBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgd2hpY2ggd2lsbCBnZXQgcmVtb3ZlZCB0aGUgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Kn0gQ29tcG9uZW50IENvbXBvbmVudCB0byByZW1vdmUgZnJvbSB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7Qm9vbH0gZm9yY2VSZW1vdmUgSWYgeW91IHdhbnQgdG8gcmVtb3ZlIHRoZSBjb21wb25lbnQgaW1tZWRpYXRlbHkgaW5zdGVhZCBvZiBkZWZlcnJlZCAoRGVmYXVsdCBpcyBmYWxzZSlcbiAgICovXG4gIGVudGl0eVJlbW92ZUNvbXBvbmVudChlbnRpdHksIENvbXBvbmVudCwgZm9yY2VSZW1vdmUpIHtcbiAgICB2YXIgaW5kZXggPSBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChDT01QT05FTlRfUkVNT1ZFLCBlbnRpdHksIENvbXBvbmVudCk7XG5cbiAgICAvLyBDaGVjayBlYWNoIGluZGV4ZWQgcXVlcnkgdG8gc2VlIGlmIHdlIG5lZWQgdG8gcmVtb3ZlIGl0XG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyLm9uRW50aXR5Q29tcG9uZW50UmVtb3ZlZChlbnRpdHksIENvbXBvbmVudCk7XG5cbiAgICBpZiAoZm9yY2VSZW1vdmUpIHtcbiAgICAgIHRoaXMuX2VudGl0eVJlbW92ZUNvbXBvbmVudFN5bmMoZW50aXR5LCBDb21wb25lbnQsIGluZGV4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGVudGl0eS5jb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoID09PSAwKVxuICAgICAgICB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZS5wdXNoKGVudGl0eSk7XG4gICAgICBlbnRpdHkuY29tcG9uZW50c1RvUmVtb3ZlLnB1c2goQ29tcG9uZW50KTtcbiAgICB9XG4gIH1cblxuICBfZW50aXR5UmVtb3ZlQ29tcG9uZW50U3luYyhlbnRpdHksIENvbXBvbmVudCwgaW5kZXgpIHtcbiAgICAvLyBSZW1vdmUgVCBsaXN0aW5nIG9uIGVudGl0eSBhbmQgcHJvcGVydHkgcmVmLCB0aGVuIGZyZWUgdGhlIGNvbXBvbmVudC5cbiAgICBlbnRpdHkuX0NvbXBvbmVudFR5cGVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgdmFyIHByb3BOYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG4gICAgdmFyIGNvbXBvbmVudE5hbWUgPSBnZXROYW1lKENvbXBvbmVudCk7XG4gICAgdmFyIGNvbXBvbmVudCA9IGVudGl0eS5fY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcbiAgICBkZWxldGUgZW50aXR5Ll9jb21wb25lbnRzW2NvbXBvbmVudE5hbWVdO1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2xbcHJvcE5hbWVdLnJlbGVhc2UoY29tcG9uZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRoZSBjb21wb25lbnRzIGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IGZyb20gd2hpY2ggdGhlIGNvbXBvbmVudHMgd2lsbCBiZSByZW1vdmVkXG4gICAqL1xuICBlbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKGVudGl0eSwgZm9yY2VSZW1vdmUpIHtcbiAgICBsZXQgQ29tcG9uZW50cyA9IGVudGl0eS5fQ29tcG9uZW50VHlwZXM7XG5cbiAgICBmb3IgKGxldCBqID0gQ29tcG9uZW50cy5sZW5ndGggLSAxOyBqID49IDA7IGotLSkge1xuICAgICAgdGhpcy5lbnRpdHlSZW1vdmVDb21wb25lbnQoZW50aXR5LCBDb21wb25lbnRzW2pdLCBmb3JjZVJlbW92ZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0aGUgZW50aXR5IGZyb20gdGhpcyBtYW5hZ2VyLiBJdCB3aWxsIGNsZWFyIGFsc28gaXRzIGNvbXBvbmVudHMgYW5kIHRhZ3NcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdG8gcmVtb3ZlIGZyb20gdGhlIG1hbmFnZXJcbiAgICogQHBhcmFtIHtCb29sfSBmb3JjZVJlbW92ZSBJZiB5b3Ugd2FudCB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBpbW1lZGlhdGVseSBpbnN0ZWFkIG9mIGRlZmVycmVkIChEZWZhdWx0IGlzIGZhbHNlKVxuICAgKi9cbiAgcmVtb3ZlRW50aXR5KGVudGl0eSwgZm9yY2VSZW1vdmUpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLl9lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG5cbiAgICBpZiAoIX5pbmRleCkgdGhyb3cgbmV3IEVycm9yKFwiVHJpZWQgdG8gcmVtb3ZlIGVudGl0eSBub3QgaW4gbGlzdFwiKTtcblxuICAgIC8vIFJlbW92ZSBmcm9tIGVudGl0eSBsaXN0XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChFTlRJVFlfUkVNT1ZFRCwgZW50aXR5KTtcbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIub25FbnRpdHlSZW1vdmVkKGVudGl0eSk7XG5cbiAgICBpZiAoZm9yY2VSZW1vdmUgPT09IHRydWUpIHtcbiAgICAgIHRoaXMuX3JlbW92ZUVudGl0eVN5bmMoZW50aXR5LCBpbmRleCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZW50aXRpZXNUb1JlbW92ZS5wdXNoKGVudGl0eSk7XG4gICAgfVxuICB9XG5cbiAgX3JlbW92ZUVudGl0eVN5bmMoZW50aXR5LCBpbmRleCkge1xuICAgIHRoaXMuX2VudGl0aWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICB0aGlzLmVudGl0eVJlbW92ZUFsbENvbXBvbmVudHMoZW50aXR5LCB0cnVlKTtcblxuICAgIC8vIFJlbW92ZSBlbnRpdHkgZnJvbSBhbnkgdGFnIGdyb3VwcyBhbmQgY2xlYXIgdGhlIG9uLWVudGl0eSByZWZcbiAgICBlbnRpdHkuX3RhZ3MubGVuZ3RoID0gMDtcbiAgICBmb3IgKHZhciB0YWcgaW4gdGhpcy5fdGFncykge1xuICAgICAgdmFyIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddO1xuICAgICAgdmFyIG4gPSBlbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgICBpZiAofm4pIGVudGl0aWVzLnNwbGljZShuLCAxKTtcbiAgICB9XG5cbiAgICAvLyBQcmV2ZW50IGFueSBhY2Nlc3MgYW5kIGZyZWVcbiAgICBlbnRpdHkuX3dvcmxkID0gbnVsbDtcbiAgICB0aGlzLl9lbnRpdHlQb29sLnJlbGVhc2UoZW50aXR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIGVudGl0aWVzIGZyb20gdGhpcyBtYW5hZ2VyXG4gICAqL1xuICByZW1vdmVBbGxFbnRpdGllcygpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5fZW50aXRpZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHRoaXMuX2VudGl0aWVzW2ldLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByb2Nlc3NEZWZlcnJlZFJlbW92YWwoKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmVudGl0aWVzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBlbnRpdHkgPSB0aGlzLmVudGl0aWVzVG9SZW1vdmVbaV07XG4gICAgICB2YXIgaW5kZXggPSB0aGlzLl9lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgICB0aGlzLl9yZW1vdmVFbnRpdHlTeW5jKGVudGl0eSwgaW5kZXgpO1xuICAgIH1cbiAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUubGVuZ3RoID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBlbnRpdHkgPSB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZVtpXTtcbiAgICAgIHdoaWxlIChlbnRpdHkuY29tcG9uZW50c1RvUmVtb3ZlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdmFyIENvbXBvbmVudCA9IGVudGl0eS5jb21wb25lbnRzVG9SZW1vdmUucG9wKCk7XG4gICAgICAgIHRoaXMuX2VudGl0eVJlbW92ZUNvbXBvbmVudFN5bmMoZW50aXR5LCBDb21wb25lbnQsIGluZGV4KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZS5sZW5ndGggPSAwO1xuICB9XG5cbiAgLy8gVEFHU1xuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRoZSBlbnRpdGllcyB0aGF0IGhhcyB0aGUgc3BlY2lmaWVkIHRhZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byBmaWx0ZXIgdGhlIGVudGl0aWVzIHRvIGJlIHJlbW92ZWRcbiAgICovXG4gIHJlbW92ZUVudGl0aWVzQnlUYWcodGFnKSB7XG4gICAgdmFyIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddO1xuXG4gICAgaWYgKCFlbnRpdGllcykgcmV0dXJuO1xuXG4gICAgZm9yICh2YXIgeCA9IGVudGl0aWVzLmxlbmd0aCAtIDE7IHggPj0gMDsgeC0tKSB7XG4gICAgICB2YXIgZW50aXR5ID0gZW50aXRpZXNbeF07XG4gICAgICBlbnRpdHkucmVtb3ZlKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCB0YWcgdG8gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHdoaWNoIHdpbGwgZ2V0IHRoZSB0YWdcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZyBUYWcgdG8gYWRkIHRvIHRoZSBlbnRpdHlcbiAgICovXG4gIGVudGl0eUFkZFRhZyhlbnRpdHksIHRhZykge1xuICAgIHZhciBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXTtcblxuICAgIGlmICghZW50aXRpZXMpIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddID0gW107XG5cbiAgICAvLyBEb24ndCBhZGQgaWYgYWxyZWFkeSB0aGVyZVxuICAgIGlmICh+ZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpKSByZXR1cm47XG5cbiAgICAvLyBBZGQgdG8gb3VyIHRhZyBpbmRleCBBTkQgdGhlIGxpc3Qgb24gdGhlIGVudGl0eVxuICAgIGVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICBlbnRpdHkuX3RhZ3MucHVzaCh0YWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIHRhZyBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0aGF0IHdpbGwgZ2V0IHJlbW92ZWQgdGhlIHRhZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnIFRhZyB0byByZW1vdmVcbiAgICovXG4gIGVudGl0eVJlbW92ZVRhZyhlbnRpdHksIHRhZykge1xuICAgIHZhciBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXTtcbiAgICBpZiAoIWVudGl0aWVzKSByZXR1cm47XG5cbiAgICB2YXIgaW5kZXggPSBlbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgaWYgKCF+aW5kZXgpIHJldHVybjtcblxuICAgIC8vIFJlbW92ZSBmcm9tIG91ciBpbmRleCBBTkQgdGhlIGxpc3Qgb24gdGhlIGVudGl0eVxuICAgIGVudGl0aWVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgZW50aXR5Ll90YWdzLnNwbGljZShlbnRpdHkuX3RhZ3MuaW5kZXhPZih0YWcpLCAxKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBxdWVyeSBiYXNlZCBvbiBhIGxpc3Qgb2YgY29tcG9uZW50c1xuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgTGlzdCBvZiBjb21wb25lbnRzIHRoYXQgd2lsbCBmb3JtIHRoZSBxdWVyeVxuICAgKi9cbiAgcXVlcnlDb21wb25lbnRzKENvbXBvbmVudHMpIHtcbiAgICByZXR1cm4gdGhpcy5fcXVlcnlNYW5hZ2VyLmdldFF1ZXJ5KENvbXBvbmVudHMpO1xuICB9XG5cbiAgLy8gRVhUUkFTXG5cbiAgLyoqXG4gICAqIFJldHVybiBudW1iZXIgb2YgZW50aXRpZXNcbiAgICovXG4gIGNvdW50KCkge1xuICAgIHJldHVybiB0aGlzLl9lbnRpdGllcy5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHNvbWUgc3RhdHNcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIG51bUVudGl0aWVzOiB0aGlzLl9lbnRpdGllcy5sZW5ndGgsXG4gICAgICBudW1RdWVyaWVzOiBPYmplY3Qua2V5cyh0aGlzLl9xdWVyeU1hbmFnZXIuX3F1ZXJpZXMpLmxlbmd0aCxcbiAgICAgIHF1ZXJpZXM6IHRoaXMuX3F1ZXJ5TWFuYWdlci5zdGF0cygpLFxuICAgICAgbnVtQ29tcG9uZW50UG9vbDogT2JqZWN0LmtleXModGhpcy5jb21wb25lbnRzTWFuYWdlci5fY29tcG9uZW50UG9vbClcbiAgICAgICAgLmxlbmd0aCxcbiAgICAgIGNvbXBvbmVudFBvb2w6IHt9LFxuICAgICAgZXZlbnREaXNwYXRjaGVyOiB0aGlzLmV2ZW50RGlzcGF0Y2hlci5zdGF0c1xuICAgIH07XG5cbiAgICBmb3IgKHZhciBjbmFtZSBpbiB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLl9jb21wb25lbnRQb29sKSB7XG4gICAgICB2YXIgcG9vbCA9IHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2xbY25hbWVdO1xuICAgICAgc3RhdHMuY29tcG9uZW50UG9vbFtjbmFtZV0gPSB7XG4gICAgICAgIHVzZWQ6IHBvb2wudG90YWxVc2VkKCksXG4gICAgICAgIHNpemU6IHBvb2wuY291bnRcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG5cbmNvbnN0IEVOVElUWV9DUkVBVEVEID0gXCJFbnRpdHlNYW5hZ2VyI0VOVElUWV9DUkVBVEVcIjtcbmNvbnN0IEVOVElUWV9SRU1PVkVEID0gXCJFbnRpdHlNYW5hZ2VyI0VOVElUWV9SRU1PVkVEXCI7XG5jb25zdCBDT01QT05FTlRfQURERUQgPSBcIkVudGl0eU1hbmFnZXIjQ09NUE9ORU5UX0FEREVEXCI7XG5jb25zdCBDT01QT05FTlRfUkVNT1ZFID0gXCJFbnRpdHlNYW5hZ2VyI0NPTVBPTkVOVF9SRU1PVkVcIjtcbiIsImltcG9ydCBPYmplY3RQb29sIGZyb20gXCIuL09iamVjdFBvb2wuanNcIjtcbmltcG9ydCB7IGNvbXBvbmVudFByb3BlcnR5TmFtZSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIENvbXBvbmVudE1hbmFnZXJcbiAqL1xuZXhwb3J0IGNsYXNzIENvbXBvbmVudE1hbmFnZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLkNvbXBvbmVudHMgPSB7fTtcbiAgICB0aGlzLlNpbmdsZXRvbkNvbXBvbmVudHMgPSB7fTtcbiAgICB0aGlzLl9jb21wb25lbnRQb29sID0ge307XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gcmVnaXN0ZXJcbiAgICovXG4gIHJlZ2lzdGVyQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBDb21wb25lbnQ7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzaW5nbGV0b24gY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlZ2lzdGVyIGFzIHNpbmdsZXRvblxuICAgKi9cbiAgcmVnaXN0ZXJTaW5nbGV0b25Db21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5TaW5nbGV0b25Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IENvbXBvbmVudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY29tcG9uZW50cyBwb29sXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgVHlwZSBvZiBjb21wb25lbnQgdHlwZSBmb3IgdGhlIHBvb2xcbiAgICovXG4gIGdldENvbXBvbmVudHNQb29sKENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnROYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG5cbiAgICBpZiAoIXRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0pIHtcbiAgICAgIHRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0gPSBuZXcgT2JqZWN0UG9vbChDb21wb25lbnQpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdO1xuICB9XG59XG4iLCJpbXBvcnQgeyBTeXN0ZW1NYW5hZ2VyIH0gZnJvbSBcIi4vU3lzdGVtTWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgRW50aXR5TWFuYWdlciB9IGZyb20gXCIuL0VudGl0eU1hbmFnZXIuanNcIjtcbmltcG9ydCB7IENvbXBvbmVudE1hbmFnZXIgfSBmcm9tIFwiLi9Db21wb25lbnRNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBjb21wb25lbnRQcm9wZXJ0eU5hbWUgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcblxuLyoqXG4gKiBAY2xhc3MgV29ybGRcbiAqL1xuZXhwb3J0IGNsYXNzIFdvcmxkIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlciA9IG5ldyBDb21wb25lbnRNYW5hZ2VyKHRoaXMpO1xuICAgIHRoaXMuZW50aXR5TWFuYWdlciA9IG5ldyBFbnRpdHlNYW5hZ2VyKHRoaXMpO1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlciA9IG5ldyBTeXN0ZW1NYW5hZ2VyKHRoaXMpO1xuXG4gICAgLy8gU3RvcmFnZSBmb3Igc2luZ2xldG9uIGNvbXBvbmVudHNcbiAgICB0aGlzLmNvbXBvbmVudHMgPSB7fTtcblxuICAgIHRoaXMuZXZlbnRRdWV1ZXMgPSB7fTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlciA9IG5ldyBFdmVudERpc3BhdGNoZXIoKTtcblxuICAgIGlmICh0eXBlb2YgQ3VzdG9tRXZlbnQgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHZhciBldmVudCA9IG5ldyBDdXN0b21FdmVudChcImVjc3ktd29ybGQtY3JlYXRlZFwiLCB7IGRldGFpbDogdGhpcyB9KTtcbiAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgICB9XG4gIH1cblxuICBlbWl0RXZlbnQoZXZlbnROYW1lLCBkYXRhKSB7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChldmVudE5hbWUsIGRhdGEpO1xuICB9XG5cbiAgYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzaW5nbGV0b24gY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgU2luZ2xldG9uIGNvbXBvbmVudFxuICAgKi9cbiAgcmVnaXN0ZXJTaW5nbGV0b25Db21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5yZWdpc3RlclNpbmdsZXRvbkNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIHRoaXMuY29tcG9uZW50c1tjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KV0gPSBuZXcgQ29tcG9uZW50KCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICAgKi9cbiAgcmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5yZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgc3lzdGVtXG4gICAqIEBwYXJhbSB7U3lzdGVtfSBTeXN0ZW1cbiAgICovXG4gIHJlZ2lzdGVyU3lzdGVtKFN5c3RlbSwgYXR0cmlidXRlcykge1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlci5yZWdpc3RlclN5c3RlbShTeXN0ZW0sIGF0dHJpYnV0ZXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgc3lzdGVtcyBwZXIgZnJhbWVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbHRhIERlbHRhIHRpbWUgc2luY2UgdGhlIGxhc3QgY2FsbFxuICAgKiBAcGFyYW0ge051bWJlcn0gdGltZSBFbGFwc2VkIHRpbWVcbiAgICovXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUpIHtcbiAgICB0aGlzLnN5c3RlbU1hbmFnZXIuZXhlY3V0ZShkZWx0YSwgdGltZSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGVudGl0eVxuICAgKi9cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLmVudGl0eU1hbmFnZXIuY3JlYXRlRW50aXR5KCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHNvbWUgc3RhdHNcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIGVudGl0aWVzOiB0aGlzLmVudGl0eU1hbmFnZXIuc3RhdHMoKSxcbiAgICAgIHN5c3RlbTogdGhpcy5zeXN0ZW1NYW5hZ2VyLnN0YXRzKClcbiAgICB9O1xuXG4gICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoc3RhdHMsIG51bGwsIDIpKTtcbiAgfVxufVxuIiwiLyoqXG4gKiBAY2xhc3MgU3lzdGVtXG4gKi9cbmltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgU3lzdGVtIHtcbiAgdG9KU09OKCkge1xuICAgIHZhciBqc29uID0ge1xuICAgICAgbmFtZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgZW5hYmxlZDogdGhpcy5lbmFibGVkLFxuICAgICAgZXhlY3V0ZVRpbWU6IHRoaXMuZXhlY3V0ZVRpbWUsXG4gICAgICBwcmlvcml0eTogdGhpcy5wcmlvcml0eSxcbiAgICAgIHF1ZXJpZXM6IHt9LFxuICAgICAgZXZlbnRzOiB7fVxuICAgIH07XG5cbiAgICBpZiAodGhpcy5jb25maWcpIHtcbiAgICAgIHZhciBxdWVyaWVzID0gdGhpcy5jb25maWcucXVlcmllcztcbiAgICAgIGZvciAobGV0IHF1ZXJ5TmFtZSBpbiBxdWVyaWVzKSB7XG4gICAgICAgIGxldCBxdWVyeSA9IHF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAganNvbi5xdWVyaWVzW3F1ZXJ5TmFtZV0gPSB7XG4gICAgICAgICAga2V5OiB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV0ua2V5XG4gICAgICAgIH07XG4gICAgICAgIGlmIChxdWVyeS5ldmVudHMpIHtcbiAgICAgICAgICBsZXQgZXZlbnRzID0gKGpzb24ucXVlcmllc1txdWVyeU5hbWVdW1wiZXZlbnRzXCJdID0ge30pO1xuICAgICAgICAgIGZvciAobGV0IGV2ZW50TmFtZSBpbiBxdWVyeS5ldmVudHMpIHtcbiAgICAgICAgICAgIGxldCBldmVudCA9IHF1ZXJ5LmV2ZW50c1tldmVudE5hbWVdO1xuICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0gPSB7XG4gICAgICAgICAgICAgIGV2ZW50TmFtZTogZXZlbnQuZXZlbnQsXG4gICAgICAgICAgICAgIG51bUVudGl0aWVzOiB0aGlzLmV2ZW50c1txdWVyeU5hbWVdW2V2ZW50TmFtZV0ubGVuZ3RoXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGV2ZW50LmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0uY29tcG9uZW50cyA9IGV2ZW50LmNvbXBvbmVudHMubWFwKGMgPT4gYy5uYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbGV0IGV2ZW50cyA9IHRoaXMuY29uZmlnLmV2ZW50cztcbiAgICAgIGZvciAobGV0IGV2ZW50TmFtZSBpbiBldmVudHMpIHtcbiAgICAgICAganNvbi5ldmVudHNbZXZlbnROYW1lXSA9IHtcbiAgICAgICAgICBldmVudE5hbWU6IGV2ZW50c1tldmVudE5hbWVdXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGpzb247XG4gIH1cblxuICBjb25zdHJ1Y3Rvcih3b3JsZCwgYXR0cmlidXRlcykge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgLy8gQHRvZG8gQmV0dGVyIG5hbWluZyA6KVxuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgICB0aGlzLnF1ZXJpZXMgPSB7fTtcblxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHRoaXMuZXZlbnRzID0ge307XG5cbiAgICB0aGlzLnByaW9yaXR5ID0gMDtcblxuICAgIC8vIFVzZWQgZm9yIHN0YXRzXG4gICAgdGhpcy5leGVjdXRlVGltZSA9IDA7XG5cbiAgICBpZiAoYXR0cmlidXRlcyAmJiBhdHRyaWJ1dGVzLnByaW9yaXR5KSB7XG4gICAgICB0aGlzLnByaW9yaXR5ID0gYXR0cmlidXRlcy5wcmlvcml0eTtcbiAgICB9XG5cbiAgICB0aGlzLmNvbmZpZyA9IHRoaXMuaW5pdCA/IHRoaXMuaW5pdCgpIDogbnVsbDtcblxuICAgIGlmICghdGhpcy5jb25maWcpIHJldHVybjtcbiAgICBpZiAodGhpcy5jb25maWcucXVlcmllcykge1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLmNvbmZpZy5xdWVyaWVzKSB7XG4gICAgICAgIHZhciBxdWVyeUNvbmZpZyA9IHRoaXMuY29uZmlnLnF1ZXJpZXNbbmFtZV07XG4gICAgICAgIHZhciBDb21wb25lbnRzID0gcXVlcnlDb25maWcuY29tcG9uZW50cztcbiAgICAgICAgaWYgKCFDb21wb25lbnRzIHx8IENvbXBvbmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiJ2NvbXBvbmVudHMnIGF0dHJpYnV0ZSBjYW4ndCBiZSBlbXB0eSBpbiBhIHF1ZXJ5XCIpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBxdWVyeSA9IHRoaXMud29ybGQuZW50aXR5TWFuYWdlci5xdWVyeUNvbXBvbmVudHMoQ29tcG9uZW50cyk7XG4gICAgICAgIHRoaXMuX3F1ZXJpZXNbbmFtZV0gPSBxdWVyeTtcbiAgICAgICAgdGhpcy5xdWVyaWVzW25hbWVdID0gcXVlcnkuZW50aXRpZXM7XG5cbiAgICAgICAgaWYgKHF1ZXJ5Q29uZmlnLmV2ZW50cykge1xuICAgICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0ge307XG4gICAgICAgICAgbGV0IGV2ZW50cyA9IHRoaXMuZXZlbnRzW25hbWVdO1xuICAgICAgICAgIGZvciAobGV0IGV2ZW50TmFtZSBpbiBxdWVyeUNvbmZpZy5ldmVudHMpIHtcbiAgICAgICAgICAgIGxldCBldmVudCA9IHF1ZXJ5Q29uZmlnLmV2ZW50c1tldmVudE5hbWVdO1xuICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0gPSBbXTtcblxuICAgICAgICAgICAgY29uc3QgZXZlbnRNYXBwaW5nID0ge1xuICAgICAgICAgICAgICBFbnRpdHlBZGRlZDogUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCxcbiAgICAgICAgICAgICAgRW50aXR5UmVtb3ZlZDogUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICAgICAgICBFbnRpdHlDaGFuZ2VkOiBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0NIQU5HRURcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChldmVudE1hcHBpbmdbZXZlbnQuZXZlbnRdKSB7XG4gICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgIGV2ZW50TWFwcGluZ1tldmVudC5ldmVudF0sXG4gICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgIGV2ZW50c1tldmVudE5hbWVdLnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmV2ZW50ID09PSBcIkNvbXBvbmVudENoYW5nZWRcIikge1xuICAgICAgICAgICAgICBxdWVyeS5yZWFjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAoZW50aXR5LCBjb21wb25lbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChldmVudC5jb21wb25lbnRzLmluZGV4T2YoY29tcG9uZW50LmNvbnN0cnVjdG9yKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0ucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb25maWcuZXZlbnRzKSB7XG4gICAgICBmb3IgKGxldCBuYW1lIGluIHRoaXMuY29uZmlnLmV2ZW50cykge1xuICAgICAgICB2YXIgZXZlbnQgPSB0aGlzLmNvbmZpZy5ldmVudHNbbmFtZV07XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0gW107XG4gICAgICAgIHRoaXMud29ybGQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgZGF0YSA9PiB7XG4gICAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0ucHVzaChkYXRhKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHBsYXkoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgfVxuXG4gIGNsZWFyRXZlbnRzKCkge1xuICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5ldmVudHMpIHtcbiAgICAgIHZhciBldmVudCA9IHRoaXMuZXZlbnRzW25hbWVdO1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdLmxlbmd0aCA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKG5hbWUgaW4gZXZlbnQpIHtcbiAgICAgICAgICBldmVudFtuYW1lXS5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBOb3QoQ29tcG9uZW50KSB7XG4gIHJldHVybiB7XG4gICAgb3BlcmF0b3I6IFwibm90XCIsXG4gICAgQ29tcG9uZW50OiBDb21wb25lbnRcbiAgfTtcbn1cbiIsImNsYXNzIEZsb2F0VmFsaWRhdG9yIHtcbiAgc3RhdGljIHZhbGlkYXRlKG4pIHtcbiAgICByZXR1cm4gTnVtYmVyKG4pID09PSBuICYmIG4gJSAxICE9PSAwO1xuICB9XG59XG5cbnZhciBTY2hlbWFUeXBlcyA9IHtcbiAgZmxvYXQ6IEZsb2F0VmFsaWRhdG9yXG4gIC8qXG4gIGFycmF5XG4gIGJvb2xcbiAgZnVuY1xuICBudW1iZXJcbiAgb2JqZWN0XG4gIHN0cmluZ1xuICBzeW1ib2xcblxuICBhbnlcbiAgYXJyYXlPZlxuICBlbGVtZW50XG4gIGVsZW1lbnRUeXBlXG4gIGluc3RhbmNlT2ZcbiAgbm9kZVxuICBvYmplY3RPZlxuICBvbmVPZlxuICBvbmVPZlR5cGVcbiAgc2hhcGVcbiAgZXhhY3RcbiovXG59O1xuXG5leHBvcnQgeyBTY2hlbWFUeXBlcyB9O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0NBQUE7Q0FDQTtDQUNBO0FBQ0EsQ0FBTyxNQUFNLGFBQWEsQ0FBQztDQUMzQixFQUFFLFdBQVcsQ0FBQyxLQUFLLEVBQUU7Q0FDckIsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztDQUN0QixJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0NBQ3ZCLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFO0NBQ3JDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO0NBQzFELElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0NBQ3ZCLElBQUksT0FBTyxJ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
