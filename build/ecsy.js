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
	  reset() {
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

	class TagComponent {}

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
	      if (
	        Component.prototype.reset ||
	        Component.prototype instanceof TagComponent
	      ) {
	        this._componentPool[componentName] = new ObjectPool(Component);
	      } else {
	        console.warn(
	          `Component '${
            Component.name
          }' won't benefit from pooling because 'reset' method was not implemeneted.`
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

	class Component {}

	exports.Component = Component;
	exports.Not = Not;
	exports.SchemaTypes = SchemaTypes;
	exports.System = System;
	exports.TagComponent = TagComponent;
	exports.World = World;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL1N5c3RlbU1hbmFnZXIuanMiLCIuLi9zcmMvRXZlbnREaXNwYXRjaGVyLmpzIiwiLi4vc3JjL1V0aWxzLmpzIiwiLi4vc3JjL1F1ZXJ5LmpzIiwiLi4vc3JjL0VudGl0eS5qcyIsIi4uL3NyYy9PYmplY3RQb29sLmpzIiwiLi4vc3JjL1F1ZXJ5TWFuYWdlci5qcyIsIi4uL3NyYy9FbnRpdHlNYW5hZ2VyLmpzIiwiLi4vc3JjL0R1bW15T2JqZWN0UG9vbC5qcyIsIi4uL3NyYy9UYWdDb21wb25lbnQuanMiLCIuLi9zcmMvQ29tcG9uZW50TWFuYWdlci5qcyIsIi4uL3NyYy9Xb3JsZC5qcyIsIi4uL3NyYy9TeXN0ZW0uanMiLCIuLi9zcmMvU2NoZW1hVHlwZXMuanMiLCIuLi9zcmMvQ29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGNsYXNzIFN5c3RlbU1hbmFnZXJcbiAqL1xuZXhwb3J0IGNsYXNzIFN5c3RlbU1hbmFnZXIge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMuc3lzdGVtcyA9IFtdO1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIHN5c3RlbVxuICAgKiBAcGFyYW0ge1N5c3RlbX0gU3lzdGVtIFN5c3RlbSB0byByZWdpc3RlclxuICAgKi9cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtLCBhdHRyaWJ1dGVzKSB7XG4gICAgdmFyIHN5c3RlbSA9IG5ldyBTeXN0ZW0odGhpcy53b3JsZCwgYXR0cmlidXRlcyk7XG4gICAgc3lzdGVtLm9yZGVyID0gdGhpcy5zeXN0ZW1zLmxlbmd0aDtcbiAgICB0aGlzLnN5c3RlbXMucHVzaChzeXN0ZW0pO1xuICAgIHRoaXMuc29ydFN5c3RlbXMoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHNvcnRTeXN0ZW1zKCkge1xuICAgIHRoaXMuc3lzdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICByZXR1cm4gYS5wcmlvcml0eSAtIGIucHJpb3JpdHkgfHwgYS5vcmRlciAtIGIub3JkZXI7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgc3lzdGVtXG4gICAqIEBwYXJhbSB7U3lzdGVtfSBTeXN0ZW0gU3lzdGVtIHRvIHJlbW92ZVxuICAgKi9cbiAgcmVtb3ZlU3lzdGVtKFN5c3RlbSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuc3lzdGVtcy5pbmRleE9mKFN5c3RlbSk7XG4gICAgaWYgKCF+aW5kZXgpIHJldHVybjtcblxuICAgIHRoaXMuc3lzdGVtcy5zcGxpY2UoaW5kZXgsIDEpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBhbGwgdGhlIHN5c3RlbXMuIENhbGxlZCBwZXIgZnJhbWUuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBkZWx0YSBEZWx0YSB0aW1lIHNpbmNlIHRoZSBsYXN0IGZyYW1lXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lIEVsYXBzZWQgdGltZVxuICAgKi9cbiAgZXhlY3V0ZShkZWx0YSwgdGltZSkge1xuICAgIHRoaXMuc3lzdGVtcy5mb3JFYWNoKHN5c3RlbSA9PiB7XG4gICAgICBpZiAoc3lzdGVtLmVuYWJsZWQgJiYgc3lzdGVtLmluaXRpYWxpemVkKSB7XG4gICAgICAgIGlmIChzeXN0ZW0uZXhlY3V0ZSkge1xuICAgICAgICAgIGxldCBzdGFydFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICBzeXN0ZW0uZXhlY3V0ZShkZWx0YSwgdGltZSk7XG4gICAgICAgICAgc3lzdGVtLmV4ZWN1dGVUaW1lID0gcGVyZm9ybWFuY2Uubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICAgIH1cbiAgICAgICAgc3lzdGVtLmNsZWFyRXZlbnRzKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHN0YXRzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBudW1TeXN0ZW1zOiB0aGlzLnN5c3RlbXMubGVuZ3RoLFxuICAgICAgc3lzdGVtczoge31cbiAgICB9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnN5c3RlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBzeXN0ZW0gPSB0aGlzLnN5c3RlbXNbaV07XG4gICAgICB2YXIgc3lzdGVtU3RhdHMgPSAoc3RhdHMuc3lzdGVtc1tzeXN0ZW0uY29uc3RydWN0b3IubmFtZV0gPSB7XG4gICAgICAgIHF1ZXJpZXM6IHt9XG4gICAgICB9KTtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gc3lzdGVtLmN0eCkge1xuICAgICAgICBzeXN0ZW1TdGF0cy5xdWVyaWVzW25hbWVdID0gc3lzdGVtLmN0eFtuYW1lXS5zdGF0cygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuIiwiLyoqXG4gKiBAY2xhc3MgRXZlbnREaXNwYXRjaGVyXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEV2ZW50RGlzcGF0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuX2xpc3RlbmVycyA9IHt9O1xuICAgIHRoaXMuc3RhdHMgPSB7XG4gICAgICBmaXJlZDogMCxcbiAgICAgIGhhbmRsZWQ6IDBcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhbiBldmVudCBsaXN0ZW5lclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGxpc3RlblxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayB0byB0cmlnZ2VyIHdoZW4gdGhlIGV2ZW50IGlzIGZpcmVkXG4gICAqL1xuICBhZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICBsZXQgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnROYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgIH1cblxuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnROYW1lXS5pbmRleE9mKGxpc3RlbmVyKSA9PT0gLTEpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudE5hbWVdLnB1c2gobGlzdGVuZXIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBhbiBldmVudCBsaXN0ZW5lciBpcyBhbHJlYWR5IGFkZGVkIHRvIHRoZSBsaXN0IG9mIGxpc3RlbmVyc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGNoZWNrXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50XG4gICAqL1xuICBoYXNFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihsaXN0ZW5lcikgIT09IC0xXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byByZW1vdmVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnRcbiAgICovXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIHZhciBsaXN0ZW5lckFycmF5ID0gdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV07XG4gICAgaWYgKGxpc3RlbmVyQXJyYXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGluZGV4ID0gbGlzdGVuZXJBcnJheS5pbmRleE9mKGxpc3RlbmVyKTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgbGlzdGVuZXJBcnJheS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNwYXRjaCBhbiBldmVudFxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGRpc3BhdGNoXG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgKE9wdGlvbmFsKSBFbnRpdHkgdG8gZW1pdFxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XG4gICAqL1xuICBkaXNwYXRjaEV2ZW50KGV2ZW50TmFtZSwgZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkKys7XG5cbiAgICB2YXIgbGlzdGVuZXJBcnJheSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xuICAgIGlmIChsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBhcnJheSA9IGxpc3RlbmVyQXJyYXkuc2xpY2UoMCk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJyYXlbaV0uY2FsbCh0aGlzLCBlbnRpdHksIGNvbXBvbmVudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHN0YXRzIGNvdW50ZXJzXG4gICAqL1xuICByZXNldENvdW50ZXJzKCkge1xuICAgIHRoaXMuc3RhdHMuZmlyZWQgPSB0aGlzLnN0YXRzLmhhbmRsZWQgPSAwO1xuICB9XG59XG4iLCIvKipcbiAqIFJldHVybiB0aGUgbmFtZSBvZiBhIGNvbXBvbmVudFxuICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TmFtZShDb21wb25lbnQpIHtcbiAgcmV0dXJuIENvbXBvbmVudC5uYW1lO1xufVxuXG4vKipcbiAqIFJldHVybiBhIHZhbGlkIHByb3BlcnR5IG5hbWUgZm9yIHRoZSBDb21wb25lbnRcbiAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpIHtcbiAgdmFyIG5hbWUgPSBnZXROYW1lKENvbXBvbmVudCk7XG4gIHJldHVybiBuYW1lLmNoYXJBdCgwKS50b0xvd2VyQ2FzZSgpICsgbmFtZS5zbGljZSgxKTtcbn1cblxuLyoqXG4gKiBHZXQgYSBrZXkgZnJvbSBhIGxpc3Qgb2YgY29tcG9uZW50c1xuICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIEFycmF5IG9mIGNvbXBvbmVudHMgdG8gZ2VuZXJhdGUgdGhlIGtleVxuICovXG5leHBvcnQgZnVuY3Rpb24gcXVlcnlLZXkoQ29tcG9uZW50cykge1xuICB2YXIgbmFtZXMgPSBbXTtcbiAgZm9yICh2YXIgbiA9IDA7IG4gPCBDb21wb25lbnRzLmxlbmd0aDsgbisrKSB7XG4gICAgdmFyIFQgPSBDb21wb25lbnRzW25dO1xuICAgIGlmICh0eXBlb2YgVCA9PT0gXCJvYmplY3RcIikge1xuICAgICAgdmFyIG9wZXJhdG9yID0gVC5vcGVyYXRvciA9PT0gXCJub3RcIiA/IFwiIVwiIDogVC5vcGVyYXRvcjtcbiAgICAgIG5hbWVzLnB1c2gob3BlcmF0b3IgKyBnZXROYW1lKFQuQ29tcG9uZW50KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hbWVzLnB1c2goZ2V0TmFtZShUKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWVzXG4gICAgLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geC50b0xvd2VyQ2FzZSgpO1xuICAgIH0pXG4gICAgLnNvcnQoKVxuICAgIC5qb2luKFwiLVwiKTtcbn1cbiIsImltcG9ydCBFdmVudERpc3BhdGNoZXIgZnJvbSBcIi4vRXZlbnREaXNwYXRjaGVyLmpzXCI7XG5pbXBvcnQgeyBxdWVyeUtleSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIFF1ZXJ5XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFF1ZXJ5IHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBMaXN0IG9mIHR5cGVzIG9mIGNvbXBvbmVudHMgdG8gcXVlcnlcbiAgICovXG4gIGNvbnN0cnVjdG9yKENvbXBvbmVudHMsIG1hbmFnZXIpIHtcbiAgICB0aGlzLkNvbXBvbmVudHMgPSBbXTtcbiAgICB0aGlzLk5vdENvbXBvbmVudHMgPSBbXTtcblxuICAgIENvbXBvbmVudHMuZm9yRWFjaChjb21wb25lbnQgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBjb21wb25lbnQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgdGhpcy5Ob3RDb21wb25lbnRzLnB1c2goY29tcG9uZW50LkNvbXBvbmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLkNvbXBvbmVudHMucHVzaChjb21wb25lbnQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuQ29tcG9uZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGNyZWF0ZSBhIHF1ZXJ5IHdpdGhvdXQgY29tcG9uZW50c1wiKTtcbiAgICB9XG5cbiAgICB0aGlzLmVudGl0aWVzID0gW107XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG5cbiAgICAvLyBUaGlzIHF1ZXJ5IGlzIGJlaW5nIHVzZWQgYnkgYSByZWFjdGl2ZSBzeXN0ZW1cbiAgICB0aGlzLnJlYWN0aXZlID0gZmFsc2U7XG5cbiAgICB0aGlzLmtleSA9IHF1ZXJ5S2V5KENvbXBvbmVudHMpO1xuXG4gICAgLy8gRmlsbCB0aGUgcXVlcnkgd2l0aCB0aGUgZXhpc3RpbmcgZW50aXRpZXNcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hbmFnZXIuX2VudGl0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZW50aXR5ID0gbWFuYWdlci5fZW50aXRpZXNbaV07XG4gICAgICBpZiAodGhpcy5tYXRjaChlbnRpdHkpKSB7XG4gICAgICAgIC8vIEB0b2RvID8/PyB0aGlzLmFkZEVudGl0eShlbnRpdHkpOyA9PiBwcmV2ZW50aW5nIHRoZSBldmVudCB0byBiZSBnZW5lcmF0ZWRcbiAgICAgICAgZW50aXR5LnF1ZXJpZXMucHVzaCh0aGlzKTtcbiAgICAgICAgdGhpcy5lbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBlbnRpdHkgdG8gdGhpcyBxdWVyeVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5XG4gICAqL1xuICBhZGRFbnRpdHkoZW50aXR5KSB7XG4gICAgZW50aXR5LnF1ZXJpZXMucHVzaCh0aGlzKTtcbiAgICB0aGlzLmVudGl0aWVzLnB1c2goZW50aXR5KTtcblxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCwgZW50aXR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgZW50aXR5IGZyb20gdGhpcyBxdWVyeVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5XG4gICAqL1xuICByZW1vdmVFbnRpdHkoZW50aXR5KSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgaWYgKH5pbmRleCkge1xuICAgICAgdGhpcy5lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICBpbmRleCA9IGVudGl0eS5xdWVyaWVzLmluZGV4T2YodGhpcyk7XG4gICAgICBlbnRpdHkucXVlcmllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBRdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQsXG4gICAgICAgIGVudGl0eVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBtYXRjaChlbnRpdHksIGluY2x1ZGVSZW1vdmVkID0gZmFsc2UpIHtcbiAgICByZXR1cm4gKFxuICAgICAgZW50aXR5Lmhhc0FsbENvbXBvbmVudHModGhpcy5Db21wb25lbnRzLCBpbmNsdWRlUmVtb3ZlZCkgJiZcbiAgICAgICFlbnRpdHkuaGFzQW55Q29tcG9uZW50cyh0aGlzLk5vdENvbXBvbmVudHMsIGluY2x1ZGVSZW1vdmVkKVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIHN0YXRzIGZvciB0aGlzIHF1ZXJ5XG4gICAqL1xuICBzdGF0cygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbnVtQ29tcG9uZW50czogdGhpcy5Db21wb25lbnRzLmxlbmd0aCxcbiAgICAgIG51bUVudGl0aWVzOiB0aGlzLmVudGl0aWVzLmxlbmd0aFxuICAgIH07XG4gIH1cbn1cblxuUXVlcnkucHJvdG90eXBlLkVOVElUWV9BRERFRCA9IFwiUXVlcnkjRU5USVRZX0FEREVEXCI7XG5RdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQgPSBcIlF1ZXJ5I0VOVElUWV9SRU1PVkVEXCI7XG5RdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQgPSBcIlF1ZXJ5I0NPTVBPTkVOVF9DSEFOR0VEXCI7XG4iLCJpbXBvcnQgUXVlcnkgZnJvbSBcIi4vUXVlcnkuanNcIjtcbmltcG9ydCB3cmFwSW1tdXRhYmxlQ29tcG9uZW50IGZyb20gXCIuL1dyYXBJbW11dGFibGVDb21wb25lbnQuanNcIjtcblxuLy8gQHRvZG8gVGFrZSB0aGlzIG91dCBmcm9tIHRoZXJlIG9yIHVzZSBFTlZcbmNvbnN0IERFQlVHID0gZmFsc2U7XG5cbi8vIEB0b2RvIHJlc2V0IGl0IGJ5IHdvcmxkP1xudmFyIG5leHRJZCA9IDA7XG5cbi8qKlxuICogQGNsYXNzIEVudGl0eVxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFbnRpdHkge1xuICAvKipcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBjbGFzcyBFbnRpdHlcbiAgICogQHBhcmFtIHtXb3JsZH0gd29ybGRcbiAgICovXG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy5fd29ybGQgPSB3b3JsZCB8fCBudWxsO1xuXG4gICAgLy8gVW5pcXVlIElEIGZvciB0aGlzIGVudGl0eVxuICAgIHRoaXMuaWQgPSBuZXh0SWQrKztcblxuICAgIC8vIExpc3Qgb2YgY29tcG9uZW50cyB0eXBlcyB0aGUgZW50aXR5IGhhc1xuICAgIHRoaXMuX0NvbXBvbmVudFR5cGVzID0gW107XG5cbiAgICAvLyBJbnN0YW5jZSBvZiB0aGUgY29tcG9uZW50c1xuICAgIHRoaXMuX2NvbXBvbmVudHMgPSB7fTtcblxuICAgIC8vIExpc3Qgb2YgdGFncyB0aGlzIGVudGl0eSBoYXNcbiAgICB0aGlzLl90YWdzID0gW107XG5cbiAgICAvLyBRdWVyaWVzIHdoZXJlIHRoZSBlbnRpdHkgaXMgYWRkZWRcbiAgICB0aGlzLnF1ZXJpZXMgPSBbXTtcblxuICAgIC8vIFVzZWQgZm9yIGRlZmVycmVkIHJlbW92YWxcbiAgICB0aGlzLmNvbXBvbmVudHNUb1JlbW92ZSA9IFtdO1xuICB9XG5cbiAgLy8gQ09NUE9ORU5UU1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gYW4gaW1tdXRhYmxlIHJlZmVyZW5jZSBvZiBhIGNvbXBvbmVudFxuICAgKiBOb3RlOiBBIHByb3h5IHdpbGwgYmUgdXNlZCBvbiBkZWJ1ZyBtb2RlLCBhbmQgaXQgd2lsbCBqdXN0IGFmZmVjdFxuICAgKiAgICAgICB0aGUgZmlyc3QgbGV2ZWwgYXR0cmlidXRlcyBvbiB0aGUgb2JqZWN0LCBpdCB3b24ndCB3b3JrIHJlY3Vyc2l2ZWx5LlxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gVHlwZSBvZiBjb21wb25lbnQgdG8gZ2V0XG4gICAqIEByZXR1cm4ge0NvbXBvbmVudH0gSW1tdXRhYmxlIGNvbXBvbmVudCByZWZlcmVuY2VcbiAgICovXG4gIGdldENvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcy5fY29tcG9uZW50c1tDb21wb25lbnQubmFtZV07XG4gICAgcmV0dXJuIERFQlVHID8gd3JhcEltbXV0YWJsZUNvbXBvbmVudChDb21wb25lbnQsIGNvbXBvbmVudCkgOiBjb21wb25lbnQ7XG4gIH1cblxuICBnZXRDb21wb25lbnRzKCkge1xuICAgIHJldHVybiB0aGlzLl9jb21wb25lbnRzO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50VHlwZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX0NvbXBvbmVudFR5cGVzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIG11dGFibGUgcmVmZXJlbmNlIG9mIGEgY29tcG9uZW50LlxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gVHlwZSBvZiBjb21wb25lbnQgdG8gZ2V0XG4gICAqIEByZXR1cm4ge0NvbXBvbmVudH0gTXV0YWJsZSBjb21wb25lbnQgcmVmZXJlbmNlXG4gICAqL1xuICBnZXRNdXRhYmxlQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucXVlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW2ldO1xuICAgICAgaWYgKHF1ZXJ5LnJlYWN0aXZlKSB7XG4gICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgIGNvbXBvbmVudFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY29tcG9uZW50O1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIGNvbXBvbmVudCB0byB0aGUgZW50aXR5XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgdG8gYWRkIHRvIHRoaXMgZW50aXR5XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBPcHRpb25hbCB2YWx1ZXMgdG8gcmVwbGFjZSB0aGUgZGVmYXVsdCBhdHRyaWJ1dGVzIG9uIHRoZSBjb21wb25lbnRcbiAgICovXG4gIGFkZENvbXBvbmVudChDb21wb25lbnQsIHZhbHVlcykge1xuICAgIHRoaXMuX3dvcmxkLmVudGl0eUFkZENvbXBvbmVudCh0aGlzLCBDb21wb25lbnQsIHZhbHVlcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGEgY29tcG9uZW50IGZyb20gdGhlIGVudGl0eVxuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50IHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZUNvbXBvbmVudChDb21wb25lbnQsIGZvcmNlUmVtb3ZlKSB7XG4gICAgdGhpcy5fd29ybGQuZW50aXR5UmVtb3ZlQ29tcG9uZW50KHRoaXMsIENvbXBvbmVudCwgZm9yY2VSZW1vdmUpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGEgY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgdG8gY2hlY2tcbiAgICogQHBhcmFtIHtCb29sfSBpbmNsdWRlIENvbXBvbmVudHMgcXVldWVkIGZvciByZW1vdmFsIChEZWZhdWx0IGlzIGZhbHNlKVxuICAgKi9cbiAgaGFzQ29tcG9uZW50KENvbXBvbmVudCwgaW5jbHVkZVJlbW92ZWQgPSBmYWxzZSkge1xuICAgIHJldHVybiAoXG4gICAgICAhIX50aGlzLl9Db21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgIChpbmNsdWRlUmVtb3ZlZCB8fCAhfnRoaXMuY29tcG9uZW50c1RvUmVtb3ZlLmluZGV4T2YoQ29tcG9uZW50KSlcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBlbnRpdHkgaGFzIGFsbCBjb21wb25lbnRzIGluIGEgbGlzdFxuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgdG8gY2hlY2tcbiAgICogQHBhcmFtIHtCb29sfSBpbmNsdWRlIENvbXBvbmVudHMgcXVldWVkIGZvciByZW1vdmFsIChEZWZhdWx0IGlzIGZhbHNlKVxuICAgKi9cbiAgaGFzQWxsQ29tcG9uZW50cyhDb21wb25lbnRzLCBpbmNsdWRlUmVtb3ZlZCA9IGZhbHNlKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBDb21wb25lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIXRoaXMuaGFzQ29tcG9uZW50KENvbXBvbmVudHNbaV0sIGluY2x1ZGVSZW1vdmVkKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGUgZW50aXR5IGhhcyBhbnkgY29tcG9uZW50cyBpbiBhIGxpc3RcbiAgICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIHRvIGNoZWNrXG4gICAqIEBwYXJhbSB7Qm9vbH0gaW5jbHVkZSBDb21wb25lbnRzIHF1ZXVlZCBmb3IgcmVtb3ZhbCAoRGVmYXVsdCBpcyBmYWxzZSlcbiAgICovXG4gIGhhc0FueUNvbXBvbmVudHMoQ29tcG9uZW50cywgaW5jbHVkZVJlbW92ZWQgPSBmYWxzZSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuaGFzQ29tcG9uZW50KENvbXBvbmVudHNbaV0sIGluY2x1ZGVSZW1vdmVkKSkgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRoZSBjb21wb25lbnRzIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlQWxsQ29tcG9uZW50cyhmb3JjZVJlbW92ZSkge1xuICAgIHJldHVybiB0aGlzLl93b3JsZC5lbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKHRoaXMsIGZvcmNlUmVtb3ZlKTtcbiAgfVxuXG4gIC8vIFRBR1NcblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhlIGVudGl0eSBoYXMgYSB0YWdcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZyBUYWcgdG8gY2hlY2tcbiAgICovXG4gIGhhc1RhZyh0YWcpIHtcbiAgICByZXR1cm4gISF+dGhpcy5fdGFncy5pbmRleE9mKHRhZyk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgdGFnIHRvIHRoaXMgZW50aXR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIGFkZCB0byB0aGlzIGVudGl0eVxuICAgKi9cbiAgYWRkVGFnKHRhZykge1xuICAgIHRoaXMuX3dvcmxkLmVudGl0eUFkZFRhZyh0aGlzLCB0YWcpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIHRhZyBmcm9tIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZyBUYWcgdG8gcmVtb3ZlIGZyb20gdGhlIGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlVGFnKHRhZykge1xuICAgIHRoaXMuX3dvcmxkLmVudGl0eVJlbW92ZVRhZyh0aGlzLCB0YWcpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gRVhUUkFTXG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgdGhlIGVudGl0eS4gVG8gYmUgdXNlZCB3aGVuIHJldHVybmluZyBhbiBlbnRpdHkgdG8gdGhlIHBvb2xcbiAgICovXG4gIHJlc2V0KCkge1xuICAgIHRoaXMuaWQgPSBuZXh0SWQrKztcbiAgICB0aGlzLl93b3JsZCA9IG51bGw7XG4gICAgdGhpcy5fQ29tcG9uZW50VHlwZXMubGVuZ3RoID0gMDtcbiAgICB0aGlzLnF1ZXJpZXMubGVuZ3RoID0gMDtcbiAgICB0aGlzLl9jb21wb25lbnRzID0ge307XG4gICAgdGhpcy5fdGFncy5sZW5ndGggPSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0aGUgZW50aXR5IGZyb20gdGhlIHdvcmxkXG4gICAqL1xuICByZW1vdmUoZm9yY2VSZW1vdmUpIHtcbiAgICByZXR1cm4gdGhpcy5fd29ybGQucmVtb3ZlRW50aXR5KHRoaXMsIGZvcmNlUmVtb3ZlKTtcbiAgfVxufVxuIiwiLyoqXG4gKiBAY2xhc3MgT2JqZWN0UG9vbFxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBPYmplY3RQb29sIHtcbiAgLy8gQHRvZG8gQWRkIGluaXRpYWwgc2l6ZVxuICBjb25zdHJ1Y3RvcihULCBpbml0aWFsU2l6ZSkge1xuICAgIHRoaXMuZnJlZUxpc3QgPSBbXTtcbiAgICB0aGlzLmNvdW50ID0gMDtcbiAgICB0aGlzLlQgPSBUO1xuXG4gICAgdmFyIGV4dHJhQXJncyA9IG51bGw7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICBleHRyYUFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgZXh0cmFBcmdzLnNoaWZ0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5jcmVhdGVFbGVtZW50ID0gZXh0cmFBcmdzXG4gICAgICA/ICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFQoLi4uZXh0cmFBcmdzKTtcbiAgICAgICAgfVxuICAgICAgOiAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBUKCk7XG4gICAgICAgIH07XG5cbiAgICBpZiAodHlwZW9mIGluaXRpYWxTaXplICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICB0aGlzLmV4cGFuZChpbml0aWFsU2l6ZSk7XG4gICAgfVxuICB9XG5cbiAgYXF1aXJlKCkge1xuICAgIC8vIEdyb3cgdGhlIGxpc3QgYnkgMjAlaXNoIGlmIHdlJ3JlIG91dFxuICAgIGlmICh0aGlzLmZyZWVMaXN0Lmxlbmd0aCA8PSAwKSB7XG4gICAgICB0aGlzLmV4cGFuZChNYXRoLnJvdW5kKHRoaXMuY291bnQgKiAwLjIpICsgMSk7XG4gICAgfVxuXG4gICAgdmFyIGl0ZW0gPSB0aGlzLmZyZWVMaXN0LnBvcCgpO1xuXG4gICAgcmV0dXJuIGl0ZW07XG4gIH1cblxuICByZWxlYXNlKGl0ZW0pIHtcbiAgICBpdGVtLnJlc2V0KCk7XG4gICAgdGhpcy5mcmVlTGlzdC5wdXNoKGl0ZW0pO1xuICB9XG5cbiAgZXhwYW5kKGNvdW50KSB7XG4gICAgZm9yICh2YXIgbiA9IDA7IG4gPCBjb3VudDsgbisrKSB7XG4gICAgICB0aGlzLmZyZWVMaXN0LnB1c2godGhpcy5jcmVhdGVFbGVtZW50KCkpO1xuICAgIH1cbiAgICB0aGlzLmNvdW50ICs9IGNvdW50O1xuICB9XG5cbiAgdG90YWxTaXplKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50O1xuICB9XG5cbiAgdG90YWxGcmVlKCkge1xuICAgIHJldHVybiB0aGlzLmZyZWVMaXN0Lmxlbmd0aDtcbiAgfVxuXG4gIHRvdGFsVXNlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5jb3VudCAtIHRoaXMuZnJlZUxpc3QubGVuZ3RoO1xuICB9XG59XG4iLCJpbXBvcnQgUXVlcnkgZnJvbSBcIi4vUXVlcnkuanNcIjtcbmltcG9ydCB7IHF1ZXJ5S2V5IH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcblxuLyoqXG4gKiBAY2xhc3MgUXVlcnlNYW5hZ2VyXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFF1ZXJ5TWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy5fd29ybGQgPSB3b3JsZDtcblxuICAgIC8vIFF1ZXJpZXMgaW5kZXhlZCBieSBhIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgY29tcG9uZW50cyBpdCBoYXNcbiAgICB0aGlzLl9xdWVyaWVzID0ge307XG4gIH1cblxuICBvbkVudGl0eVJlbW92ZWQoZW50aXR5KSB7XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuX3F1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgIGlmIChlbnRpdHkucXVlcmllcy5pbmRleE9mKHF1ZXJ5KSAhPT0gLTEpIHtcbiAgICAgICAgcXVlcnkucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdoZW4gYSBjb21wb25lbnQgaXMgYWRkZWQgdG8gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IHRoYXQganVzdCBnb3QgdGhlIG5ldyBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgYWRkZWQgdG8gdGhlIGVudGl0eVxuICAgKi9cbiAgb25FbnRpdHlDb21wb25lbnRBZGRlZChlbnRpdHksIENvbXBvbmVudCkge1xuICAgIC8vIEB0b2RvIFVzZSBiaXRtYXNrIGZvciBjaGVja2luZyBjb21wb25lbnRzP1xuXG4gICAgLy8gQ2hlY2sgZWFjaCBpbmRleGVkIHF1ZXJ5IHRvIHNlZSBpZiB3ZSBuZWVkIHRvIGFkZCB0aGlzIGVudGl0eSB0byB0aGUgbGlzdFxuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIGlmIChcbiAgICAgICAgISF+cXVlcnkuTm90Q29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgICAgfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIHF1ZXJ5LnJlbW92ZUVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIHRoZSBlbnRpdHkgb25seSBpZjpcbiAgICAgIC8vIENvbXBvbmVudCBpcyBpbiB0aGUgcXVlcnlcbiAgICAgIC8vIGFuZCBFbnRpdHkgaGFzIEFMTCB0aGUgY29tcG9uZW50cyBvZiB0aGUgcXVlcnlcbiAgICAgIC8vIGFuZCBFbnRpdHkgaXMgbm90IGFscmVhZHkgaW4gdGhlIHF1ZXJ5XG4gICAgICBpZiAoXG4gICAgICAgICF+cXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgfHxcbiAgICAgICAgIXF1ZXJ5Lm1hdGNoKGVudGl0eSkgfHxcbiAgICAgICAgfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KVxuICAgICAgKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgcXVlcnkuYWRkRW50aXR5KGVudGl0eSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdoZW4gYSBjb21wb25lbnQgaXMgcmVtb3ZlZCBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBmcm9tXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICovXG4gIG9uRW50aXR5Q29tcG9uZW50UmVtb3ZlZChlbnRpdHksIENvbXBvbmVudCkge1xuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIGlmIChcbiAgICAgICAgISF+cXVlcnkuTm90Q29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgICAgIX5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSkgJiZcbiAgICAgICAgcXVlcnkubWF0Y2goZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiUXVlcnkgbm93IG1hdGNoZXNcIiwgcXVlcnlOYW1lLCBlbnRpdHkpO1xuICAgICAgICBxdWVyeS5hZGRFbnRpdHkoZW50aXR5KTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChcbiAgICAgICAgISF+cXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgICAgISF+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpICYmXG4gICAgICAgICFxdWVyeS5tYXRjaChlbnRpdHkpXG4gICAgICApIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJRdWVyeSBubyBsb25nZXIgbWF0Y2hlc1wiLCBxdWVyeU5hbWUsIGVudGl0eSk7XG4gICAgICAgIHF1ZXJ5LnJlbW92ZUVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgcXVlcnkgZm9yIHRoZSBzcGVjaWZpZWQgY29tcG9uZW50c1xuICAgKiBAcGFyYW0ge0NvbXBvbmVudH0gQ29tcG9uZW50cyBDb21wb25lbnRzIHRoYXQgdGhlIHF1ZXJ5IHNob3VsZCBoYXZlXG4gICAqL1xuICBnZXRRdWVyeShDb21wb25lbnRzKSB7XG4gICAgdmFyIGtleSA9IHF1ZXJ5S2V5KENvbXBvbmVudHMpO1xuICAgIHZhciBxdWVyeSA9IHRoaXMuX3F1ZXJpZXNba2V5XTtcbiAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICB0aGlzLl9xdWVyaWVzW2tleV0gPSBxdWVyeSA9IG5ldyBRdWVyeShDb21wb25lbnRzLCB0aGlzLl93b3JsZCk7XG4gICAgfVxuICAgIHJldHVybiBxdWVyeTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc29tZSBzdGF0cyBmcm9tIHRoaXMgY2xhc3NcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHt9O1xuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLl9xdWVyaWVzKSB7XG4gICAgICBzdGF0c1txdWVyeU5hbWVdID0gdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdLnN0YXRzKCk7XG4gICAgfVxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuIiwiaW1wb3J0IEVudGl0eSBmcm9tIFwiLi9FbnRpdHkuanNcIjtcbmltcG9ydCBPYmplY3RQb29sIGZyb20gXCIuL09iamVjdFBvb2wuanNcIjtcbmltcG9ydCBRdWVyeU1hbmFnZXIgZnJvbSBcIi4vUXVlcnlNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgRXZlbnREaXNwYXRjaGVyIGZyb20gXCIuL0V2ZW50RGlzcGF0Y2hlci5qc1wiO1xuaW1wb3J0IHsgY29tcG9uZW50UHJvcGVydHlOYW1lLCBnZXROYW1lIH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcblxuLyoqXG4gKiBAY2xhc3MgRW50aXR5TWFuYWdlclxuICovXG5leHBvcnQgY2xhc3MgRW50aXR5TWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKHdvcmxkKSB7XG4gICAgdGhpcy53b3JsZCA9IHdvcmxkO1xuICAgIHRoaXMuY29tcG9uZW50c01hbmFnZXIgPSB3b3JsZC5jb21wb25lbnRzTWFuYWdlcjtcblxuICAgIC8vIEFsbCB0aGUgZW50aXRpZXMgaW4gdGhpcyBpbnN0YW5jZVxuICAgIHRoaXMuX2VudGl0aWVzID0gW107XG5cbiAgICAvLyBNYXAgYmV0d2VlbiB0YWcgYW5kIGVudGl0aWVzXG4gICAgdGhpcy5fdGFncyA9IHt9O1xuXG4gICAgdGhpcy5fcXVlcnlNYW5hZ2VyID0gbmV3IFF1ZXJ5TWFuYWdlcih0aGlzKTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlciA9IG5ldyBFdmVudERpc3BhdGNoZXIoKTtcbiAgICB0aGlzLl9lbnRpdHlQb29sID0gbmV3IE9iamVjdFBvb2woRW50aXR5KTtcblxuICAgIC8vIERlZmVycmVkIGRlbGV0aW9uXG4gICAgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUgPSBbXTtcbiAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUgPSBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgZW50aXR5XG4gICAqL1xuICBjcmVhdGVFbnRpdHkoKSB7XG4gICAgdmFyIGVudGl0eSA9IHRoaXMuX2VudGl0eVBvb2wuYXF1aXJlKCk7XG4gICAgZW50aXR5Ll93b3JsZCA9IHRoaXM7XG4gICAgdGhpcy5fZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoRU5USVRZX0NSRUFURUQsIGVudGl0eSk7XG4gICAgcmV0dXJuIGVudGl0eTtcbiAgfVxuXG4gIC8vIENPTVBPTkVOVFNcblxuICAvKipcbiAgICogQWRkIGEgY29tcG9uZW50IHRvIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB3aGVyZSB0aGUgY29tcG9uZW50IHdpbGwgYmUgYWRkZWRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gYmUgYWRkZWQgdG8gdGhlIGVudGl0eVxuICAgKiBAcGFyYW0ge09iamVjdH0gdmFsdWVzIE9wdGlvbmFsIHZhbHVlcyB0byByZXBsYWNlIHRoZSBkZWZhdWx0IGF0dHJpYnV0ZXNcbiAgICovXG4gIGVudGl0eUFkZENvbXBvbmVudChlbnRpdHksIENvbXBvbmVudCwgdmFsdWVzKSB7XG4gICAgaWYgKH5lbnRpdHkuX0NvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KSkgcmV0dXJuO1xuXG4gICAgZW50aXR5Ll9Db21wb25lbnRUeXBlcy5wdXNoKENvbXBvbmVudCk7XG5cbiAgICB2YXIgY29tcG9uZW50UG9vbCA9IHRoaXMud29ybGQuY29tcG9uZW50c01hbmFnZXIuZ2V0Q29tcG9uZW50c1Bvb2woXG4gICAgICBDb21wb25lbnRcbiAgICApO1xuICAgIHZhciBjb21wb25lbnQgPSBjb21wb25lbnRQb29sLmFxdWlyZSgpO1xuXG4gICAgZW50aXR5Ll9jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IGNvbXBvbmVudDtcblxuICAgIGlmICh2YWx1ZXMpIHtcbiAgICAgIGlmIChjb21wb25lbnQuY29weSkge1xuICAgICAgICBjb21wb25lbnQuY29weSh2YWx1ZXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yICh2YXIgbmFtZSBpbiB2YWx1ZXMpIHtcbiAgICAgICAgICBjb21wb25lbnRbbmFtZV0gPSB2YWx1ZXNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIub25FbnRpdHlDb21wb25lbnRBZGRlZChlbnRpdHksIENvbXBvbmVudCk7XG4gICAgdGhpcy53b3JsZC5jb21wb25lbnRzTWFuYWdlci5jb21wb25lbnRBZGRlZFRvRW50aXR5KENvbXBvbmVudCk7XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KENPTVBPTkVOVF9BRERFRCwgZW50aXR5LCBDb21wb25lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIGNvbXBvbmVudCBmcm9tIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB3aGljaCB3aWxsIGdldCByZW1vdmVkIHRoZSBjb21wb25lbnRcbiAgICogQHBhcmFtIHsqfSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlbW92ZSBmcm9tIHRoZSBlbnRpdHlcbiAgICogQHBhcmFtIHtCb29sfSBmb3JjZVJlbW92ZSBJZiB5b3Ugd2FudCB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBpbW1lZGlhdGVseSBpbnN0ZWFkIG9mIGRlZmVycmVkIChEZWZhdWx0IGlzIGZhbHNlKVxuICAgKi9cbiAgZW50aXR5UmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50LCBmb3JjZVJlbW92ZSkge1xuICAgIHZhciBpbmRleCA9IGVudGl0eS5fQ29tcG9uZW50VHlwZXMuaW5kZXhPZihDb21wb25lbnQpO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KENPTVBPTkVOVF9SRU1PVkUsIGVudGl0eSwgQ29tcG9uZW50KTtcblxuICAgIGlmIChmb3JjZVJlbW92ZSkge1xuICAgICAgdGhpcy5fZW50aXR5UmVtb3ZlQ29tcG9uZW50U3luYyhlbnRpdHksIENvbXBvbmVudCwgaW5kZXgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZW50aXR5LmNvbXBvbmVudHNUb1JlbW92ZS5sZW5ndGggPT09IDApXG4gICAgICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlLnB1c2goZW50aXR5KTtcbiAgICAgIGVudGl0eS5jb21wb25lbnRzVG9SZW1vdmUucHVzaChDb21wb25lbnQpO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGVhY2ggaW5kZXhlZCBxdWVyeSB0byBzZWUgaWYgd2UgbmVlZCB0byByZW1vdmUgaXRcbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIub25FbnRpdHlDb21wb25lbnRSZW1vdmVkKGVudGl0eSwgQ29tcG9uZW50KTtcbiAgfVxuXG4gIF9lbnRpdHlSZW1vdmVDb21wb25lbnRTeW5jKGVudGl0eSwgQ29tcG9uZW50LCBpbmRleCkge1xuICAgIC8vIFJlbW92ZSBUIGxpc3Rpbmcgb24gZW50aXR5IGFuZCBwcm9wZXJ0eSByZWYsIHRoZW4gZnJlZSB0aGUgY29tcG9uZW50LlxuICAgIGVudGl0eS5fQ29tcG9uZW50VHlwZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB2YXIgcHJvcE5hbWUgPSBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KTtcbiAgICB2YXIgY29tcG9uZW50TmFtZSA9IGdldE5hbWUoQ29tcG9uZW50KTtcbiAgICB2YXIgY29tcG9uZW50ID0gZW50aXR5Ll9jb21wb25lbnRzW2NvbXBvbmVudE5hbWVdO1xuICAgIGRlbGV0ZSBlbnRpdHkuX2NvbXBvbmVudHNbY29tcG9uZW50TmFtZV07XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5fY29tcG9uZW50UG9vbFtwcm9wTmFtZV0ucmVsZWFzZShjb21wb25lbnQpO1xuICAgIHRoaXMud29ybGQuY29tcG9uZW50c01hbmFnZXIuY29tcG9uZW50UmVtb3ZlZEZyb21FbnRpdHkoQ29tcG9uZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRoZSBjb21wb25lbnRzIGZyb20gYW4gZW50aXR5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgRW50aXR5IGZyb20gd2hpY2ggdGhlIGNvbXBvbmVudHMgd2lsbCBiZSByZW1vdmVkXG4gICAqL1xuICBlbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKGVudGl0eSwgZm9yY2VSZW1vdmUpIHtcbiAgICBsZXQgQ29tcG9uZW50cyA9IGVudGl0eS5fQ29tcG9uZW50VHlwZXM7XG5cbiAgICBmb3IgKGxldCBqID0gQ29tcG9uZW50cy5sZW5ndGggLSAxOyBqID49IDA7IGotLSkge1xuICAgICAgdGhpcy5lbnRpdHlSZW1vdmVDb21wb25lbnQoZW50aXR5LCBDb21wb25lbnRzW2pdLCBmb3JjZVJlbW92ZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0aGUgZW50aXR5IGZyb20gdGhpcyBtYW5hZ2VyLiBJdCB3aWxsIGNsZWFyIGFsc28gaXRzIGNvbXBvbmVudHMgYW5kIHRhZ3NcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdG8gcmVtb3ZlIGZyb20gdGhlIG1hbmFnZXJcbiAgICogQHBhcmFtIHtCb29sfSBmb3JjZVJlbW92ZSBJZiB5b3Ugd2FudCB0byByZW1vdmUgdGhlIGNvbXBvbmVudCBpbW1lZGlhdGVseSBpbnN0ZWFkIG9mIGRlZmVycmVkIChEZWZhdWx0IGlzIGZhbHNlKVxuICAgKi9cbiAgcmVtb3ZlRW50aXR5KGVudGl0eSwgZm9yY2VSZW1vdmUpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLl9lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG5cbiAgICBpZiAoIX5pbmRleCkgdGhyb3cgbmV3IEVycm9yKFwiVHJpZWQgdG8gcmVtb3ZlIGVudGl0eSBub3QgaW4gbGlzdFwiKTtcblxuICAgIC8vIFJlbW92ZSBmcm9tIGVudGl0eSBsaXN0XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChFTlRJVFlfUkVNT1ZFRCwgZW50aXR5KTtcbiAgICB0aGlzLl9xdWVyeU1hbmFnZXIub25FbnRpdHlSZW1vdmVkKGVudGl0eSk7XG5cbiAgICBpZiAoZm9yY2VSZW1vdmUgPT09IHRydWUpIHtcbiAgICAgIHRoaXMuX3JlbW92ZUVudGl0eVN5bmMoZW50aXR5LCBpbmRleCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZW50aXRpZXNUb1JlbW92ZS5wdXNoKGVudGl0eSk7XG4gICAgfVxuICB9XG5cbiAgX3JlbW92ZUVudGl0eVN5bmMoZW50aXR5LCBpbmRleCkge1xuICAgIHRoaXMuX2VudGl0aWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICB0aGlzLmVudGl0eVJlbW92ZUFsbENvbXBvbmVudHMoZW50aXR5LCB0cnVlKTtcblxuICAgIC8vIFJlbW92ZSBlbnRpdHkgZnJvbSBhbnkgdGFnIGdyb3VwcyBhbmQgY2xlYXIgdGhlIG9uLWVudGl0eSByZWZcbiAgICBlbnRpdHkuX3RhZ3MubGVuZ3RoID0gMDtcbiAgICBmb3IgKHZhciB0YWcgaW4gdGhpcy5fdGFncykge1xuICAgICAgdmFyIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddO1xuICAgICAgdmFyIG4gPSBlbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgICBpZiAofm4pIGVudGl0aWVzLnNwbGljZShuLCAxKTtcbiAgICB9XG5cbiAgICAvLyBQcmV2ZW50IGFueSBhY2Nlc3MgYW5kIGZyZWVcbiAgICBlbnRpdHkuX3dvcmxkID0gbnVsbDtcbiAgICB0aGlzLl9lbnRpdHlQb29sLnJlbGVhc2UoZW50aXR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIGVudGl0aWVzIGZyb20gdGhpcyBtYW5hZ2VyXG4gICAqL1xuICByZW1vdmVBbGxFbnRpdGllcygpIHtcbiAgICBmb3IgKHZhciBpID0gdGhpcy5fZW50aXRpZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHRoaXMuX2VudGl0aWVzW2ldLnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByb2Nlc3NEZWZlcnJlZFJlbW92YWwoKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmVudGl0aWVzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBlbnRpdHkgPSB0aGlzLmVudGl0aWVzVG9SZW1vdmVbaV07XG4gICAgICBsZXQgaW5kZXggPSB0aGlzLl9lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgICB0aGlzLl9yZW1vdmVFbnRpdHlTeW5jKGVudGl0eSwgaW5kZXgpO1xuICAgIH1cbiAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUubGVuZ3RoID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBlbnRpdHkgPSB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZVtpXTtcbiAgICAgIHdoaWxlIChlbnRpdHkuY29tcG9uZW50c1RvUmVtb3ZlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbGV0IENvbXBvbmVudCA9IGVudGl0eS5jb21wb25lbnRzVG9SZW1vdmUucG9wKCk7XG4gICAgICAgIGxldCBpbmRleCA9IGVudGl0eS5fQ29tcG9uZW50VHlwZXMuaW5kZXhPZihDb21wb25lbnQpO1xuICAgICAgICB0aGlzLl9lbnRpdHlSZW1vdmVDb21wb25lbnRTeW5jKGVudGl0eSwgQ29tcG9uZW50LCBpbmRleCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoID0gMDtcbiAgfVxuXG4gIC8vIFRBR1NcblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCB0aGUgZW50aXRpZXMgdGhhdCBoYXMgdGhlIHNwZWNpZmllZCB0YWdcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZyBUYWcgdG8gZmlsdGVyIHRoZSBlbnRpdGllcyB0byBiZSByZW1vdmVkXG4gICAqL1xuICByZW1vdmVFbnRpdGllc0J5VGFnKHRhZykge1xuICAgIHZhciBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXTtcblxuICAgIGlmICghZW50aXRpZXMpIHJldHVybjtcblxuICAgIGZvciAodmFyIHggPSBlbnRpdGllcy5sZW5ndGggLSAxOyB4ID49IDA7IHgtLSkge1xuICAgICAgdmFyIGVudGl0eSA9IGVudGl0aWVzW3hdO1xuICAgICAgZW50aXR5LnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgdGFnIHRvIGFuIGVudGl0eVxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IEVudGl0eSB3aGljaCB3aWxsIGdldCB0aGUgdGFnXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWcgVGFnIHRvIGFkZCB0byB0aGUgZW50aXR5XG4gICAqL1xuICBlbnRpdHlBZGRUYWcoZW50aXR5LCB0YWcpIHtcbiAgICB2YXIgZW50aXRpZXMgPSB0aGlzLl90YWdzW3RhZ107XG5cbiAgICBpZiAoIWVudGl0aWVzKSBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXSA9IFtdO1xuXG4gICAgLy8gRG9uJ3QgYWRkIGlmIGFscmVhZHkgdGhlcmVcbiAgICBpZiAofmVudGl0aWVzLmluZGV4T2YoZW50aXR5KSkgcmV0dXJuO1xuXG4gICAgLy8gQWRkIHRvIG91ciB0YWcgaW5kZXggQU5EIHRoZSBsaXN0IG9uIHRoZSBlbnRpdHlcbiAgICBlbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgZW50aXR5Ll90YWdzLnB1c2godGFnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSB0YWcgZnJvbSBhbiBlbnRpdHlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSBFbnRpdHkgdGhhdCB3aWxsIGdldCByZW1vdmVkIHRoZSB0YWdcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZyBUYWcgdG8gcmVtb3ZlXG4gICAqL1xuICBlbnRpdHlSZW1vdmVUYWcoZW50aXR5LCB0YWcpIHtcbiAgICB2YXIgZW50aXRpZXMgPSB0aGlzLl90YWdzW3RhZ107XG4gICAgaWYgKCFlbnRpdGllcykgcmV0dXJuO1xuXG4gICAgdmFyIGluZGV4ID0gZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBvdXIgaW5kZXggQU5EIHRoZSBsaXN0IG9uIHRoZSBlbnRpdHlcbiAgICBlbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIGVudGl0eS5fdGFncy5zcGxpY2UoZW50aXR5Ll90YWdzLmluZGV4T2YodGFnKSwgMSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgcXVlcnkgYmFzZWQgb24gYSBsaXN0IG9mIGNvbXBvbmVudHNcbiAgICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIExpc3Qgb2YgY29tcG9uZW50cyB0aGF0IHdpbGwgZm9ybSB0aGUgcXVlcnlcbiAgICovXG4gIHF1ZXJ5Q29tcG9uZW50cyhDb21wb25lbnRzKSB7XG4gICAgcmV0dXJuIHRoaXMuX3F1ZXJ5TWFuYWdlci5nZXRRdWVyeShDb21wb25lbnRzKTtcbiAgfVxuXG4gIC8vIEVYVFJBU1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gbnVtYmVyIG9mIGVudGl0aWVzXG4gICAqL1xuICBjb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZW50aXRpZXMubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzb21lIHN0YXRzXG4gICAqL1xuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBudW1FbnRpdGllczogdGhpcy5fZW50aXRpZXMubGVuZ3RoLFxuICAgICAgbnVtUXVlcmllczogT2JqZWN0LmtleXModGhpcy5fcXVlcnlNYW5hZ2VyLl9xdWVyaWVzKS5sZW5ndGgsXG4gICAgICBxdWVyaWVzOiB0aGlzLl9xdWVyeU1hbmFnZXIuc3RhdHMoKSxcbiAgICAgIG51bUNvbXBvbmVudFBvb2w6IE9iamVjdC5rZXlzKHRoaXMuY29tcG9uZW50c01hbmFnZXIuX2NvbXBvbmVudFBvb2wpXG4gICAgICAgIC5sZW5ndGgsXG4gICAgICBjb21wb25lbnRQb29sOiB7fSxcbiAgICAgIGV2ZW50RGlzcGF0Y2hlcjogdGhpcy5ldmVudERpc3BhdGNoZXIuc3RhdHNcbiAgICB9O1xuXG4gICAgZm9yICh2YXIgY25hbWUgaW4gdGhpcy5jb21wb25lbnRzTWFuYWdlci5fY29tcG9uZW50UG9vbCkge1xuICAgICAgdmFyIHBvb2wgPSB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLl9jb21wb25lbnRQb29sW2NuYW1lXTtcbiAgICAgIHN0YXRzLmNvbXBvbmVudFBvb2xbY25hbWVdID0ge1xuICAgICAgICB1c2VkOiBwb29sLnRvdGFsVXNlZCgpLFxuICAgICAgICBzaXplOiBwb29sLmNvdW50XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuXG5jb25zdCBFTlRJVFlfQ1JFQVRFRCA9IFwiRW50aXR5TWFuYWdlciNFTlRJVFlfQ1JFQVRFXCI7XG5jb25zdCBFTlRJVFlfUkVNT1ZFRCA9IFwiRW50aXR5TWFuYWdlciNFTlRJVFlfUkVNT1ZFRFwiO1xuY29uc3QgQ09NUE9ORU5UX0FEREVEID0gXCJFbnRpdHlNYW5hZ2VyI0NPTVBPTkVOVF9BRERFRFwiO1xuY29uc3QgQ09NUE9ORU5UX1JFTU9WRSA9IFwiRW50aXR5TWFuYWdlciNDT01QT05FTlRfUkVNT1ZFXCI7XG4iLCIvKipcbiAqIEBjbGFzcyBEdW1teU9iamVjdFBvb2xcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRHVtbXlPYmplY3RQb29sIHtcbiAgY29uc3RydWN0b3IoVCkge1xuICAgIHRoaXMuY291bnQgPSAwO1xuICAgIHRoaXMudXNlZCA9IDA7XG4gICAgdGhpcy5UID0gVDtcbiAgfVxuXG4gIGFxdWlyZSgpIHtcbiAgICB0aGlzLnVzZWQrKztcbiAgICB0aGlzLmNvdW50Kys7XG4gICAgcmV0dXJuIG5ldyB0aGlzLlQoKTtcbiAgfVxuXG4gIHJlbGVhc2UoKSB7XG4gICAgdGhpcy51c2VkLS07XG4gIH1cblxuICB0b3RhbFNpemUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY291bnQ7XG4gIH1cblxuICB0b3RhbEZyZWUoKSB7XG4gICAgcmV0dXJuIEluZmluaXR5O1xuICB9XG5cbiAgdG90YWxVc2VkKCkge1xuICAgIHJldHVybiB0aGlzLnVzZWQ7XG4gIH1cbn1cbiIsImV4cG9ydCBjbGFzcyBUYWdDb21wb25lbnQge31cbiIsImltcG9ydCBPYmplY3RQb29sIGZyb20gXCIuL09iamVjdFBvb2wuanNcIjtcbmltcG9ydCBEdW1teU9iamVjdFBvb2wgZnJvbSBcIi4vRHVtbXlPYmplY3RQb29sLmpzXCI7XG5pbXBvcnQgeyBjb21wb25lbnRQcm9wZXJ0eU5hbWUgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuaW1wb3J0IHsgVGFnQ29tcG9uZW50IH0gZnJvbSBcIi4vVGFnQ29tcG9uZW50LmpzXCI7XG5cbi8qKlxuICogQGNsYXNzIENvbXBvbmVudE1hbmFnZXJcbiAqL1xuZXhwb3J0IGNsYXNzIENvbXBvbmVudE1hbmFnZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLkNvbXBvbmVudHMgPSB7fTtcbiAgICB0aGlzLlNpbmdsZXRvbkNvbXBvbmVudHMgPSB7fTtcbiAgICB0aGlzLl9jb21wb25lbnRQb29sID0ge307XG4gICAgdGhpcy5udW1Db21wb25lbnRzID0ge307XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudCBDb21wb25lbnQgdG8gcmVnaXN0ZXJcbiAgICovXG4gIHJlZ2lzdGVyQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHRoaXMuQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBDb21wb25lbnQ7XG4gICAgdGhpcy5udW1Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IDA7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzaW5nbGV0b24gY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgQ29tcG9uZW50IHRvIHJlZ2lzdGVyIGFzIHNpbmdsZXRvblxuICAgKi9cbiAgcmVnaXN0ZXJTaW5nbGV0b25Db21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5TaW5nbGV0b25Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IENvbXBvbmVudDtcbiAgfVxuXG4gIGNvbXBvbmVudEFkZGVkVG9FbnRpdHkoQ29tcG9uZW50KSB7XG4gICAgaWYgKCF0aGlzLm51bUNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdKSB7XG4gICAgICB0aGlzLm51bUNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5udW1Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSsrO1xuICAgIH1cbiAgfVxuXG4gIGNvbXBvbmVudFJlbW92ZWRGcm9tRW50aXR5KENvbXBvbmVudCkge1xuICAgIHRoaXMubnVtQ29tcG9uZW50c1tDb21wb25lbnQubmFtZV0tLTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY29tcG9uZW50cyBwb29sXG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgVHlwZSBvZiBjb21wb25lbnQgdHlwZSBmb3IgdGhlIHBvb2xcbiAgICovXG4gIGdldENvbXBvbmVudHNQb29sKENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnROYW1lID0gY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCk7XG5cbiAgICBpZiAoIXRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0pIHtcbiAgICAgIGlmIChcbiAgICAgICAgQ29tcG9uZW50LnByb3RvdHlwZS5yZXNldCB8fFxuICAgICAgICBDb21wb25lbnQucHJvdG90eXBlIGluc3RhbmNlb2YgVGFnQ29tcG9uZW50XG4gICAgICApIHtcbiAgICAgICAgdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXSA9IG5ldyBPYmplY3RQb29sKENvbXBvbmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgYENvbXBvbmVudCAnJHtcbiAgICAgICAgICAgIENvbXBvbmVudC5uYW1lXG4gICAgICAgICAgfScgd29uJ3QgYmVuZWZpdCBmcm9tIHBvb2xpbmcgYmVjYXVzZSAncmVzZXQnIG1ldGhvZCB3YXMgbm90IGltcGxlbWVuZXRlZC5gXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV0gPSBuZXcgRHVtbXlPYmplY3RQb29sKENvbXBvbmVudCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV07XG4gIH1cbn1cbiIsImltcG9ydCB7IFN5c3RlbU1hbmFnZXIgfSBmcm9tIFwiLi9TeXN0ZW1NYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBFbnRpdHlNYW5hZ2VyIH0gZnJvbSBcIi4vRW50aXR5TWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgQ29tcG9uZW50TWFuYWdlciB9IGZyb20gXCIuL0NvbXBvbmVudE1hbmFnZXIuanNcIjtcbmltcG9ydCB7IGNvbXBvbmVudFByb3BlcnR5TmFtZSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5pbXBvcnQgRXZlbnREaXNwYXRjaGVyIGZyb20gXCIuL0V2ZW50RGlzcGF0Y2hlci5qc1wiO1xuXG4vKipcbiAqIEBjbGFzcyBXb3JsZFxuICovXG5leHBvcnQgY2xhc3MgV29ybGQge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyID0gbmV3IENvbXBvbmVudE1hbmFnZXIodGhpcyk7XG4gICAgdGhpcy5lbnRpdHlNYW5hZ2VyID0gbmV3IEVudGl0eU1hbmFnZXIodGhpcyk7XG4gICAgdGhpcy5zeXN0ZW1NYW5hZ2VyID0gbmV3IFN5c3RlbU1hbmFnZXIodGhpcyk7XG5cbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgLy8gU3RvcmFnZSBmb3Igc2luZ2xldG9uIGNvbXBvbmVudHNcbiAgICB0aGlzLmNvbXBvbmVudHMgPSB7fTtcblxuICAgIHRoaXMuZXZlbnRRdWV1ZXMgPSB7fTtcbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlciA9IG5ldyBFdmVudERpc3BhdGNoZXIoKTtcblxuICAgIGlmICh0eXBlb2YgQ3VzdG9tRXZlbnQgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHZhciBldmVudCA9IG5ldyBDdXN0b21FdmVudChcImVjc3ktd29ybGQtY3JlYXRlZFwiLCB7IGRldGFpbDogdGhpcyB9KTtcbiAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgICB9XG4gIH1cblxuICBlbWl0RXZlbnQoZXZlbnROYW1lLCBkYXRhKSB7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChldmVudE5hbWUsIGRhdGEpO1xuICB9XG5cbiAgYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzaW5nbGV0b24gY29tcG9uZW50XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBDb21wb25lbnQgU2luZ2xldG9uIGNvbXBvbmVudFxuICAgKi9cbiAgcmVnaXN0ZXJTaW5nbGV0b25Db21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5yZWdpc3RlclNpbmdsZXRvbkNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIHRoaXMuY29tcG9uZW50c1tjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KV0gPSBuZXcgQ29tcG9uZW50KCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBjb21wb25lbnRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IENvbXBvbmVudFxuICAgKi9cbiAgcmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5yZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgc3lzdGVtXG4gICAqIEBwYXJhbSB7U3lzdGVtfSBTeXN0ZW1cbiAgICovXG4gIHJlZ2lzdGVyU3lzdGVtKFN5c3RlbSwgYXR0cmlidXRlcykge1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlci5yZWdpc3RlclN5c3RlbShTeXN0ZW0sIGF0dHJpYnV0ZXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgc3lzdGVtcyBwZXIgZnJhbWVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbHRhIERlbHRhIHRpbWUgc2luY2UgdGhlIGxhc3QgY2FsbFxuICAgKiBAcGFyYW0ge051bWJlcn0gdGltZSBFbGFwc2VkIHRpbWVcbiAgICovXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUpIHtcbiAgICBpZiAodGhpcy5lbmFibGVkKSB7XG4gICAgICB0aGlzLnN5c3RlbU1hbmFnZXIuZXhlY3V0ZShkZWx0YSwgdGltZSk7XG4gICAgICB0aGlzLmVudGl0eU1hbmFnZXIucHJvY2Vzc0RlZmVycmVkUmVtb3ZhbCgpO1xuICAgIH1cbiAgfVxuXG4gIHN0b3AoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG4gIH1cblxuICBwbGF5KCkge1xuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGVudGl0eVxuICAgKi9cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLmVudGl0eU1hbmFnZXIuY3JlYXRlRW50aXR5KCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHNvbWUgc3RhdHNcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIGVudGl0aWVzOiB0aGlzLmVudGl0eU1hbmFnZXIuc3RhdHMoKSxcbiAgICAgIHN5c3RlbTogdGhpcy5zeXN0ZW1NYW5hZ2VyLnN0YXRzKClcbiAgICB9O1xuXG4gICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoc3RhdHMsIG51bGwsIDIpKTtcbiAgfVxufVxuIiwiLyoqXG4gKiBAY2xhc3MgU3lzdGVtXG4gKi9cbmltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgU3lzdGVtIHtcbiAgdG9KU09OKCkge1xuICAgIHZhciBqc29uID0ge1xuICAgICAgbmFtZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgZW5hYmxlZDogdGhpcy5lbmFibGVkLFxuICAgICAgZXhlY3V0ZVRpbWU6IHRoaXMuZXhlY3V0ZVRpbWUsXG4gICAgICBwcmlvcml0eTogdGhpcy5wcmlvcml0eSxcbiAgICAgIHF1ZXJpZXM6IHt9LFxuICAgICAgZXZlbnRzOiB7fVxuICAgIH07XG5cbiAgICBpZiAodGhpcy5jb25maWcpIHtcbiAgICAgIHZhciBxdWVyaWVzID0gdGhpcy5jb25maWcucXVlcmllcztcbiAgICAgIGZvciAobGV0IHF1ZXJ5TmFtZSBpbiBxdWVyaWVzKSB7XG4gICAgICAgIGxldCBxdWVyeSA9IHF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAganNvbi5xdWVyaWVzW3F1ZXJ5TmFtZV0gPSB7XG4gICAgICAgICAga2V5OiB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV0ua2V5XG4gICAgICAgIH07XG4gICAgICAgIGlmIChxdWVyeS5ldmVudHMpIHtcbiAgICAgICAgICBsZXQgZXZlbnRzID0gKGpzb24ucXVlcmllc1txdWVyeU5hbWVdW1wiZXZlbnRzXCJdID0ge30pO1xuICAgICAgICAgIGZvciAobGV0IGV2ZW50TmFtZSBpbiBxdWVyeS5ldmVudHMpIHtcbiAgICAgICAgICAgIGxldCBldmVudCA9IHF1ZXJ5LmV2ZW50c1tldmVudE5hbWVdO1xuICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0gPSB7XG4gICAgICAgICAgICAgIGV2ZW50TmFtZTogZXZlbnQuZXZlbnQsXG4gICAgICAgICAgICAgIG51bUVudGl0aWVzOiB0aGlzLmV2ZW50c1txdWVyeU5hbWVdW2V2ZW50TmFtZV0ubGVuZ3RoXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGV2ZW50LmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0uY29tcG9uZW50cyA9IGV2ZW50LmNvbXBvbmVudHMubWFwKGMgPT4gYy5uYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbGV0IGV2ZW50cyA9IHRoaXMuY29uZmlnLmV2ZW50cztcbiAgICAgIGZvciAobGV0IGV2ZW50TmFtZSBpbiBldmVudHMpIHtcbiAgICAgICAganNvbi5ldmVudHNbZXZlbnROYW1lXSA9IHtcbiAgICAgICAgICBldmVudE5hbWU6IGV2ZW50c1tldmVudE5hbWVdXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGpzb247XG4gIH1cblxuICBjb25zdHJ1Y3Rvcih3b3JsZCwgYXR0cmlidXRlcykge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgLy8gQHRvZG8gQmV0dGVyIG5hbWluZyA6KVxuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgICB0aGlzLnF1ZXJpZXMgPSB7fTtcblxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHRoaXMuZXZlbnRzID0ge307XG5cbiAgICB0aGlzLnByaW9yaXR5ID0gMDtcblxuICAgIC8vIFVzZWQgZm9yIHN0YXRzXG4gICAgdGhpcy5leGVjdXRlVGltZSA9IDA7XG5cbiAgICBpZiAoYXR0cmlidXRlcyAmJiBhdHRyaWJ1dGVzLnByaW9yaXR5KSB7XG4gICAgICB0aGlzLnByaW9yaXR5ID0gYXR0cmlidXRlcy5wcmlvcml0eTtcbiAgICB9XG5cbiAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcblxuICAgIHRoaXMuY29uZmlnID0gdGhpcy5pbml0ID8gdGhpcy5pbml0KCkgOiBudWxsO1xuXG4gICAgaWYgKCF0aGlzLmNvbmZpZykgcmV0dXJuO1xuICAgIGlmICh0aGlzLmNvbmZpZy5xdWVyaWVzKSB7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuY29uZmlnLnF1ZXJpZXMpIHtcbiAgICAgICAgdmFyIHF1ZXJ5Q29uZmlnID0gdGhpcy5jb25maWcucXVlcmllc1tuYW1lXTtcbiAgICAgICAgdmFyIENvbXBvbmVudHMgPSBxdWVyeUNvbmZpZy5jb21wb25lbnRzO1xuICAgICAgICBpZiAoIUNvbXBvbmVudHMgfHwgQ29tcG9uZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCInY29tcG9uZW50cycgYXR0cmlidXRlIGNhbid0IGJlIGVtcHR5IGluIGEgcXVlcnlcIik7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy53b3JsZC5lbnRpdHlNYW5hZ2VyLnF1ZXJ5Q29tcG9uZW50cyhDb21wb25lbnRzKTtcbiAgICAgICAgdGhpcy5fcXVlcmllc1tuYW1lXSA9IHF1ZXJ5O1xuICAgICAgICB0aGlzLnF1ZXJpZXNbbmFtZV0gPSBxdWVyeS5lbnRpdGllcztcblxuICAgICAgICBpZiAocXVlcnlDb25maWcuZXZlbnRzKSB7XG4gICAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0gPSB7fTtcbiAgICAgICAgICBsZXQgZXZlbnRzID0gdGhpcy5ldmVudHNbbmFtZV07XG4gICAgICAgICAgZm9yIChsZXQgZXZlbnROYW1lIGluIHF1ZXJ5Q29uZmlnLmV2ZW50cykge1xuICAgICAgICAgICAgbGV0IGV2ZW50ID0gcXVlcnlDb25maWcuZXZlbnRzW2V2ZW50TmFtZV07XG4gICAgICAgICAgICBldmVudHNbZXZlbnROYW1lXSA9IFtdO1xuXG4gICAgICAgICAgICBjb25zdCBldmVudE1hcHBpbmcgPSB7XG4gICAgICAgICAgICAgIEVudGl0eUFkZGVkOiBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVELFxuICAgICAgICAgICAgICBFbnRpdHlSZW1vdmVkOiBRdWVyeS5wcm90b3R5cGUuRU5USVRZX1JFTU9WRUQsXG4gICAgICAgICAgICAgIEVudGl0eUNoYW5nZWQ6IFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCAvLyBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0NIQU5HRURcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChldmVudE1hcHBpbmdbZXZlbnQuZXZlbnRdKSB7XG4gICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgIGV2ZW50TWFwcGluZ1tldmVudC5ldmVudF0sXG4gICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgIC8vIEBmaXhtZSBBIGxvdCBvZiBvdmVyaGVhZD9cbiAgICAgICAgICAgICAgICAgIGlmIChldmVudHNbZXZlbnROYW1lXS5pbmRleE9mKGVudGl0eSkgPT09IC0xKVxuICAgICAgICAgICAgICAgICAgICBldmVudHNbZXZlbnROYW1lXS5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBpZiAoZXZlbnQuZXZlbnQgPT09IFwiRW50aXR5Q2hhbmdlZFwiKSB7XG4gICAgICAgICAgICAgICAgcXVlcnkucmVhY3RpdmUgPSB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmV2ZW50ID09PSBcIkNvbXBvbmVudENoYW5nZWRcIikge1xuICAgICAgICAgICAgICBxdWVyeS5yZWFjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAoZW50aXR5LCBjb21wb25lbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChldmVudC5jb21wb25lbnRzLmluZGV4T2YoY29tcG9uZW50LmNvbnN0cnVjdG9yKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzW2V2ZW50TmFtZV0ucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5jb25maWcuZXZlbnRzKSB7XG4gICAgICBmb3IgKGxldCBuYW1lIGluIHRoaXMuY29uZmlnLmV2ZW50cykge1xuICAgICAgICB2YXIgZXZlbnQgPSB0aGlzLmNvbmZpZy5ldmVudHNbbmFtZV07XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0gW107XG4gICAgICAgIHRoaXMud29ybGQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgZGF0YSA9PiB7XG4gICAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0ucHVzaChkYXRhKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHBsYXkoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgfVxuXG4gIGNsZWFyRXZlbnRzKCkge1xuICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5ldmVudHMpIHtcbiAgICAgIHZhciBldmVudCA9IHRoaXMuZXZlbnRzW25hbWVdO1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMuZXZlbnRzW25hbWVdLmxlbmd0aCA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKG5hbWUgaW4gZXZlbnQpIHtcbiAgICAgICAgICBldmVudFtuYW1lXS5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBOb3QoQ29tcG9uZW50KSB7XG4gIHJldHVybiB7XG4gICAgb3BlcmF0b3I6IFwibm90XCIsXG4gICAgQ29tcG9uZW50OiBDb21wb25lbnRcbiAgfTtcbn1cbiIsImNsYXNzIEZsb2F0VmFsaWRhdG9yIHtcbiAgc3RhdGljIHZhbGlkYXRlKG4pIHtcbiAgICByZXR1cm4gTnVtYmVyKG4pID09PSBuICYmIG4gJSAxICE9PSAwO1xuICB9XG59XG5cbnZhciBTY2hlbWFUeXBlcyA9IHtcbiAgZmxvYXQ6IEZsb2F0VmFsaWRhdG9yXG4gIC8qXG4gIGFycmF5XG4gIGJvb2xcbiAgZnVuY1xuICBudW1iZXJcbiAgb2JqZWN0XG4gIHN0cmluZ1xuICBzeW1ib2xcblxuICBhbnlcbiAgYXJyYXlPZlxuICBlbGVtZW50XG4gIGVsZW1lbnRUeXBlXG4gIGluc3RhbmNlT2ZcbiAgbm9kZVxuICBvYmplY3RPZlxuICBvbmVPZlxuICBvbmVPZlR5cGVcbiAgc2hhcGVcbiAgZXhhY3RcbiovXG59O1xuXG5leHBvcnQgeyBTY2hlbWFUeXBlcyB9O1xuIiwiZXhwb3J0IGNsYXNzIENvbXBvbmVudCB7fVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0NBQUE7Q0FDQTtDQUNBO0FBQ0EsQ0FBTyxNQUFNLGFBQWEsQ0FBQztDQUMzQixFQUFFLFdBQVcsQ0FBQyxLQUFLLEVBQUU7Q0FDckIsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztDQUN0QixJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0NBQ3ZCLEdBQUc7O0NBRUg7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFO0NBQ3JDLElBQUksSUFBSSxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztDQUNwRCxJQUFJLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7Q0FDdkMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUM5QixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztDQUN2QixJQUFJLE9BQU8sSUFBSSxDQUFDO0NBQ2hCLEdBQUc7O0NBRUgsRUFBRSxXQUFXLEdBQUc7Q0FDaEIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUs7Q0FDaEMsTUFBTSxPQUFPLENBQUMsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7Q0FDMUQsS0FBSyxDQUFDLENBQUM7Q0FDUCxHQUFHOztDQUVIO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxZQUFZLENBQUMsTUFBTSxFQUFFO0NBQ3ZCLElBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFP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
