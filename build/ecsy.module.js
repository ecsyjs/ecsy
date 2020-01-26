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
    function ObjectPool(objectConstructor, initialSize) {
        this.count = 0;
        this.freeList = [];
        var extraArgs = null;
        if (arguments.length > 1) {
            extraArgs = Array.prototype.slice.call(arguments);
            extraArgs.shift();
        }
        this.createElement = extraArgs
            ? function () { return new (objectConstructor.bind.apply(objectConstructor, __spread([void 0], extraArgs)))(); }
            : function () { return new objectConstructor(); };
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
            item.reset();
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

var DummyObjectPool = /** @class */ (function () {
    function DummyObjectPool(objectConstructor) {
        this.objectConstructor = objectConstructor;
        this.count = 0;
        this.used = 0;
    }
    DummyObjectPool.prototype.aquire = function () {
        this.used++;
        this.count++;
        return new this.objectConstructor();
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

// TODO: add removeComponent method
var ComponentManager = /** @class */ (function () {
    function ComponentManager() {
        this.componentConstructors = new Set();
        this.componentPool = new Map();
    }
    ComponentManager.prototype.registerComponent = function (componentConstructor) {
        if (this.componentConstructors.has(componentConstructor)) {
            console.warn("Component type: '" + componentConstructor.name + "' already registered.");
            return;
        }
        this.componentConstructors.add(componentConstructor);
    };
    ComponentManager.prototype.componentAddedToEntity = function (componentConstructor) {
        if (!this.componentConstructors.has(componentConstructor)) {
            this.registerComponent(componentConstructor);
        }
    };
    ComponentManager.prototype.getComponentsPool = function (componentConstructor) {
        if (!this.componentPool.has(componentConstructor)) {
            if (componentConstructor.prototype.reset) {
                this.componentPool.set(componentConstructor, new ObjectPool(componentConstructor));
            }
            else {
                console.warn("Component '" + componentConstructor.name + "' won't benefit from pooling because 'reset' method was not implemeneted.");
                this.componentPool.set(componentConstructor, new DummyObjectPool(componentConstructor));
            }
        }
        return this.componentPool.get(componentConstructor);
    };
    return ComponentManager;
}());

/**
 * Return the name of a component
 */
function getName(componentConstructor) {
    return componentConstructor.name;
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
                names.push(operator + getName(T.component));
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

/**
 * EventDispatcher
 */
var EventDispatcher = /** @class */ (function () {
    function EventDispatcher() {
        this.listeners = new Map();
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
        if (!listeners.has(eventName)) {
            listeners.set(eventName, []);
        }
        var listenerArray = listeners.get(eventName);
        if (listenerArray.indexOf(listener) === -1) {
            listenerArray.push(listener);
        }
    };
    /**
     * Check if an event listener is already added to the list of listeners
     * @param eventName Name of the event to check
     * @param listener Callback for the specified event
     */
    EventDispatcher.prototype.hasEventListener = function (eventName, listener) {
        return (this.listeners.has(eventName) && this.listeners.get(eventName).indexOf(listener) !== -1);
    };
    /**
     * Remove an event listener
     * @param eventName Name of the event to remove
     * @param listener Callback for the specified event
     */
    EventDispatcher.prototype.removeEventListener = function (eventName, listener) {
        var listenerArray = this.listeners.get(eventName);
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
        var listenerArray = this.listeners.get(eventName);
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
var QueryEvents;
(function (QueryEvents) {
    QueryEvents[QueryEvents["ENTITY_ADDED"] = 0] = "ENTITY_ADDED";
    QueryEvents[QueryEvents["ENTITY_REMOVED"] = 1] = "ENTITY_REMOVED";
    QueryEvents[QueryEvents["COMPONENT_CHANGED"] = 2] = "COMPONENT_CHANGED";
})(QueryEvents || (QueryEvents = {}));
var Query = /** @class */ (function () {
    /**
     * @param componentConstructors List of types of components to query
     */
    function Query(componentConstructors, entities, key) {
        var e_1, _a;
        var _this = this;
        this.key = key;
        this.componentConstructors = [];
        this.notComponentConstructor = [];
        this.entities = [];
        this.eventDispatcher = new EventDispatcher();
        // This query is being used by a reactive system
        this.reactive = false;
        componentConstructors.forEach(function (componentConstructor) {
            if (typeof componentConstructor === 'object') {
                _this.notComponentConstructor.push(componentConstructor.component);
            }
            else {
                _this.componentConstructors.push(componentConstructor);
            }
        });
        if (this.componentConstructors.length === 0) {
            throw new Error('Can\'t create a query without components');
        }
        try {
            // Fill the query with the existing entities
            for (var entities_1 = __values(entities), entities_1_1 = entities_1.next(); !entities_1_1.done; entities_1_1 = entities_1.next()) {
                var entity = entities_1_1.value;
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
                if (entities_1_1 && !entities_1_1.done && (_a = entities_1.return)) _a.call(entities_1);
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
        this.eventDispatcher.dispatchEvent(QueryEvents.ENTITY_ADDED, entity);
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
            this.eventDispatcher.dispatchEvent(QueryEvents.ENTITY_REMOVED, entity);
        }
    };
    Query.prototype.match = function (entity) {
        return (entity.hasAllComponents(this.componentConstructors) &&
            !entity.hasAnyComponents(this.notComponentConstructor));
    };
    Query.prototype.toJSON = function () {
        return {
            key: this.key,
            reactive: this.reactive,
            components: {
                included: this.componentConstructors.map(function (C) { return C.name; }),
                not: this.notComponentConstructor.map(function (C) { return C.name; })
            },
            numEntities: this.entities.length
        };
    };
    /**
     * Return stats for this query
     */
    Query.prototype.stats = function () {
        return {
            numComponents: this.componentConstructors.length,
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
        this.componentTypes = new Set();
        // Instance of the components
        this.components = new Map();
        this.componentsToRemove = new Map();
        // Queries where the entity is added
        this.queries = [];
        // Used for deferred removal
        this.componentTypesToRemove = new Set();
        this.alive = false;
    }
    // COMPONENTS
    Entity.prototype.getComponent = function (componentConstructor, includeRemoved) {
        var component = this.components.get(componentConstructor.name);
        if (!component && includeRemoved === true) {
            component = this.componentsToRemove.get(componentConstructor.name);
        }
        return  component;
    };
    Entity.prototype.getMutableComponent = function (componentConstructor) {
        var e_1, _a;
        var component = this.components.get(componentConstructor.name);
        try {
            for (var _b = __values(this.queries), _c = _b.next(); !_c.done; _c = _b.next()) {
                var query = _c.value;
                // @todo accelerate this check. Maybe having query._Components as an object
                if (query.reactive && query.componentConstructors.indexOf(componentConstructor) !== -1) {
                    query.eventDispatcher.dispatchEvent(QueryEvents.COMPONENT_CHANGED, this, component);
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
    /**
     * Once a component is removed from an entity, it is possible to access its contents
     */
    Entity.prototype.getRemovedComponent = function (componentConstructor) {
        return this.componentsToRemove.get(componentConstructor.name);
    };
    Entity.prototype.getComponents = function () {
        return this.components;
    };
    Entity.prototype.getComponentsToRemove = function () {
        return this.componentsToRemove;
    };
    Entity.prototype.getComponentTypes = function () {
        return this.componentTypes;
    };
    Entity.prototype.addComponent = function (componentConstructor, values) {
        this.entityManager.entityAddComponent(this, componentConstructor, values);
        return this;
    };
    /**
     * This will mark the component to be removed and will populate all the queues from the
     * systems that are listening to that event, but the component itself won't be disposed
     * until the end of the frame, we call it deferred removal. This is done so systems that
     * need to react to it can still access the data of the components.
     */
    Entity.prototype.removeComponent = function (componentConstructor, forceRemove) {
        this.entityManager.entityRemoveComponent(this, componentConstructor, forceRemove);
        return this;
    };
    Entity.prototype.hasComponent = function (componentConstructor, includeRemoved) {
        return (this.componentTypes.has(componentConstructor) ||
            (includeRemoved === true && this.hasRemovedComponent(componentConstructor)));
    };
    Entity.prototype.hasRemovedComponent = function (componentConstructor) {
        return this.componentTypesToRemove.has(componentConstructor);
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
        this.componentTypes.clear();
        this.queries.length = 0;
        this.components.clear();
    };
    Entity.prototype.remove = function (forceRemove) {
        return this.entityManager.removeEntity(this, forceRemove);
    };
    return Entity;
}());

/**
 * Components that extend the SystemStateComponent are not removed when an entity is deleted.
 *
 * System State Components (SSC) are components used by a system to hold internal resources
 * for an entity. They are not removed when you delete the entity, you must explicitly remove
 * them when you are done with them. They can be used to detect when an entity has been added
 * or removed from a query.
 */
var SystemStateComponent = /** @class */ (function () {
    function SystemStateComponent() {
    }
    SystemStateComponent.isSystemStateComponent = true;
    return SystemStateComponent;
}());

// tslint:disable:no-bitwise
var EntityManagerEvents;
(function (EntityManagerEvents) {
    EntityManagerEvents[EntityManagerEvents["ENTITY_CREATED"] = 0] = "ENTITY_CREATED";
    EntityManagerEvents[EntityManagerEvents["ENTITY_REMOVED"] = 1] = "ENTITY_REMOVED";
    EntityManagerEvents[EntityManagerEvents["COMPONENT_ADDED"] = 2] = "COMPONENT_ADDED";
    EntityManagerEvents[EntityManagerEvents["COMPONENT_REMOVE"] = 3] = "COMPONENT_REMOVE";
})(EntityManagerEvents || (EntityManagerEvents = {}));
/**
 * EntityManager
 */
var EntityManager = /** @class */ (function () {
    function EntityManager(componentManager, queryManager) {
        this.componentManager = componentManager;
        this.queryManager = queryManager;
        // All the entities in this instance
        this.entities = [];
        this.eventDispatcher = new EventDispatcher();
        this.entityPool = new ObjectPool(Entity);
        // Deferred deletion
        this.entitiesWithComponentsToRemove = new Set();
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
        this.eventDispatcher.dispatchEvent(EntityManagerEvents.ENTITY_CREATED, entity);
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
        if (entity.componentTypes.has(componentConstructor)) {
            return;
        }
        entity.componentTypes.add(componentConstructor);
        if (componentConstructor.__proto__ === SystemStateComponent) {
            this.numStateComponents++;
        }
        var componentPool = this.componentManager.getComponentsPool(componentConstructor);
        var componentFromPool = componentPool.aquire();
        entity.components.set(componentConstructor.name, componentFromPool);
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
        this.eventDispatcher.dispatchEvent(EntityManagerEvents.COMPONENT_ADDED, entity, componentConstructor);
    };
    /**
     * Remove a component from an entity
     * @param entity Entity which will get removed the component
     * @param componentConstructor Component to remove from the entity
     * @param immediately If you want to remove the component immediately instead of deferred (Default is false)
     */
    EntityManager.prototype.entityRemoveComponent = function (entity, componentConstructor, immediately) {
        if (!entity.componentTypes.has(componentConstructor)) {
            return;
        }
        this.eventDispatcher.dispatchEvent(EntityManagerEvents.COMPONENT_REMOVE, entity, componentConstructor);
        if (immediately) {
            this.entityRemoveComponentSync(entity, componentConstructor);
        }
        else {
            if (entity.componentTypesToRemove.size === 0) {
                this.entitiesWithComponentsToRemove.add(entity);
            }
            entity.componentTypes.delete(componentConstructor);
            entity.componentTypesToRemove.add(componentConstructor);
            var componentName = getName(componentConstructor);
            entity.componentsToRemove.set(componentName, entity.components.get(componentName));
            entity.components.delete(componentName);
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
    EntityManager.prototype.entityRemoveComponentSync = function (entity, componentConstructor) {
        // Remove T listing on entity and property ref, then free the component.
        entity.componentTypes.delete(componentConstructor);
        var componentName = getName(componentConstructor);
        var componentEntity = entity.components.get(componentName);
        entity.components.delete(componentName);
        this.componentManager.componentPool.get(componentConstructor).release(componentEntity);
    };
    /**
     * Remove all the components from an entity
     * @param entity Entity from which the components will be removed
     */
    EntityManager.prototype.entityRemoveAllComponents = function (entity, immediately) {
        var e_1, _a;
        try {
            for (var _b = __values(entity.componentTypes), _c = _b.next(); !_c.done; _c = _b.next()) {
                var componentType = _c.value;
                if (componentType.__proto__ !== SystemStateComponent) {
                    this.entityRemoveComponent(entity, componentType, immediately);
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
            this.eventDispatcher.dispatchEvent(EntityManagerEvents.ENTITY_REMOVED, entity);
            this.queryManager.onEntityRemoved(entity);
            if (immediately === true) {
                this.releaseEntity(entity, index);
            }
            else {
                this.entitiesToRemove.push(entity);
            }
        }
        this.entityRemoveAllComponents(entity, immediately);
    };
    EntityManager.prototype.releaseEntity = function (entity, index) {
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
        var e_2, _a, e_3, _b, e_4, _c;
        if (!this.deferredRemovalEnabled) {
            return;
        }
        try {
            for (var _d = __values(this.entitiesToRemove), _e = _d.next(); !_e.done; _e = _d.next()) {
                var entity = _e.value;
                var index = this.entities.indexOf(entity);
                this.releaseEntity(entity, index);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
            }
            finally { if (e_2) throw e_2.error; }
        }
        this.entitiesToRemove.length = 0;
        try {
            for (var _f = __values(this.entitiesWithComponentsToRemove), _g = _f.next(); !_g.done; _g = _f.next()) {
                var entity = _g.value;
                try {
                    for (var _h = (e_4 = void 0, __values(entity.componentTypesToRemove)), _j = _h.next(); !_j.done; _j = _h.next()) {
                        var componentTypeToRemove = _j.value;
                        var componentName = getName(componentTypeToRemove);
                        var component = entity.componentsToRemove.get(componentName);
                        entity.componentsToRemove.delete(componentName);
                        this.componentManager.componentPool.get(componentTypeToRemove).release(component);
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_j && !_j.done && (_c = _h.return)) _c.call(_h);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
                entity.componentTypesToRemove.clear();
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
            }
            finally { if (e_3) throw e_3.error; }
        }
        this.entitiesWithComponentsToRemove.clear();
    };
    /**
     * Get a query based on a list of components
     * @param componentConstructors List of components that will form the query
     */
    EntityManager.prototype.getQuery = function (componentConstructors) {
        return this.queryManager.getQuery(componentConstructors, this.entities);
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
        var e_5, _a;
        var stats = {
            numEntities: this.entities.length,
            numQueries: Object.keys(this.queryManager.queries).length,
            queries: this.queryManager.stats(),
            numComponentPool: Object.keys(this.componentManager.componentPool)
                .length,
            componentPool: {},
            eventDispatcher: this.eventDispatcher.stats
        };
        try {
            for (var _b = __values(this.componentManager.componentPool), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), cname = _d[0], _ = _d[1];
                var pool = this.componentManager.componentPool.get(cname);
                stats.componentPool[cname.name] = {
                    used: pool.totalUsed(),
                    size: pool.count
                };
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_5) throw e_5.error; }
        }
        return stats;
    };
    return EntityManager;
}());

// tslint:disable:no-bitwise
/**
 * QueryManager
 */
var QueryManager = /** @class */ (function () {
    function QueryManager() {
        // Queries indexed by a unique identifier for the components it has
        this.queries = new Map();
    }
    QueryManager.prototype.onEntityRemoved = function (entity) {
        var e_1, _a;
        try {
            for (var _b = __values(this.queries), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), _ = _d[0], query = _d[1];
                if (entity.queries.indexOf(query) !== -1) {
                    query.removeEntity(entity);
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
    };
    /**
     * Callback when a component is added to an entity
     * @param entity Entity that just got the new component
     * @param componentConstructor Component added to the entity
     */
    QueryManager.prototype.onEntityComponentAdded = function (entity, componentConstructor) {
        // @todo Use bitmask for checking components?
        var e_2, _a;
        try {
            // Check each indexed query to see if we need to add this entity to the list
            for (var _b = __values(this.queries), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), _ = _d[0], query = _d[1];
                if (!!~query.notComponentConstructor.indexOf(componentConstructor) &&
                    ~query.entities.indexOf(entity)) {
                    query.removeEntity(entity);
                    continue;
                }
                // Add the entity only if:
                // Component is in the query
                // and Entity has ALL the components of the query
                // and Entity is not already in the query
                if (!~query.componentConstructors.indexOf(componentConstructor) ||
                    !query.match(entity) ||
                    ~query.entities.indexOf(entity)) {
                    continue;
                }
                query.addEntity(entity);
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
    /**
     * Callback when a component is removed from an entity
     * @param entity Entity to remove the component from
     * @param componentConstructor Component to remove from the entity
     */
    QueryManager.prototype.onEntityComponentRemoved = function (entity, componentConstructor) {
        var e_3, _a;
        try {
            for (var _b = __values(this.queries), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), _ = _d[0], query = _d[1];
                if (!!~query.notComponentConstructor.indexOf(componentConstructor) &&
                    !~query.entities.indexOf(entity) &&
                    query.match(entity)) {
                    query.addEntity(entity);
                    continue;
                }
                if (!!~query.componentConstructors.indexOf(componentConstructor) &&
                    !!~query.entities.indexOf(entity) &&
                    !query.match(entity)) {
                    query.removeEntity(entity);
                    continue;
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
    };
    /**
     * Get a query for the specified components
     * @param componentConstructors Components that the query should have
     */
    QueryManager.prototype.getQuery = function (componentConstructors, entities) {
        var key = queryKey(componentConstructors);
        var query = this.queries.get(key);
        if (!query) {
            query = new Query(componentConstructors, entities, key);
            this.queries.set(key, query);
        }
        return query;
    };
    /**
     * Return some stats from this class
     */
    QueryManager.prototype.stats = function () {
        var e_4, _a;
        var stats = {};
        try {
            for (var _b = __values(this.queries), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), queryName = _d[0], query = _d[1];
                stats[queryName] = query.stats();
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return stats;
    };
    return QueryManager;
}());

var canExecute = function (system) {
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
};

var clearEvents = function (system) {
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
            }
        }
    }
};

// tslint:disable:no-bitwise
var SystemManager = /** @class */ (function () {
    function SystemManager(entityManager) {
        this.entityManager = entityManager;
        this.systems = new Map();
        // order is important
        this.executeSystems = []; // Systems that have `execute` method
        this.lastExecutedSystem = null;
    }
    SystemManager.prototype.registerSystem = function (systemConstructor, attributes) {
        if (this.systems.has(systemConstructor)) {
            console.warn("System '" + systemConstructor.name + "' already registered.");
            return this;
        }
        var system = new systemConstructor();
        // ----------
        if (attributes && attributes.priority) {
            system.priority = attributes.priority;
        }
        if (systemConstructor.queries) {
            system.queriesOther = [];
            system.queries = {};
            var _loop_1 = function (queryName) {
                if (systemConstructor.queries.hasOwnProperty(queryName)) {
                    var queryConfig_1 = systemConstructor.queries[queryName];
                    var components = queryConfig_1.components;
                    if (!components || components.length === 0) {
                        throw new Error('\'components\' attribute can\'t be empty in a query');
                    }
                    var query_1 = this_1.entityManager.getQuery(components);
                    system.queriesOther[queryName] = query_1;
                    if (queryConfig_1.mandatory === true) {
                        system.mandatoryQueries.push(query_1);
                    }
                    system.queries[queryName] = {
                        results: query_1.entities
                    };
                    var events = {
                        added: function () {
                            var eventList = (system.queries[queryName].added = []);
                            query_1.eventDispatcher.addEventListener(QueryEvents.ENTITY_ADDED, function (entity) {
                                // @fixme overhead?
                                if (eventList.indexOf(entity) === -1) {
                                    eventList.push(entity);
                                }
                            });
                        },
                        removed: function () {
                            var eventList = (system.queries[queryName].removed = []);
                            query_1.eventDispatcher.addEventListener(QueryEvents.ENTITY_REMOVED, function (entity) {
                                // @fixme overhead?
                                if (eventList.indexOf(entity) === -1) {
                                    eventList.push(entity);
                                }
                            });
                        },
                        changed: function () {
                            var event = queryConfig_1.listen.changed;
                            query_1.reactive = true;
                            if (event === true) {
                                // Any change on the entity from the components in the query
                                var eventList_1 = (system.queries[queryName].changed = []);
                                query_1.eventDispatcher.addEventListener(QueryEvents.COMPONENT_CHANGED, function (entity) {
                                    // Avoid duplicates
                                    if (eventList_1.indexOf(entity) === -1) {
                                        eventList_1.push(entity);
                                    }
                                });
                            }
                            else if (Array.isArray(event)) {
                                var eventList_2 = (system.queries[queryName].changed = []);
                                query_1.eventDispatcher.addEventListener(QueryEvents.COMPONENT_CHANGED, function (entity, changedComponent) {
                                    // Avoid duplicates
                                    if (event.indexOf(changedComponent.constructor) !== -1 &&
                                        eventList_2.indexOf(entity) === -1) {
                                        eventList_2.push(entity);
                                    }
                                });
                            }
                        }
                    };
                    if (queryConfig_1.listen) {
                        for (var eventName in queryConfig_1.listen) {
                            if (queryConfig_1.listen.hasOwnProperty(eventName) && events[eventName]) {
                                events[eventName]();
                            }
                        }
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
        system.order = this.systems.size;
        this.systems.set(systemConstructor, system);
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
        return this.systems.get(systemConstructor);
    };
    SystemManager.prototype.getSystems = function () {
        return this.systems;
    };
    SystemManager.prototype.removeSystem = function (systemConstructor) {
        this.systems.delete(systemConstructor);
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
            numSystems: this.systems.size,
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
 * A system that manipulates entities in the world.
 * Every run systems are executed and they create, remove or modify entities and components.
 */
var System = /** @class */ (function () {
    function System() {
        /**
         * Whether the system will execute during the world tick.
         */
        this.enabled = true;
        this.initialized = true;
        this.queriesOther = {};
        this.queries = {};
        this.mandatoryQueries = [];
        this.priority = 0;
        this.order = 0;
    }
    /**
     * Resume execution of this system.
     */
    System.prototype.play = function () {
        this.enabled = true;
    };
    /**
     * Stop execution of this system.
     */
    System.prototype.stop = function () {
        this.enabled = false;
    };
    return System;
}());

/**
 * The World is the root of the ECS.
 */
var World = /** @class */ (function () {
    /**
     * Create a new World.
     */
    function World(componentsManager, entityManager, systemManager) {
        if (componentsManager === void 0) { componentsManager = new ComponentManager(); }
        if (entityManager === void 0) { entityManager = new EntityManager(componentsManager, new QueryManager()); }
        if (systemManager === void 0) { systemManager = new SystemManager(entityManager); }
        this.componentsManager = componentsManager;
        this.entityManager = entityManager;
        this.systemManager = systemManager;
        this.enabled = true;
        this.eventQueues = {};
        this.lastTime = performance.now();
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

/**
 * Use the Not class to negate a component query.
 */
var Not = function (component) { return ({
    operator: 'not',
    component: component,
}); };

/**
 * Create components that extend TagComponent in order to take advantage of performance optimizations for components
 * that do not store data
 */
var TagComponent = /** @class */ (function () {
    function TagComponent() {
    }
    TagComponent.prototype.reset = function () { };
    return TagComponent;
}());

function createType(typeDefinition) {
    var mandatoryFunctions = [
        'create',
        'reset',
        'clear'
        /*"copy"*/
    ];
    var undefinedFunctions = mandatoryFunctions.filter(function (f) {
        return !typeDefinition[f];
    });
    if (undefinedFunctions.length > 0) {
        throw new Error("createType expect type definition to implements the following functions: " + undefinedFunctions.join(', '));
    }
    typeDefinition.isType = true;
    return typeDefinition;
}

/**
 * Standard types
 */
var standardTypes = {
    number: createType({
        baseType: Number,
        isSimpleType: true,
        create: function (defaultValue) {
            return typeof defaultValue !== 'undefined' ? defaultValue : 0;
        },
        reset: function (src, key, defaultValue) {
            if (typeof defaultValue !== 'undefined') {
                src[key] = defaultValue;
            }
            else {
                src[key] = 0;
            }
        },
        clear: function (src, key) {
            src[key] = 0;
        }
    }),
    boolean: createType({
        baseType: Boolean,
        isSimpleType: true,
        create: function (defaultValue) {
            return typeof defaultValue !== 'undefined' ? defaultValue : false;
        },
        reset: function (src, key, defaultValue) {
            if (typeof defaultValue !== 'undefined') {
                src[key] = defaultValue;
            }
            else {
                src[key] = false;
            }
        },
        clear: function (src, key) {
            src[key] = false;
        }
    }),
    string: createType({
        baseType: String,
        isSimpleType: true,
        create: function (defaultValue) {
            return typeof defaultValue !== 'undefined' ? defaultValue : '';
        },
        reset: function (src, key, defaultValue) {
            if (typeof defaultValue !== 'undefined') {
                src[key] = defaultValue;
            }
            else {
                src[key] = '';
            }
        },
        clear: function (src, key) {
            src[key] = '';
        }
    }),
    array: createType({
        baseType: Array,
        create: function (defaultValue) {
            if (typeof defaultValue !== 'undefined') {
                return defaultValue.slice();
            }
            return [];
        },
        reset: function (src, key, defaultValue) {
            if (typeof defaultValue !== 'undefined') {
                src[key] = defaultValue.slice();
            }
            else {
                src[key].length = 0;
            }
        },
        clear: function (src, key) {
            src[key].length = 0;
        },
        copy: function (src, dst, key) {
            src[key] = dst[key].slice();
        }
    }),
};

/**
 * Try to infer the type of the value
 * @return Type of the attribute
 */
function inferType(value) {
    if (Array.isArray(value)) {
        return standardTypes.array;
    }
    else if (standardTypes[typeof value]) {
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

export { Entity, Not, System, SystemStateComponent, TagComponent, Version, World, createComponentClass, createType, standardTypes };
//# sourceMappingURL=ecsy.module.js.map
