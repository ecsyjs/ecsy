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

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation. All rights reserved.
	Licensed under the Apache License, Version 2.0 (the "License"); you may not use
	this file except in compliance with the License. You may obtain a copy of the
	License at http://www.apache.org/licenses/LICENSE-2.0

	THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
	KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
	WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
	MERCHANTABLITY OR NON-INFRINGEMENT.

	See the Apache Version 2.0 License for specific language governing permissions
	and limitations under the License.
	***************************************************************************** */

	function __values(o) {
	    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
	    if (m) return m.call(o);
	    return {
	        next: function () {
	            if (o && i >= o.length) o = void 0;
	            return { value: o && o[i++], done: !o };
	        }
	    };
	}

	function __read(o, n) {
	    var m = typeof Symbol === "function" && o[Symbol.iterator];
	    if (!m) return o;
	    var i = m.call(o), r, ar = [], e;
	    try {
	        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
	    }
	    catch (error) { e = { error: error }; }
	    finally {
	        try {
	            if (r && !r.done && (m = i["return"])) m.call(i);
	        }
	        finally { if (e) throw e.error; }
	    }
	    return ar;
	}

	function __spread() {
	    for (var ar = [], i = 0; i < arguments.length; i++)
	        ar = ar.concat(__read(arguments[i]));
	    return ar;
	}

	var ObjectPool = /** @class */ (function () {
	    // @todo Add initial size
	    function ObjectPool(Class, initialSize) {
	        this.freeList = [];
	        this.count = 0;
	        this.isObjectPool = true;
	        var extraArgs = null;
	        if (arguments.length > 1) {
	            extraArgs = Array.prototype.slice.call(arguments);
	            extraArgs.shift();
	        }
	        this.createElement = extraArgs
	            ? function () {
	                return new (Class.bind.apply(Class, __spread([void 0], extraArgs)))();
	            }
	            : function () {
	                return new Class();
	            };
	        if (typeof initialSize !== 'undefined') {
	            this.expand(initialSize);
	        }
	    }
	    ObjectPool.prototype.aquire = function () {
	        // Grow the list by 20%ish if we're out
	        if (this.freeList.length <= 0) {
	            this.expand(Math.round(this.count * 0.2) + 1);
	        }
	        var item = this.freeList.pop();
	        return item;
	    };
	    ObjectPool.prototype.release = function (item) {
	        if (item.reset) {
	            item.reset(); // !!!!!!!!!!!!!!
	        }
	        this.freeList.push(item);
	    };
	    ObjectPool.prototype.expand = function (count) {
	        for (var n = 0; n < count; n++) {
	            this.freeList.push(this.createElement());
	        }
	        this.count += count;
	    };
	    ObjectPool.prototype.totalSize = function () {
	        return this.count;
	    };
	    ObjectPool.prototype.totalFree = function () {
	        return this.freeList.length;
	    };
	    ObjectPool.prototype.totalUsed = function () {
	        return this.count - this.freeList.length;
	    };
	    return ObjectPool;
	}());

	/**
	 * Return the name of a component
	 */
	function getName(componentConstructor) {
	    return componentConstructor.name;
	}

	/**
	 * Return a valid property name for the Component
	 */
	function componentPropertyName(componentConstructor) {
	    var name = getName(componentConstructor);
	    return name.charAt(0).toLowerCase() + name.slice(1);
	}

	/**
	 * Get a key from a list of components
	 * @param Components Array of components to generate the key
	 */
	function queryKey(componentConstructor) {
	    var e_1, _a;
	    var names = [];
	    try {
	        for (var componentConstructor_1 = __values(componentConstructor), componentConstructor_1_1 = componentConstructor_1.next(); !componentConstructor_1_1.done; componentConstructor_1_1 = componentConstructor_1.next()) {
	            var T = componentConstructor_1_1.value;
	            if (typeof T === 'object') {
	                var operator = T.operator === 'not' ? '!' : T.operator;
	                names.push(operator + getName(T.Component));
	            }
	            else {
	                names.push(getName(T));
	            }
	        }
	    }
	    catch (e_1_1) { e_1 = { error: e_1_1 }; }
	    finally {
	        try {
	            if (componentConstructor_1_1 && !componentConstructor_1_1.done && (_a = componentConstructor_1.return)) _a.call(componentConstructor_1);
	        }
	        finally { if (e_1) throw e_1.error; }
	    }
	    return names.sort().join('-');
	}

	var DummyObjectPool = /** @class */ (function () {
	    function DummyObjectPool(T) {
	        this.T = T;
	        this.isDummyObjectPool = true;
	        this.count = 0;
	        this.used = 0;
	    }
	    DummyObjectPool.prototype.aquire = function () {
	        this.used++;
	        this.count++;
	        return new this.T();
	    };
	    DummyObjectPool.prototype.release = function () {
	        this.used--;
	    };
	    DummyObjectPool.prototype.totalSize = function () {
	        return this.count;
	    };
	    DummyObjectPool.prototype.totalFree = function () {
	        return Infinity;
	    };
	    DummyObjectPool.prototype.totalUsed = function () {
	        return this.used;
	    };
	    return DummyObjectPool;
	}());

	var ComponentManager = /** @class */ (function () {
	    function ComponentManager() {
	        this.Components = {};
	        this.componentPool = {};
	        this.numComponents = {};
	    }
	    ComponentManager.prototype.registerComponent = function (componentConstructor) {
	        if (this.Components[componentConstructor.name]) {
	            console.warn("Component type: '" + componentConstructor.name + "' already registered.");
	            return;
	        }
	        this.Components[componentConstructor.name] = componentConstructor;
	        this.numComponents[componentConstructor.name] = 0;
	    };
	    ComponentManager.prototype.componentAddedToEntity = function (componentConstructor) {
	        if (!this.Components[componentConstructor.name]) {
	            this.registerComponent(componentConstructor);
	        }
	        this.numComponents[componentConstructor.name]++;
	    };
	    ComponentManager.prototype.componentRemovedFromEntity = function (componentConstructor) {
	        this.numComponents[componentConstructor.name]--;
	    };
	    ComponentManager.prototype.getComponentsPool = function (componentConstructor) {
	        var componentName = componentPropertyName(componentConstructor);
	        if (!this.componentPool[componentName]) {
	            if (componentConstructor.prototype.reset) {
	                this.componentPool[componentName] = new ObjectPool(componentConstructor);
	            }
	            else {
	                console.warn("Component '" + componentConstructor.name + "' won't benefit from pooling because 'reset' method was not implemeneted.");
	                this.componentPool[componentName] = new DummyObjectPool(componentConstructor);
	            }
	        }
	        return this.componentPool[componentName];
	    };
	    return ComponentManager;
	}());

	/**
	 * EventDispatcher
	 */
	var EventDispatcher = /** @class */ (function () {
	    function EventDispatcher() {
	        this.listeners = {};
	        this.stats = {
	            fired: 0,
	            handled: 0
	        };
	    }
	    /**
	     * Add an event listener
	     * @param eventName Name of the event to listen
	     * @param listener Callback to trigger when the event is fired
	     */
	    EventDispatcher.prototype.addEventListener = function (eventName, listener) {
	        var listeners = this.listeners;
	        if (listeners[eventName] === undefined) {
	            listeners[eventName] = [];
	        }
	        if (listeners[eventName].indexOf(listener) === -1) {
	            listeners[eventName].push(listener);
	        }
	    };
	    /**
	     * Check if an event listener is already added to the list of listeners
	     * @param eventName Name of the event to check
	     * @param listener Callback for the specified event
	     */
	    EventDispatcher.prototype.hasEventListener = function (eventName, listener) {
	        return (this.listeners[eventName] !== undefined &&
	            this.listeners[eventName].indexOf(listener) !== -1);
	    };
	    /**
	     * Remove an event listener
	     * @param eventName Name of the event to remove
	     * @param listener Callback for the specified event
	     */
	    EventDispatcher.prototype.removeEventListener = function (eventName, listener) {
	        var listenerArray = this.listeners[eventName];
	        if (listenerArray !== undefined) {
	            var index = listenerArray.indexOf(listener);
	            if (index !== -1) {
	                listenerArray.splice(index, 1);
	            }
	        }
	    };
	    /**
	     * Dispatch an event
	     * @param eventName Name of the event to dispatch
	     * @param entity (Optional) Entity to emit
	     */
	    EventDispatcher.prototype.dispatchEvent = function (eventName, entity, component) {
	        var e_1, _a;
	        this.stats.fired++;
	        var listenerArray = this.listeners[eventName];
	        if (listenerArray !== undefined) {
	            var array = listenerArray.slice(0);
	            try {
	                for (var array_1 = __values(array), array_1_1 = array_1.next(); !array_1_1.done; array_1_1 = array_1.next()) {
	                    var value = array_1_1.value;
	                    value.call(this, entity, component);
	                }
	            }
	            catch (e_1_1) { e_1 = { error: e_1_1 }; }
	            finally {
	                try {
	                    if (array_1_1 && !array_1_1.done && (_a = array_1.return)) _a.call(array_1);
	                }
	                finally { if (e_1) throw e_1.error; }
	            }
	        }
	    };
	    /**
	     * Reset stats counters
	     */
	    EventDispatcher.prototype.resetCounters = function () {
	        this.stats.fired = this.stats.handled = 0;
	    };
	    return EventDispatcher;
	}());

	// tslint:disable:no-bitwise
	var Query = /** @class */ (function () {
	    /**
	     * @param componentConstructors List of types of components to query
	     */
	    function Query(componentConstructors, manager) {
	        var e_1, _a;
	        var _this = this;
	        this.ENTITY_ADDED = 'Query#ENTITY_ADDED';
	        this.ENTITY_REMOVED = 'Query#ENTITY_REMOVED';
	        this.COMPONENT_CHANGED = 'Query#COMPONENT_CHANGED';
	        this.Components = [];
	        this.NotComponents = [];
	        this.entities = [];
	        this.eventDispatcher = new EventDispatcher();
	        // This query is being used by a reactive system
	        this.reactive = false;
	        componentConstructors.forEach(function (componentConstructor) {
	            if (typeof componentConstructor === 'object') {
	                _this.NotComponents.push(componentConstructor.component);
	            }
	            else {
	                _this.Components.push(componentConstructor);
	            }
	        });
	        if (this.Components.length === 0) {
	            throw new Error('Can\'t create a query without components');
	        }
	        this.key = queryKey(componentConstructors);
	        try {
	            // Fill the query with the existing entities
	            for (var _b = __values(manager.entities), _c = _b.next(); !_c.done; _c = _b.next()) {
	                var entity = _c.value;
	                if (this.match(entity)) {
	                    // @todo ??? this.addEntity(entity); => preventing the event to be generated
	                    entity.queries.push(this);
	                    this.entities.push(entity);
	                }
	            }
	        }
	        catch (e_1_1) { e_1 = { error: e_1_1 }; }
	        finally {
	            try {
	                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
	            }
	            finally { if (e_1) throw e_1.error; }
	        }
	    }
	    /**
	     * Add entity to this query
	     */
	    Query.prototype.addEntity = function (entity) {
	        entity.queries.push(this);
	        this.entities.push(entity);
	        this.eventDispatcher.dispatchEvent(Query.prototype.ENTITY_ADDED, entity);
	    };
	    /**
	     * Remove entity from this query
	     */
	    Query.prototype.removeEntity = function (entity) {
	        var index = this.entities.indexOf(entity);
	        if (~index) {
	            this.entities.splice(index, 1);
	            index = entity.queries.indexOf(this);
	            entity.queries.splice(index, 1);
	            this.eventDispatcher.dispatchEvent(Query.prototype.ENTITY_REMOVED, entity);
	        }
	    };
	    Query.prototype.match = function (entity) {
	        return (entity.hasAllComponents(this.Components) &&
	            !entity.hasAnyComponents(this.NotComponents));
	    };
	    Query.prototype.toJSON = function () {
	        return {
	            key: this.key,
	            reactive: this.reactive,
	            components: {
	                included: this.Components.map(function (C) { return C.name; }),
	                not: this.NotComponents.map(function (C) { return C.name; })
	            },
	            numEntities: this.entities.length
	        };
	    };
	    /**
	     * Return stats for this query
	     */
	    Query.prototype.stats = function () {
	        return {
	            numComponents: this.Components.length,
	            numEntities: this.entities.length
	        };
	    };
	    return Query;
	}());

	var nextId = 0;
	var Entity = /** @class */ (function () {
	    function Entity(entityManager) {
	        this.entityManager = entityManager;
	        // Unique ID for this entity
	        this.id = nextId++;
	        // List of components types the entity has
	        this.ComponentTypes = [];
	        // Instance of the components
	        this.components = {};
	        this.componentsToRemove = {};
	        // Queries where the entity is added
	        this.queries = [];
	        // Used for deferred removal
	        this.ComponentTypesToRemove = [];
	        this.alive = false;
	    }
	    // COMPONENTS
	    Entity.prototype.getComponent = function (componentConstructor, includeRemoved) {
	        var component = this.components[componentConstructor.name];
	        if (!component && includeRemoved === true) {
	            component = this.componentsToRemove[componentConstructor.name];
	        }
	        return  component;
	    };
	    Entity.prototype.getRemovedComponent = function (componentConstructor) {
	        return this.componentsToRemove[componentConstructor.name];
	    };
	    Entity.prototype.getComponents = function () {
	        return this.components;
	    };
	    Entity.prototype.getComponentsToRemove = function () {
	        return this.componentsToRemove;
	    };
	    Entity.prototype.getComponentTypes = function () {
	        return this.ComponentTypes;
	    };
	    Entity.prototype.getMutableComponent = function (componentConstructor) {
	        var e_1, _a;
	        var component = this.components[componentConstructor.name];
	        try {
	            for (var _b = __values(this.queries), _c = _b.next(); !_c.done; _c = _b.next()) {
	                var query = _c.value;
	                // @todo accelerate this check. Maybe having query._Components as an object
	                if (query.reactive && query.Components.indexOf(componentConstructor) !== -1) {
	                    query.eventDispatcher.dispatchEvent(Query.prototype.COMPONENT_CHANGED, this, component);
	                }
	            }
	        }
	        catch (e_1_1) { e_1 = { error: e_1_1 }; }
	        finally {
	            try {
	                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
	            }
	            finally { if (e_1) throw e_1.error; }
	        }
	        return component;
	    };
	    Entity.prototype.addComponent = function (componentConstructor, values) {
	        this.entityManager.entityAddComponent(this, componentConstructor, values);
	        return this;
	    };
	    Entity.prototype.removeComponent = function (componentConstructor, forceRemove) {
	        this.entityManager.entityRemoveComponent(this, componentConstructor, forceRemove);
	        return this;
	    };
	    Entity.prototype.hasComponent = function (componentConstructor, includeRemoved) {
	        return (!!~this.ComponentTypes.indexOf(componentConstructor) ||
	            (includeRemoved === true && this.hasRemovedComponent(componentConstructor)));
	    };
	    Entity.prototype.hasRemovedComponent = function (componentConstructor) {
	        return !!~this.ComponentTypesToRemove.indexOf(componentConstructor);
	    };
	    Entity.prototype.hasAllComponents = function (componentConstructors) {
	        var e_2, _a;
	        try {
	            for (var componentConstructors_1 = __values(componentConstructors), componentConstructors_1_1 = componentConstructors_1.next(); !componentConstructors_1_1.done; componentConstructors_1_1 = componentConstructors_1.next()) {
	                var component = componentConstructors_1_1.value;
	                if (!this.hasComponent(component)) {
	                    return false;
	                }
	            }
	        }
	        catch (e_2_1) { e_2 = { error: e_2_1 }; }
	        finally {
	            try {
	                if (componentConstructors_1_1 && !componentConstructors_1_1.done && (_a = componentConstructors_1.return)) _a.call(componentConstructors_1);
	            }
	            finally { if (e_2) throw e_2.error; }
	        }
	        return true;
	    };
	    Entity.prototype.hasAnyComponents = function (componentConstructors) {
	        var e_3, _a;
	        try {
	            for (var componentConstructors_2 = __values(componentConstructors), componentConstructors_2_1 = componentConstructors_2.next(); !componentConstructors_2_1.done; componentConstructors_2_1 = componentConstructors_2.next()) {
	                var component = componentConstructors_2_1.value;
	                if (this.hasComponent(component)) {
	                    return true;
	                }
	            }
	        }
	        catch (e_3_1) { e_3 = { error: e_3_1 }; }
	        finally {
	            try {
	                if (componentConstructors_2_1 && !componentConstructors_2_1.done && (_a = componentConstructors_2.return)) _a.call(componentConstructors_2);
	            }
	            finally { if (e_3) throw e_3.error; }
	        }
	        return false;
	    };
	    Entity.prototype.removeAllComponents = function (forceRemove) {
	        return this.entityManager.entityRemoveAllComponents(this, forceRemove);
	    };
	    // EXTRAS
	    // Initialize the entity. To be used when returning an entity to the pool
	    Entity.prototype.reset = function () {
	        this.id = nextId++;
	        this.entityManager = null;
	        this.ComponentTypes.length = 0;
	        this.queries.length = 0;
	        this.components = {};
	    };
	    Entity.prototype.remove = function (forceRemove) {
	        return this.entityManager.removeEntity(this, forceRemove);
	    };
	    return Entity;
	}());

	// tslint:disable:no-bitwise
	/**
	 * QueryManager
	 */
	var QueryManager = /** @class */ (function () {
	    function QueryManager(entityManager) {
	        this.entityManager = entityManager;
	        // Queries indexed by a unique identifier for the components it has
	        this.queries = {};
	    }
	    QueryManager.prototype.onEntityRemoved = function (entity) {
	        for (var queryName in this.queries) {
	            if (this.queries.hasOwnProperty(queryName)) {
	                var query = this.queries[queryName];
	                if (entity.queries.indexOf(query) !== -1) {
	                    query.removeEntity(entity);
	                }
	            }
	        }
	    };
	    /**
	     * Callback when a component is added to an entity
	     * @param entity Entity that just got the new component
	     * @param componentConstructor Component added to the entity
	     */
	    QueryManager.prototype.onEntityComponentAdded = function (entity, componentConstructor) {
	        // @todo Use bitmask for checking components?
	        // Check each indexed query to see if we need to add this entity to the list
	        for (var queryName in this.queries) {
	            if (this.queries.hasOwnProperty(queryName)) {
	                var query = this.queries[queryName];
	                if (!!~query.NotComponents.indexOf(componentConstructor) &&
	                    ~query.entities.indexOf(entity)) {
	                    query.removeEntity(entity);
	                    continue;
	                }
	                // Add the entity only if:
	                // Component is in the query
	                // and Entity has ALL the components of the query
	                // and Entity is not already in the query
	                if (!~query.Components.indexOf(componentConstructor) ||
	                    !query.match(entity) ||
	                    ~query.entities.indexOf(entity)) {
	                    continue;
	                }
	                query.addEntity(entity);
	            }
	        }
	    };
	    /**
	     * Callback when a component is removed from an entity
	     * @param entity Entity to remove the component from
	     * @param componentConstructor Component to remove from the entity
	     */
	    QueryManager.prototype.onEntityComponentRemoved = function (entity, componentConstructor) {
	        for (var queryName in this.queries) {
	            if (this.queries.hasOwnProperty(queryName)) {
	                var query = this.queries[queryName];
	                if (!!~query.NotComponents.indexOf(componentConstructor) &&
	                    !~query.entities.indexOf(entity) &&
	                    query.match(entity)) {
	                    query.addEntity(entity);
	                    continue;
	                }
	                if (!!~query.Components.indexOf(componentConstructor) &&
	                    !!~query.entities.indexOf(entity) &&
	                    !query.match(entity)) {
	                    query.removeEntity(entity);
	                    continue;
	                }
	            }
	        }
	    };
	    /**
	     * Get a query for the specified components
	     * @param componentConstructors Components that the query should have
	     */
	    QueryManager.prototype.getQuery = function (componentConstructors) {
	        var key = queryKey(componentConstructors);
	        var query = this.queries[key];
	        if (!query) {
	            this.queries[key] = query = new Query(componentConstructors, this.entityManager);
	        }
	        return query;
	    };
	    /**
	     * Return some stats from this class
	     */
	    QueryManager.prototype.stats = function () {
	        var stats = {};
	        for (var queryName in this.queries) {
	            if (this.queries.hasOwnProperty(queryName)) {
	                stats[queryName] = this.queries[queryName].stats();
	            }
	        }
	        return stats;
	    };
	    return QueryManager;
	}());

	/**
	 * Components that extend the SystemStateComponent are not removed when an entity is deleted.
	 */
	var SystemStateComponent = /** @class */ (function () {
	    function SystemStateComponent() {
	    }
	    SystemStateComponent.isSystemStateComponent = true;
	    return SystemStateComponent;
	}());

	// tslint:disable:no-bitwise
	/**
	 * EntityManager
	 */
	var EntityManager = /** @class */ (function () {
	    function EntityManager(componentManager) {
	        this.componentManager = componentManager;
	        // All the entities in this instance
	        this.entities = [];
	        this.queryManager = new QueryManager(this);
	        this.eventDispatcher = new EventDispatcher();
	        this.entityPool = new ObjectPool(Entity);
	        // Deferred deletion
	        this.entitiesWithComponentsToRemove = [];
	        this.entitiesToRemove = [];
	        this.deferredRemovalEnabled = true;
	        this.numStateComponents = 0;
	    }
	    /**
	     * Create a new entity
	     */
	    EntityManager.prototype.createEntity = function () {
	        var entity = this.entityPool.aquire();
	        entity.alive = true;
	        entity.entityManager = this;
	        this.entities.push(entity);
	        this.eventDispatcher.dispatchEvent(ENTITY_CREATED, entity);
	        return entity;
	    };
	    // COMPONENTS
	    /**
	     * Add a component to an entity
	     * @param entity Entity where the component will be added
	     * @param componentConstructor Component to be added to the entity
	     * @param values Optional values to replace the default attributes
	     */
	    EntityManager.prototype.entityAddComponent = function (entity, componentConstructor, values) {
	        if (~entity.ComponentTypes.indexOf(componentConstructor)) {
	            return;
	        }
	        entity.ComponentTypes.push(componentConstructor);
	        if (componentConstructor.__proto__ === SystemStateComponent) {
	            this.numStateComponents++;
	        }
	        var componentPool = this.componentManager.getComponentsPool(componentConstructor);
	        var componentFromPool = componentPool.aquire();
	        entity.components[componentConstructor.name] = componentFromPool;
	        if (values) {
	            if (componentFromPool.copy) {
	                componentFromPool.copy(values);
	            }
	            else {
	                for (var name in values) {
	                    if (values.hasOwnProperty(name)) {
	                        componentFromPool[name] = values[name];
	                    }
	                }
	            }
	        }
	        this.queryManager.onEntityComponentAdded(entity, componentConstructor);
	        this.componentManager.componentAddedToEntity(componentConstructor);
	        this.eventDispatcher.dispatchEvent(COMPONENT_ADDED, entity, componentConstructor);
	    };
	    /**
	     * Remove a component from an entity
	     * @param entity Entity which will get removed the component
	     * @param componentConstructor Component to remove from the entity
	     * @param immediately If you want to remove the component immediately instead of deferred (Default is false)
	     */
	    EntityManager.prototype.entityRemoveComponent = function (entity, componentConstructor, immediately) {
	        var index = entity.ComponentTypes.indexOf(componentConstructor);
	        if (!~index) {
	            return;
	        }
	        this.eventDispatcher.dispatchEvent(COMPONENT_REMOVE, entity, componentConstructor);
	        if (immediately) {
	            this._entityRemoveComponentSync(entity, componentConstructor, index);
	        }
	        else {
	            if (entity.ComponentTypesToRemove.length === 0) {
	                this.entitiesWithComponentsToRemove.push(entity);
	            }
	            entity.ComponentTypes.splice(index, 1);
	            entity.ComponentTypesToRemove.push(componentConstructor);
	            var componentName = getName(componentConstructor);
	            entity.componentsToRemove[componentName] = entity.components[componentName];
	            delete entity.components[componentName];
	        }
	        // Check each indexed query to see if we need to remove it
	        this.queryManager.onEntityComponentRemoved(entity, componentConstructor);
	        if (componentConstructor.__proto__ === SystemStateComponent) {
	            this.numStateComponents--;
	            // Check if the entity was a ghost waiting for the last system state component to be removed
	            if (this.numStateComponents === 0 && !entity.alive) {
	                entity.remove();
	            }
	        }
	    };
	    EntityManager.prototype._entityRemoveComponentSync = function (entity, componentConstructor, index) {
	        // Remove T listing on entity and property ref, then free the component.
	        entity.ComponentTypes.splice(index, 1);
	        var propName = componentPropertyName(componentConstructor);
	        var componentName = getName(componentConstructor);
	        var componentEntity = entity.components[componentName];
	        delete entity.components[componentName];
	        this.componentManager.componentPool[propName].release(componentEntity);
	        this.componentManager.componentRemovedFromEntity(componentConstructor);
	    };
	    /**
	     * Remove all the components from an entity
	     * @param entity Entity from which the components will be removed
	     */
	    EntityManager.prototype.entityRemoveAllComponents = function (entity, immediately) {
	        var Components = entity.ComponentTypes;
	        for (var j = Components.length - 1; j >= 0; j--) {
	            if (Components[j].__proto__ !== SystemStateComponent) {
	                this.entityRemoveComponent(entity, Components[j], immediately);
	            }
	        }
	    };
	    /**
	     * Remove the entity from this manager. It will clear also its components
	     * @param entity Entity to remove from the manager
	     * @param immediately If you want to remove the component immediately instead of deferred (Default is false)
	     */
	    EntityManager.prototype.removeEntity = function (entity, immediately) {
	        var index = this.entities.indexOf(entity);
	        if (!~index) {
	            throw new Error('Tried to remove entity not in list');
	        }
	        entity.alive = false;
	        if (this.numStateComponents === 0) {
	            // Remove from entity list
	            this.eventDispatcher.dispatchEvent(ENTITY_REMOVED, entity);
	            this.queryManager.onEntityRemoved(entity);
	            if (immediately === true) {
	                this._releaseEntity(entity, index);
	            }
	            else {
	                this.entitiesToRemove.push(entity);
	            }
	        }
	        this.entityRemoveAllComponents(entity, immediately);
	    };
	    EntityManager.prototype._releaseEntity = function (entity, index) {
	        this.entities.splice(index, 1);
	        // Prevent any access and free
	        entity.entityManager = null;
	        this.entityPool.release(entity);
	    };
	    /**
	     * Remove all entities from this manager
	     */
	    EntityManager.prototype.removeAllEntities = function () {
	        for (var i = this.entities.length - 1; i >= 0; i--) {
	            this.removeEntity(this.entities[i]);
	        }
	    };
	    EntityManager.prototype.processDeferredRemoval = function () {
	        var e_1, _a, e_2, _b;
	        if (!this.deferredRemovalEnabled) {
	            return;
	        }
	        try {
	            for (var _c = __values(this.entitiesToRemove), _d = _c.next(); !_d.done; _d = _c.next()) {
	                var entity = _d.value;
	                var index = this.entities.indexOf(entity);
	                this._releaseEntity(entity, index);
	            }
	        }
	        catch (e_1_1) { e_1 = { error: e_1_1 }; }
	        finally {
	            try {
	                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
	            }
	            finally { if (e_1) throw e_1.error; }
	        }
	        this.entitiesToRemove.length = 0;
	        try {
	            for (var _e = __values(this.entitiesWithComponentsToRemove), _f = _e.next(); !_f.done; _f = _e.next()) {
	                var entity = _f.value;
	                while (entity.ComponentTypesToRemove.length > 0) {
	                    var componentToREmove = entity.ComponentTypesToRemove.pop();
	                    var propName = componentPropertyName(componentToREmove);
	                    var componentName = getName(componentToREmove);
	                    var component = entity.componentsToRemove[componentName];
	                    delete entity.componentsToRemove[componentName];
	                    this.componentManager.componentPool[propName].release(component);
	                    this.componentManager.componentRemovedFromEntity(componentToREmove);
	                    // this._entityRemoveComponentSync(entity, Component, index);
	                }
	            }
	        }
	        catch (e_2_1) { e_2 = { error: e_2_1 }; }
	        finally {
	            try {
	                if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
	            }
	            finally { if (e_2) throw e_2.error; }
	        }
	        this.entitiesWithComponentsToRemove.length = 0;
	    };
	    /**
	     * Get a query based on a list of components
	     * @param componentConstructor List of components that will form the query
	     */
	    EntityManager.prototype.queryComponents = function (componentConstructor) {
	        return this.queryManager.getQuery(componentConstructor);
	    };
	    // EXTRAS
	    /**
	     * Return number of entities
	     */
	    EntityManager.prototype.count = function () {
	        return this.entities.length;
	    };
	    /**
	     * Return some stats
	     */
	    EntityManager.prototype.stats = function () {
	        var stats = {
	            numEntities: this.entities.length,
	            numQueries: Object.keys(this.queryManager.queries).length,
	            queries: this.queryManager.stats(),
	            numComponentPool: Object.keys(this.componentManager.componentPool)
	                .length,
	            componentPool: {},
	            eventDispatcher: this.eventDispatcher.stats
	        };
	        for (var cname in this.componentManager.componentPool) {
	            if (this.componentManager.componentPool.hasOwnProperty(cname)) {
	                var pool = this.componentManager.componentPool[cname];
	                stats.componentPool[cname] = {
	                    used: pool.totalUsed(),
	                    size: pool.count
	                };
	            }
	        }
	        return stats;
	    };
	    return EntityManager;
	}());
	var ENTITY_CREATED = 'EntityManager#ENTITY_CREATE';
	var ENTITY_REMOVED = 'EntityManager#ENTITY_REMOVED';
	var COMPONENT_ADDED = 'EntityManager#COMPONENT_ADDED';
	var COMPONENT_REMOVE = 'EntityManager#COMPONENT_REMOVE';

	function canExecute(system) {
	    var e_1, _a;
	    if (system.mandatoryQueries.length === 0) {
	        return true;
	    }
	    try {
	        for (var _b = __values(system.mandatoryQueries), _c = _b.next(); !_c.done; _c = _b.next()) {
	            var query = _c.value;
	            if (query.entities.length === 0) {
	                return false;
	            }
	        }
	    }
	    catch (e_1_1) { e_1 = { error: e_1_1 }; }
	    finally {
	        try {
	            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
	        }
	        finally { if (e_1) throw e_1.error; }
	    }
	    return true;
	}

	function clearEvents(system) {
	    for (var queryName in system.queries) {
	        if (system.queries.hasOwnProperty(queryName)) {
	            var query = system.queries[queryName];
	            if (query.added) {
	                query.added.length = 0;
	            }
	            if (query.removed) {
	                query.removed.length = 0;
	            }
	            if (query.changed) {
	                if (Array.isArray(query.changed)) {
	                    query.changed.length = 0;
	                }
	                else {
	                    for (var name in query.changed) {
	                        if (query.changed.hasOwnProperty(name)) {
	                            query.changed[name].length = 0;
	                        }
	                    }
	                }
	            }
	        }
	    }
	}

	// tslint:disable:no-bitwise
	var SystemManager = /** @class */ (function () {
	    function SystemManager(entityManager) {
	        this.entityManager = entityManager;
	        this.systems = [];
	        this.executeSystems = []; // Systems that have `execute` method
	        this.lastExecutedSystem = null;
	    }
	    SystemManager.prototype.registerSystem = function (systemConstructor, attributes) {
	        if (this.systems.find(function (s) { return s.constructor.name === systemConstructor.name; }) !== undefined) {
	            console.warn("System '" + systemConstructor.name + "' already registered.");
	            return this;
	        }
	        var system = new systemConstructor();
	        // ----------
	        if (attributes && attributes.priority) {
	            system.priority = attributes.priority;
	        }
	        if (systemConstructor.queries) {
	            var _loop_1 = function (queryName) {
	                if (systemConstructor.queries.hasOwnProperty(queryName)) {
	                    var queryConfig_1 = systemConstructor.queries[queryName];
	                    var components = queryConfig_1.components;
	                    if (!components || components.length === 0) {
	                        throw new Error('\'components\' attribute can\'t be empty in a query');
	                    }
	                    var query_1 = this_1.entityManager.queryComponents(components);
	                    system.queriesOther[queryName] = query_1;
	                    if (queryConfig_1.mandatory === true) {
	                        system.mandatoryQueries.push(query_1);
	                    }
	                    system.queries[queryName] = {
	                        results: query_1.entities
	                    };
	                    // Reactive configuration added/removed/changed
	                    var validEvents = ['added', 'removed', 'changed'];
	                    var eventMapping_1 = {
	                        added: Query.prototype.ENTITY_ADDED,
	                        removed: Query.prototype.ENTITY_REMOVED,
	                        changed: Query.prototype.COMPONENT_CHANGED // Query.prototype.ENTITY_CHANGED
	                    };
	                    if (queryConfig_1.listen) {
	                        validEvents.forEach(function (eventName) {
	                            // Is the event enabled on this system's query?
	                            if (queryConfig_1.listen[eventName]) {
	                                var event_1 = queryConfig_1.listen[eventName];
	                                if (eventName === 'changed') {
	                                    query_1.reactive = true;
	                                    if (event_1 === true) {
	                                        // Any change on the entity from the components in the query
	                                        var eventList_1 = (system.queries[queryName][eventName] = []);
	                                        query_1.eventDispatcher.addEventListener(Query.prototype.COMPONENT_CHANGED, function (entity) {
	                                            // Avoid duplicates
	                                            if (eventList_1.indexOf(entity) === -1) {
	                                                eventList_1.push(entity);
	                                            }
	                                        });
	                                    }
	                                    else if (Array.isArray(event_1)) {
	                                        var eventList_2 = (system.queries[queryName][eventName] = []);
	                                        query_1.eventDispatcher.addEventListener(Query.prototype.COMPONENT_CHANGED, function (entity, changedComponent) {
	                                            // Avoid duplicates
	                                            if (event_1.indexOf(changedComponent.constructor) !== -1 &&
	                                                eventList_2.indexOf(entity) === -1) {
	                                                eventList_2.push(entity);
	                                            }
	                                        });
	                                    }
	                                }
	                                else {
	                                    var eventList_3 = (system.queries[queryName][eventName] = []);
	                                    query_1.eventDispatcher.addEventListener(eventMapping_1[eventName], function (entity) {
	                                        // @fixme overhead?
	                                        if (eventList_3.indexOf(entity) === -1) {
	                                            eventList_3.push(entity);
	                                        }
	                                    });
	                                }
	                            }
	                        });
	                    }
	                }
	            };
	            var this_1 = this;
	            for (var queryName in systemConstructor.queries) {
	                _loop_1(queryName);
	            }
	        }
	        // ----------
	        if (system.init) {
	            system.init();
	        }
	        system.order = this.systems.length;
	        this.systems.push(system);
	        if (system.run) {
	            this.executeSystems.push(system);
	            this.sortSystems();
	        }
	        return this;
	    };
	    SystemManager.prototype.sortSystems = function () {
	        this.executeSystems.sort(function (a, b) {
	            return a.priority - b.priority || a.order - b.order;
	        });
	    };
	    SystemManager.prototype.getSystem = function (systemConstructor) {
	        return this.systems.find(function (s) { return s instanceof systemConstructor; });
	    };
	    SystemManager.prototype.getSystems = function () {
	        return this.systems;
	    };
	    SystemManager.prototype.removeSystem = function (system) {
	        var index = this.systems.indexOf(system);
	        if (!~index) {
	            return;
	        }
	        this.systems.splice(index, 1);
	    };
	    SystemManager.prototype.runSystem = function (system) {
	        if (system.initialized) {
	            if (canExecute(system)) {
	                var startTime = performance.now(); // ! debag performance
	                // main run;
	                system.run();
	                system.executeTime = performance.now() - startTime; // ! debag performance
	                this.lastExecutedSystem = system;
	                clearEvents(system);
	            }
	        }
	    };
	    SystemManager.prototype.stop = function () {
	        var e_1, _a;
	        try {
	            for (var _b = __values(this.executeSystems), _c = _b.next(); !_c.done; _c = _b.next()) {
	                var system = _c.value;
	                system.stop();
	                system.executeTime = 0; // ! debag performance
	            }
	        }
	        catch (e_1_1) { e_1 = { error: e_1_1 }; }
	        finally {
	            try {
	                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
	            }
	            finally { if (e_1) throw e_1.error; }
	        }
	    };
	    SystemManager.prototype.run = function (forcePlay) {
	        var e_2, _a;
	        try {
	            for (var _b = __values(this.executeSystems), _c = _b.next(); !_c.done; _c = _b.next()) {
	                var system = _c.value;
	                if (forcePlay || system.enabled) {
	                    this.runSystem(system);
	                }
	            }
	        }
	        catch (e_2_1) { e_2 = { error: e_2_1 }; }
	        finally {
	            try {
	                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
	            }
	            finally { if (e_2) throw e_2.error; }
	        }
	    };
	    SystemManager.prototype.stats = function () {
	        var e_3, _a;
	        var stats = {
	            numSystems: this.systems.length,
	            systems: {}
	        };
	        try {
	            for (var _b = __values(this.systems), _c = _b.next(); !_c.done; _c = _b.next()) {
	                var system = _c.value;
	                var systemStats = (stats.systems[system.constructor.name] = {
	                    queries: {}
	                });
	                for (var name in system.ctx) {
	                    if (system.ctx.hasOwnProperty(name)) {
	                        systemStats.queries[name] = system.ctx[name].stats();
	                    }
	                }
	            }
	        }
	        catch (e_3_1) { e_3 = { error: e_3_1 }; }
	        finally {
	            try {
	                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
	            }
	            finally { if (e_3) throw e_3.error; }
	        }
	        return stats;
	    };
	    return SystemManager;
	}());

	/**
	 * The World is the root of the ECS.
	 */
	var World = /** @class */ (function () {
	    /**
	     * Create a new World.
	     */
	    function World() {
	        this.componentsManager = new ComponentManager();
	        this.entityManager = new EntityManager(this.componentsManager);
	        this.systemManager = new SystemManager(this.entityManager);
	        this.enabled = true;
	        this.eventQueues = {};
	        this.lastTime = performance.now();
	        if (typeof CustomEvent !== 'undefined') {
	            var event = new CustomEvent('ecsy-world-created', {
	                detail: {
	                    world: this,
	                }
	            });
	            window.dispatchEvent(event);
	        }
	    }
	    /**
	     * Register a component.
	     * @param component Type of component to register
	     */
	    World.prototype.registerComponent = function (component) {
	        this.componentsManager.registerComponent(component);
	        return this;
	    };
	    /**
	     * Register a system.
	     * @param system Type of system to register
	     */
	    World.prototype.registerSystem = function (system, attributes) {
	        this.systemManager.registerSystem(system, attributes);
	        return this;
	    };
	    /**
	     * Get a system registered in this world.
	     * @param System Type of system to get.
	     */
	    World.prototype.getSystem = function (SystemClass) {
	        return this.systemManager.getSystem(SystemClass);
	    };
	    /**
	     * Get a list of systems registered in this world.
	     */
	    World.prototype.getSystems = function () {
	        return this.systemManager.getSystems();
	    };
	    /**
	     * Update the systems.
	     */
	    World.prototype.run = function () {
	        if (this.enabled) {
	            this.systemManager.run();
	            this.entityManager.processDeferredRemoval();
	        }
	    };
	    /**
	     * Stop execution of this world.
	     */
	    World.prototype.stop = function () {
	        this.enabled = false;
	    };
	    /**
	     * Resume execution of this world.
	     */
	    World.prototype.play = function () {
	        this.enabled = true;
	    };
	    /**
	     * Create a new entity
	     */
	    World.prototype.createEntity = function () {
	        return this.entityManager.createEntity();
	    };
	    World.prototype.stats = function () {
	        var stats = {
	            entities: this.entityManager.stats(),
	            system: this.systemManager.stats()
	        };
	        console.log(JSON.stringify(stats, null, 2));
	    };
	    return World;
	}());

	var SystemBase = /** @class */ (function () {
	    function SystemBase() {
	        this.enabled = true;
	        this.initialized = true;
	        this.queriesOther = {};
	        this.queries = {};
	        this.mandatoryQueries = [];
	    }
	    SystemBase.prototype.run = function () { };
	    SystemBase.prototype.play = function () {
	        this.enabled = true;
	    };
	    SystemBase.prototype.stop = function () {
	        this.enabled = false;
	    };
	    return SystemBase;
	}());

	/**
	 * Use the Not class to negate a component query.
	 */
	var Not = function (component) { return ({
	    operator: 'not',
	    component: component,
	}); };

	var Types;
	(function (Types) {
	    Types["Number"] = "number";
	    Types["Boolean"] = "boolean";
	    Types["String"] = "string";
	    Types["Array"] = "array";
	})(Types || (Types = {}));
	var standardTypes = {
	    number: Types.Number,
	    boolean: Types.Boolean,
	    string: Types.String
	};
	/**
	 * Try to infer the type of the value
	 * @return Type of the attribute
	 */
	function inferType(value) {
	    if (Array.isArray(value)) {
	        return Types.Array;
	    }
	    if (standardTypes[typeof value]) {
	        return standardTypes[typeof value];
	    }
	    else {
	        return null;
	    }
	}

	function createComponentClass(schema, name) {
	    // var Component = new Function(`return function ${name}() {}`)();
	    for (var key in schema) {
	        if (schema.hasOwnProperty(key)) {
	            var type = schema[key].type;
	            if (!type) {
	                schema[key].type = inferType(schema[key].default);
	            }
	        }
	    }
	    var Component = function () {
	        for (var key in schema) {
	            if (schema.hasOwnProperty(key)) {
	                var attr = schema[key];
	                var type = attr.type;
	                if (type && type.isType) {
	                    this[key] = type.create(attr.default);
	                }
	                else {
	                    this[key] = attr.default;
	                }
	            }
	        }
	    };
	    if (typeof name !== 'undefined') {
	        Object.defineProperty(Component, 'name', { value: name });
	    }
	    Component.prototype.schema = schema;
	    var knownTypes = true;
	    for (var key in schema) {
	        if (schema.hasOwnProperty(key)) {
	            var attr = schema[key];
	            if (!attr.type) {
	                attr.type = inferType(attr.default);
	            }
	            var type = attr.type;
	            if (!type) {
	                console.warn("Unknown type definition for attribute '" + key + "'");
	                knownTypes = false;
	            }
	        }
	    }
	    if (!knownTypes) {
	        console.warn("This component can't use pooling because some data types are not registered. Please provide a type created with 'createType'");
	        for (var key in schema) {
	            if (schema.hasOwnProperty(key)) {
	                var attr = schema[key];
	                Component.prototype[key] = attr.default;
	            }
	        }
	    }
	    else {
	        Component.prototype.copy = function (src) {
	            for (var key in schema) {
	                if (src[key]) {
	                    var type = schema[key].type;
	                    if (type.isSimpleType) {
	                        this[key] = src[key];
	                    }
	                    else if (type.copy) {
	                        type.copy(this, src, key);
	                    }
	                    else {
	                        // @todo Detect that it's not possible to copy all the attributes
	                        // and just avoid creating the copy function
	                        console.warn("Unknown copy function for attribute '" + key + "' data type");
	                    }
	                }
	            }
	        };
	        Component.prototype.reset = function () {
	            for (var key in schema) {
	                if (schema.hasOwnProperty(key)) {
	                    var attr = schema[key];
	                    var type = attr.type;
	                    if (type.reset) {
	                        type.reset(this, key, attr.default);
	                    }
	                }
	            }
	        };
	        Component.prototype.clear = function () {
	            for (var key in schema) {
	                if (schema.hasOwnProperty(key)) {
	                    var type = schema[key].type;
	                    if (type.clear) {
	                        type.clear(this, key);
	                    }
	                }
	            }
	        };
	        for (var key in schema) {
	            if (schema.hasOwnProperty(key)) {
	                var attr = schema[key];
	                var type = attr.type;
	                Component.prototype[key] = attr.default;
	                if (type.reset) {
	                    type.reset(Component.prototype, key, attr.default);
	                }
	            }
	        }
	    }
	    return Component;
	}

	var version = "0.1.4";

	var Version = version;

	exports.Not = Not;
	exports.SystemBase = SystemBase;
	exports.Version = Version;
	exports.World = World;
	exports.createComponentClass = createComponentClass;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
