class PerfStats {
  constructor() {
    this.n = 0;
    this.min = Number.MAX_VALUE;
    this.max = -Number.MAX_VALUE;
    this.sum = 0;
    this.mean = 0;
    this.q = 0;
  }

  get variance() {
    return this.q / this.n;
  }

  get standard_deviation() {
    return Math.sqrt(this.q / this.n);
  }

  update(value) {
    var num = parseFloat(value);
    if (isNaN(num)) {
      // Sorry, no NaNs
      return;
    }
    this.n++;
    this.min = Math.min(this.min, num);
    this.max = Math.max(this.max, num);
    this.sum += num;
    const prevMean = this.mean;
    this.mean = this.mean + (num - this.mean) / this.n;
    this.q = this.q + (num - prevMean) * (num - this.mean);
  }

  getAll() {
    return {
      n: this.n,
      min: this.min,
      max: this.max,
      sum: this.sum,
      mean: this.mean,
      variance: this.variance,
      standard_deviation: this.standard_deviation
    };
  }  
}

var chalk = require('chalk');
const { printTable } = require('console-table-printer');

const Table = require("tty-table");

const DEFAULT_GLOBAL_OPTIONS = {
  verbose: false,
  summary: true,
  iterations: 10
};

const log = console.log;

const DEFAULT_OPTIONS = {
  gc: true
};

class Benchmarks {
  constructor(globalOptions, benchDefaultOptions) {
    this.benchs = [];
    this.benchsByGroup = {
      nogroup: []
    };
    this.currentGroup = this.benchsByGroup.nogroup;

    this.options = Object.assign(DEFAULT_GLOBAL_OPTIONS, globalOptions);
    this.benchDefaultOptions = Object.assign(DEFAULT_OPTIONS, benchDefaultOptions);
  }

  add(bench) {
    if (!bench.options) {
      bench.options = this.benchDefaultOptions;
    } else {
      bench.options = Object.assign(this.benchDefaultOptions, bench.options);
    }

    if (!bench.iterations) {
      bench.iterations = this.options.iterations;
    }

    this.benchs.push(bench);
    this.currentGroup.push(bench);

    return this;
  }

  getReport(format = "json") {
    let groups = [];
    let json = {
      groups: groups,
      meanAll: 0,
      sumAll: 0
    };

    Object.entries(this.benchsByGroup).forEach(([groupName, benchmarks]) => {
      if (benchmarks.length === 0) {
        return;
      }

      let group = {
        groupName: groupName,
        benchmarks: [],
        meanAll: 0,
        sumAll: 0
      };

      groups.push(group);

      benchmarks.forEach(bench => {
        const stats = bench.stats.getAll();
        let current = {
          name: bench.name,
          stats: {}
        };
        group.benchmarks.push(current);
        Object.entries(stats).forEach(([key, value]) => {
          current.stats[key] = value;
        });

        group.meanAll += stats.mean;
        group.sumAll += stats.sum;
      });

      json.meanAll += group.meanAll;
      json.sumAll += group.sumAll;
    });
    return json;
  }

  group(name) {
    if (!this.benchsByGroup[name]) {
      this.benchsByGroup[name] = [];
    }

    this.currentGroup = this.benchsByGroup[name];

    return this;
  }

  run() {
    this.benchs.forEach(bench => {
      bench.stats = new PerfStats();
      let context = {};
      if (bench.prepareGlobal) {
        bench.prepareGlobal(context);
      }

      for (let i = 0; i < bench.iterations; i++) {
        if (bench.prepare) {
          bench.prepare(context);
        }

        let t0 = Date.now();
        bench.execute(context);
        let total = Date.now() - t0;
        bench.stats.update(total);

        // @todo Logging options
        if (this.options.verbose) {
          log(
            `${bench.name} ${(i + 1).toString().padStart(2)}/${
              bench.iterations
            }: ${total}ms`
          );
          //  heapUsed: ${process.memoryUsage().heapUsed}
        }

        if (bench.options.gc) {
          global.gc();
        }
      }

      if (this.options.summary || this.options.verbose) {
        let title = `${bench.name} - ${bench.iterations} iterations`;
        const len = title.length;
        log(
          `${"-".repeat(len)}\n${title}\n${"-".repeat(len)}`
        );
        const values = bench.stats.getAll();
        Object.entries(values).forEach(([key, value]) => {
          if (key !== "n") {
            console.log(`- ${key}: ${value.toFixed(2)}`);
          }
        });
        console.log('\n');
      }
    });
  }
}

/**
 * Return the name of a component
 * @param {Component} Component
 * @private
 */

/**
 * Get a key from a list of components
 * @param {Array(Component)} Components Array of components to generate the key
 * @private
 */
function queryKey(Components) {
  var ids = [];
  for (var n = 0; n < Components.length; n++) {
    var T = Components[n];

    if (!componentRegistered(T)) {
      throw new Error(`Tried to create a query with an unregistered component`);
    }

    if (typeof T === "object") {
      var operator = T.operator === "not" ? "!" : T.operator;
      ids.push(operator + T.Component._typeId);
    } else {
      ids.push(T._typeId);
    }
  }

  return ids.sort().join("-");
}

// Detector for browser's "window"
const hasWindow = typeof window !== "undefined";

// performance.now() "polyfill"
const now =
  hasWindow && typeof window.performance !== "undefined"
    ? performance.now.bind(performance)
    : Date.now.bind(Date);

function componentRegistered(T) {
  return (
    (typeof T === "object" && T.Component._typeId !== undefined) ||
    (T.isComponent && T._typeId !== undefined)
  );
}

class SystemManager {
  constructor(world) {
    this._systems = [];
    this._executeSystems = []; // Systems that have `execute` method
    this.world = world;
    this.lastExecutedSystem = null;
  }

  registerSystem(SystemClass, attributes) {
    if (!SystemClass.isSystem) {
      throw new Error(
        `System '${SystemClass.name}' does not extend 'System' class`
      );
    }

    if (this.getSystem(SystemClass) !== undefined) {
      console.warn(`System '${SystemClass.getName()}' already registered.`);
      return this;
    }

    var system = new SystemClass(this.world, attributes);
    if (system.init) system.init(attributes);
    system.order = this._systems.length;
    this._systems.push(system);
    if (system.execute) {
      this._executeSystems.push(system);
      this.sortSystems();
    }
    return this;
  }

  unregisterSystem(SystemClass) {
    let system = this.getSystem(SystemClass);
    if (system === undefined) {
      console.warn(
        `Can unregister system '${SystemClass.getName()}'. It doesn't exist.`
      );
      return this;
    }

    this._systems.splice(this._systems.indexOf(system), 1);

    if (system.execute) {
      this._executeSystems.splice(this._executeSystems.indexOf(system), 1);
    }

    // @todo Add system.unregister() call to free resources
    return this;
  }

  sortSystems() {
    this._executeSystems.sort((a, b) => {
      return a.priority - b.priority || a.order - b.order;
    });
  }

  getSystem(SystemClass) {
    return this._systems.find((s) => s instanceof SystemClass);
  }

  getSystems() {
    return this._systems;
  }

  removeSystem(SystemClass) {
    var index = this._systems.indexOf(SystemClass);
    if (!~index) return;

    this._systems.splice(index, 1);
  }

  executeSystem(system, delta, time) {
    if (system.initialized) {
      if (system.canExecute()) {
        let startTime = now();
        system.execute(delta, time);
        system.executeTime = now() - startTime;
        this.lastExecutedSystem = system;
        system.clearEvents();
      }
    }
  }

  stop() {
    this._executeSystems.forEach((system) => system.stop());
  }

  execute(delta, time, forcePlay) {
    this._executeSystems.forEach(
      (system) =>
        (forcePlay || system.enabled) && this.executeSystem(system, delta, time)
    );
  }

  stats() {
    var stats = {
      numSystems: this._systems.length,
      systems: {},
    };

    for (var i = 0; i < this._systems.length; i++) {
      var system = this._systems[i];
      var systemStats = (stats.systems[system.getName()] = {
        queries: {},
        executeTime: system.executeTime,
      });
      for (var name in system.ctx) {
        systemStats.queries[name] = system.ctx[name].stats();
      }
    }

    return stats;
  }
}

class ObjectPool {
  // @todo Add initial size
  constructor(T, initialSize) {
    this.freeList = [];
    this.count = 0;
    this.T = T;
    this.isObjectPool = true;

    if (typeof initialSize !== "undefined") {
      this.expand(initialSize);
    }
  }

  acquire() {
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
      var clone = new this.T();
      clone._pool = this;
      this.freeList.push(clone);
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
 * @class EventDispatcher
 */
class EventDispatcher {
  constructor() {
    this._listeners = {};
    this.stats = {
      fired: 0,
      handled: 0,
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

class Query {
  /**
   * @param {Array(Component)} Components List of types of components to query
   */
  constructor(Components, manager) {
    this.Components = [];
    this.NotComponents = [];

    Components.forEach((component) => {
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
        included: this.Components.map((C) => C.name),
        not: this.NotComponents.map((C) => C.name),
      },
      numEntities: this.entities.length,
    };
  }

  /**
   * Return stats for this query
   */
  stats() {
    return {
      numComponents: this.Components.length,
      numEntities: this.entities.length,
    };
  }
}

Query.prototype.ENTITY_ADDED = "Query#ENTITY_ADDED";
Query.prototype.ENTITY_REMOVED = "Query#ENTITY_REMOVED";
Query.prototype.COMPONENT_CHANGED = "Query#COMPONENT_CHANGED";

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

class Component {
  constructor(props) {
    if (props !== false) {
      const schema = this.constructor.schema;

      for (const key in schema) {
        if (props && props.hasOwnProperty(key)) {
          this[key] = props[key];
        } else {
          const schemaProp = schema[key];
          if (schemaProp.hasOwnProperty("default")) {
            this[key] = schemaProp.type.clone(schemaProp.default);
          } else {
            const type = schemaProp.type;
            this[key] = type.clone(type.default);
          }
        }
      }

      if (process.env.NODE_ENV !== "production" && props !== undefined) {
        this.checkUndefinedAttributes(props);
      }
    }

    this._pool = null;
  }

  copy(source) {
    const schema = this.constructor.schema;

    for (const key in schema) {
      const prop = schema[key];

      if (source.hasOwnProperty(key)) {
        this[key] = prop.type.copy(source[key], this[key]);
      }
    }

    // @DEBUG
    if (process.env.NODE_ENV !== "production") {
      this.checkUndefinedAttributes(source);
    }

    return this;
  }

  clone() {
    return new this.constructor().copy(this);
  }

  reset() {
    const schema = this.constructor.schema;

    for (const key in schema) {
      const schemaProp = schema[key];

      if (schemaProp.hasOwnProperty("default")) {
        this[key] = schemaProp.type.copy(schemaProp.default, this[key]);
      } else {
        const type = schemaProp.type;
        this[key] = type.copy(type.default, this[key]);
      }
    }
  }

  dispose() {
    if (this._pool) {
      this._pool.release(this);
    }
  }

  getName() {
    return this.constructor.getName();
  }

  checkUndefinedAttributes(src) {
    const schema = this.constructor.schema;

    // Check that the attributes defined in source are also defined in the schema
    Object.keys(src).forEach((srcKey) => {
      if (!schema.hasOwnProperty(srcKey)) {
        console.warn(
          `Trying to set attribute '${srcKey}' not defined in the '${this.constructor.name}' schema. Please fix the schema, the attribute value won't be set`
        );
      }
    });
  }
}

Component.schema = {};
Component.isComponent = true;
Component.getName = function () {
  return this.displayName || this.name;
};

class SystemStateComponent extends Component {}

SystemStateComponent.isSystemStateComponent = true;

class EntityPool extends ObjectPool {
  constructor(entityManager, entityClass, initialSize) {
    super(entityClass, undefined);
    this.entityManager = entityManager;

    if (typeof initialSize !== "undefined") {
      this.expand(initialSize);
    }
  }

  expand(count) {
    for (var n = 0; n < count; n++) {
      var clone = new this.T(this.entityManager);
      clone._pool = this;
      this.freeList.push(clone);
    }
    this.count += count;
  }
}

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
    this._nextEntityId = 0;

    this._entitiesByNames = {};

    this._queryManager = new QueryManager(this);
    this.eventDispatcher = new EventDispatcher();
    this._entityPool = new EntityPool(
      this,
      this.world.options.entityClass,
      this.world.options.entityPoolSize
    );

    // Deferred deletion
    this.entitiesWithComponentsToRemove = [];
    this.entitiesToRemove = [];
    this.deferredRemovalEnabled = true;
  }

  getEntityByName(name) {
    return this._entitiesByNames[name];
  }

  /**
   * Create a new entity
   */
  createEntity(name) {
    var entity = this._entityPool.acquire();
    entity.alive = true;
    entity.name = name || "";
    if (name) {
      if (this._entitiesByNames[name]) {
        console.warn(`Entity name '${name}' already exist`);
      } else {
        this._entitiesByNames[name] = entity;
      }
    }

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
    // @todo Probably define Component._typeId with a default value and avoid using typeof
    if (
      typeof Component._typeId === "undefined" &&
      !this.world.componentsManager._ComponentsMap[Component._typeId]
    ) {
      throw new Error(
        `Attempted to add unregistered component "${Component.getName()}"`
      );
    }

    if (~entity._ComponentTypes.indexOf(Component)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Component type already exists on entity.",
          entity,
          Component.getName()
        );
      }
      return;
    }

    entity._ComponentTypes.push(Component);

    if (Component.__proto__ === SystemStateComponent) {
      entity.numStateComponents++;
    }

    var componentPool = this.world.componentsManager.getComponentsPool(
      Component
    );

    var component = componentPool
      ? componentPool.acquire()
      : new Component(values);

    if (componentPool && values) {
      component.copy(values);
    }

    entity._components[Component._typeId] = component;

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

      entity._componentsToRemove[Component._typeId] =
        entity._components[Component._typeId];
      delete entity._components[Component._typeId];
    }

    // Check each indexed query to see if we need to remove it
    this._queryManager.onEntityComponentRemoved(entity, Component);

    if (Component.__proto__ === SystemStateComponent) {
      entity.numStateComponents--;

      // Check if the entity was a ghost waiting for the last system state component to be removed
      if (entity.numStateComponents === 0 && !entity.alive) {
        entity.remove();
      }
    }
  }

  _entityRemoveComponentSync(entity, Component, index) {
    // Remove T listing on entity and property ref, then free the component.
    entity._ComponentTypes.splice(index, 1);
    var component = entity._components[Component._typeId];
    delete entity._components[Component._typeId];
    component.dispose();
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
    this.entityRemoveAllComponents(entity, immediately);

    if (entity.numStateComponents === 0) {
      // Remove from entity list
      this.eventDispatcher.dispatchEvent(ENTITY_REMOVED, entity);
      this._queryManager.onEntityRemoved(entity);
      if (immediately === true) {
        this._releaseEntity(entity, index);
      } else {
        this.entitiesToRemove.push(entity);
      }
    }
  }

  _releaseEntity(entity, index) {
    this._entities.splice(index, 1);

    if (this._entitiesByNames[entity.name]) {
      delete this._entitiesByNames[entity.name];
    }
    entity._pool.release(entity);
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

        var component = entity._componentsToRemove[Component._typeId];
        delete entity._componentsToRemove[Component._typeId];
        component.dispose();
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
      eventDispatcher: this.eventDispatcher.stats,
    };

    for (var ecsyComponentId in this.componentsManager._componentPool) {
      var pool = this.componentsManager._componentPool[ecsyComponentId];
      stats.componentPool[pool.T.getName()] = {
        used: pool.totalUsed(),
        size: pool.count,
      };
    }

    return stats;
  }
}

const ENTITY_CREATED = "EntityManager#ENTITY_CREATE";
const ENTITY_REMOVED = "EntityManager#ENTITY_REMOVED";
const COMPONENT_ADDED = "EntityManager#COMPONENT_ADDED";
const COMPONENT_REMOVE = "EntityManager#COMPONENT_REMOVE";

class ComponentManager {
  constructor() {
    this.Components = [];
    this._ComponentsMap = {};

    this._componentPool = {};
    this.numComponents = {};
    this.nextComponentId = 0;
  }

  hasComponent(Component) {
    return this.Components.indexOf(Component) !== -1;
  }

  registerComponent(Component, objectPool) {
    if (this.Components.indexOf(Component) !== -1) {
      console.warn(
        `Component type: '${Component.getName()}' already registered.`
      );
      return;
    }

    const schema = Component.schema;

    if (!schema) {
      throw new Error(
        `Component "${Component.getName()}" has no schema property.`
      );
    }

    for (const propName in schema) {
      const prop = schema[propName];

      if (!prop.type) {
        throw new Error(
          `Invalid schema for component "${Component.getName()}". Missing type for "${propName}" property.`
        );
      }
    }

    Component._typeId = this.nextComponentId++;
    this.Components.push(Component);
    this._ComponentsMap[Component._typeId] = Component;
    this.numComponents[Component._typeId] = 0;

    if (objectPool === undefined) {
      objectPool = new ObjectPool(Component);
    } else if (objectPool === false) {
      objectPool = undefined;
    }

    this._componentPool[Component._typeId] = objectPool;
  }

  componentAddedToEntity(Component) {
    this.numComponents[Component._typeId]++;
  }

  componentRemovedFromEntity(Component) {
    this.numComponents[Component._typeId]--;
  }

  getComponentsPool(Component) {
    return this._componentPool[Component._typeId];
  }
}

const Version = "0.3.1";

const proxyMap = new WeakMap();

const proxyHandler = {
  set(target, prop) {
    throw new Error(
      `Tried to write to "${target.constructor.getName()}#${String(
        prop
      )}" on immutable component. Use .getMutableComponent() to modify a component.`
    );
  },
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

class Entity {
  constructor(entityManager) {
    this._entityManager = entityManager || null;

    // Unique ID for this entity
    this.id = entityManager._nextEntityId++;

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

    //if there are state components on a entity, it can't be removed completely
    this.numStateComponents = 0;
  }

  // COMPONENTS

  getComponent(Component, includeRemoved) {
    var component = this._components[Component._typeId];

    if (!component && includeRemoved === true) {
      component = this._componentsToRemove[Component._typeId];
    }

    return process.env.NODE_ENV !== "production"
      ? wrapImmutableComponent(Component, component)
      : component;
  }

  getRemovedComponent(Component) {
    const component = this._componentsToRemove[Component._typeId];

    return process.env.NODE_ENV !== "production"
      ? wrapImmutableComponent(Component, component)
      : component;
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
    var component = this._components[Component._typeId];

    if (!component) {
      return;
    }

    for (var i = 0; i < this.queries.length; i++) {
      var query = this.queries[i];
      // @todo accelerate this check. Maybe having query._Components as an object
      // @todo add Not components
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
    this._entityManager.entityAddComponent(this, Component, values);
    return this;
  }

  removeComponent(Component, forceImmediate) {
    this._entityManager.entityRemoveComponent(this, Component, forceImmediate);
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

  removeAllComponents(forceImmediate) {
    return this._entityManager.entityRemoveAllComponents(this, forceImmediate);
  }

  copy(src) {
    // TODO: This can definitely be optimized
    for (var ecsyComponentId in src._components) {
      var srcComponent = src._components[ecsyComponentId];
      this.addComponent(srcComponent.constructor);
      var component = this.getComponent(srcComponent.constructor);
      component.copy(srcComponent);
    }

    return this;
  }

  clone() {
    return new Entity(this._entityManager).copy(this);
  }

  reset() {
    this.id = this._entityManager._nextEntityId++;
    this._ComponentTypes.length = 0;
    this.queries.length = 0;

    for (var ecsyComponentId in this._components) {
      delete this._components[ecsyComponentId];
    }
  }

  remove(forceImmediate) {
    return this._entityManager.removeEntity(this, forceImmediate);
  }
}

const DEFAULT_OPTIONS$1 = {
  entityPoolSize: 0,
  entityClass: Entity,
};

class World {
  constructor(options = {}) {
    this.options = Object.assign({}, DEFAULT_OPTIONS$1, options);

    this.componentsManager = new ComponentManager(this);
    this.entityManager = new EntityManager(this);
    this.systemManager = new SystemManager(this);

    this.enabled = true;

    this.eventQueues = {};

    if (hasWindow && typeof CustomEvent !== "undefined") {
      var event = new CustomEvent("ecsy-world-created", {
        detail: { world: this, version: Version },
      });
      window.dispatchEvent(event);
    }

    this.lastTime = now() / 1000;
  }

  registerComponent(Component, objectPool) {
    this.componentsManager.registerComponent(Component, objectPool);
    return this;
  }

  registerSystem(System, attributes) {
    this.systemManager.registerSystem(System, attributes);
    return this;
  }

  hasRegisteredComponent(Component) {
    return this.componentsManager.hasComponent(Component);
  }

  unregisterSystem(System) {
    this.systemManager.unregisterSystem(System);
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
      time = now() / 1000;
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

  createEntity(name) {
    return this.entityManager.createEntity(name);
  }

  stats() {
    var stats = {
      entities: this.entityManager.stats(),
      system: this.systemManager.stats(),
    };

    return stats;
  }
}

class TagComponent extends Component {
  constructor() {
    super(false);
  }
}

TagComponent.isTagComponent = true;

const copyValue = (src) => src;

const cloneValue = (src) => src;

const copyArray = (src, dest) => {
  if (!src) {
    return src;
  }

  if (!dest) {
    return src.slice();
  }

  dest.length = 0;

  for (let i = 0; i < src.length; i++) {
    dest.push(src[i]);
  }

  return dest;
};

const cloneArray = (src) => src && src.slice();

const copyJSON = (src) => JSON.parse(JSON.stringify(src));

const cloneJSON = (src) => JSON.parse(JSON.stringify(src));

const copyCopyable = (src, dest) => {
  if (!src) {
    return src;
  }

  if (!dest) {
    return src.clone();
  }

  return dest.copy(src);
};

const cloneClonable = (src) => src && src.clone();

function createType(typeDefinition) {
  var mandatoryProperties = ["name", "default", "copy", "clone"];

  var undefinedProperties = mandatoryProperties.filter((p) => {
    return !typeDefinition.hasOwnProperty(p);
  });

  if (undefinedProperties.length > 0) {
    throw new Error(
      `createType expects a type definition with the following properties: ${undefinedProperties.join(
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
const Types = {
  Number: createType({
    name: "Number",
    default: 0,
    copy: copyValue,
    clone: cloneValue,
  }),

  Boolean: createType({
    name: "Boolean",
    default: false,
    copy: copyValue,
    clone: cloneValue,
  }),

  String: createType({
    name: "String",
    default: "",
    copy: copyValue,
    clone: cloneValue,
  }),

  Array: createType({
    name: "Array",
    default: [],
    copy: copyArray,
    clone: cloneArray,
  }),

  Ref: createType({
    name: "Ref",
    default: undefined,
    copy: copyValue,
    clone: cloneValue,
  }),

  JSON: createType({
    name: "JSON",
    default: null,
    copy: copyJSON,
    clone: cloneJSON,
  }),
};

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
  wrapFunctions.forEach((key) => {
    if (typeof console[key] === "function") {
      var fn = console[key].bind(console);
      console[key] = (...args) => {
        connection.send({
          method: "console",
          type: key,
          args: JSON.stringify(args),
        });
        return fn.apply(null, args);
      };
    }
  });

  window.addEventListener("error", (error) => {
    connection.send({
      method: "error",
      error: JSON.stringify({
        message: error.error.message,
        stack: error.error.stack,
      }),
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
  if (!hasWindow) {
    console.warn("Remote devtools not available outside the browser");
    return;
  }

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
  let onWorldCreated = (e) => {
    var world = e.detail.world;
    Version = e.detail.version;
    worldsBeforeLoading.push(world);
  };
  window.addEventListener("ecsy-world-created", onWorldCreated);

  let onLoaded = () => {
    // var peer = new Peer(remoteId);
    var peer = new Peer(remoteId, {
      host: "peerjs.ecsy.io",
      secure: true,
      port: 443,
      config: {
        iceServers: [
          { url: "stun:stun.l.google.com:19302" },
          { url: "stun:stun1.l.google.com:19302" },
          { url: "stun:stun2.l.google.com:19302" },
          { url: "stun:stun3.l.google.com:19302" },
          { url: "stun:stun4.l.google.com:19302" },
        ],
      },
      debug: 3,
    });

    peer.on("open", (/* id */) => {
      peer.on("connection", (connection) => {
        window.__ECSY_REMOTE_DEVTOOLS.connection = connection;
        connection.on("open", function () {
          // infoDiv.style.visibility = "hidden";
          infoDiv.innerHTML = "Connected";

          // Receive messages
          connection.on("data", function (data) {
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
                worldsBeforeLoading.forEach((world) => {
                  var event = new CustomEvent("ecsy-world-created", {
                    detail: { world: world, version: Version },
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
                  value: value,
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

if (hasWindow) {
  const urlParams = new URLSearchParams(window.location.search);

  // @todo Provide a way to disable it if needed
  if (urlParams.has("enable-remote-devtools")) {
    enableRemoteDevtools();
  }
}

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  copy(source) {
    this.x = source.x;
    this.y = source.y;
    return this;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
}

const Vector3Type = createType({
  name: "Vector3",
  default: new Vector3(),
  copy: copyCopyable,
  clone: cloneClonable
});

class TagComponentA extends TagComponent {}

class Component3 extends Component {
  constructor(props) {
    super(false);
    this.attr = (props && props.attr) || 0;
    this.attr2 = (props && props.attr2) || 0;
    this.attr3 = (props && props.attr3) || new Vector3();
  }

  // copy(source) {
  //   this.attr = source.attr;
  //   this.attr2 = source.attr2;
  //   this.attr3.copy(source.attr3);
  //   return this;
  // }

  // clone() {
  //   return new Component3().copy(this);
  // }

  reset() {
    this.attr = 0;
    this.attr2 = 0;
    this.attr3.set(0, 0, 0);
  }
}
Component3.schema = {
  attr: { type: Types.Number },
  attr2: { type: Types.Number },
  attr3: { type: Vector3Type }
};

function init(benchmarks) {
  benchmarks
    .group("world")
    .add({
      name: "new World({ entityPoolSize: 100k })",
      execute: () => {
        new World({ entityPoolSize: 100000 });
      },
      iterations: 10
    })
    .add({
      name: "World::createEntity (100k empty, recreating world)",
      execute: () => {
        let world = new World();
        for (let i = 0; i < 100000; i++) {
          world.createEntity();
        }
      },
      iterations: 10
    })
    .add({
      name:
        "World::createEntity (100k empty, recreating world (poolSize: 100k))",
      execute: () => {
        let world = new World({ entityPoolSize: 100000 });
        for (let i = 0; i < 100000; i++) {
          world.createEntity();
        }
      },
      iterations: 10
    })
    .add({
      name:
        "World::createEntity (100k empty, recreating world (not measured), entityPoolSize = 100k)",
      prepare: ctx => {
        ctx.world = new World({ entityPoolSize: 100000 });
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity();
        }
      },
      iterations: 10
    })
    .add({
      name:
        "World::createEntity(name) (100k empty, recreating world (not measured), entityPoolSize = 100k)",
      prepare: ctx => {
        ctx.world = new World({ entityPoolSize: 100000 });
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity("name" + i);
        }
      },
      iterations: 10
    })
    .add({
      name:
        "World::createEntity (100k empty, reuse world, entityPoolSize = 100k * 10)",
      prepareGlobal: ctx => {
        ctx.world = new World({ entityPoolSize: 100000 * 10 });
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity();
        }
      },
      iterations: 10
    });
}

function init$1(benchmarks) {
  benchmarks
    .group("objectpool")
    .add({
      name: "new ObjectPool(TagComponent, 100k)",
      execute: () => {
        new ObjectPool(TagComponentA, 100000);
      }
    })
    .add({
      name: "new ObjectPool(Component1, 100k)",
      execute: () => {
        new ObjectPool(Component3, 100000);
      }
    });
    /*
    .add({
      name: "acquiring 100k. ObjectPool(Component1, 100k)",
      prepare: ctx => {
        ctx.pool = new ObjectPool(Component3, 100000);
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.pool.acquire();
        }
      }
    })
    .add({
      name: "acquiring 100k. ObjectPool(Component1)",
      prepare: ctx => {
        ctx.pool = new ObjectPool(Component3);
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.pool.acquire();
        }
      }
    })
    .add({
      name: "returning 100k. ObjectPool(Component1)",
      prepare: ctx => {
        ctx.pool = new ObjectPool(Component3);
        ctx.components = [];
        for (let i = 0; i < 100000; i++) {
          ctx.components.push(ctx.pool.acquire());
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.pool.release(ctx.components[i]);
        }
      }
    });
    */
}

const div = document.getElementById("results");

let currentTable = null;
let currentGroup = null;

function onGroupStart(groupName) {
  var title = document.createElement("div");
  title.setAttribute("class", "table-title");
  title.innerHTML = `<h3>${groupName}</h3>`;
  div.appendChild(title);

  currentTable = document.createElement("table");
  currentTable.setAttribute("class", "table-fill");

  let headCells = [
    "benchmark",
    "iterations",
    "min",
    "max",
    "sum",
    "mean",
    "variance",
    "std_deviation"
  ]
    .map(name => `<th>${name}</th>`)
    .join("");

  currentTable.innerHTML = `<thead>
  <tr>
    ${headCells}
  </tr>
  </thead><tbody></tbody>`;
  div.appendChild(currentTable);

  currentGroup = groupName;
}

function onBenchmarkFinished(bench) {
  if (currentGroup !== bench.groupName) {
    onGroupStart(bench.groupName);
  }

  const values = bench.stats.getAll();

  const tbody = currentTable.querySelector("tbody");

  let rowHtml = `<td>${bench.name}</td><td>${bench.iterations}</td>`;

  const toFixed = ["mean", "variance", "standard_deviation"];
  Object.entries(values).forEach(([key, value]) => {
    if (key !== "n") {
      if (toFixed.indexOf(key) !== -1) {
        value = value.toFixed(2);
      }
      rowHtml += `<td>${value}</td>`;
    }
  });

  let row = document.createElement("tr");
  row.innerHTML = rowHtml;
  tbody.appendChild(row);
}

let benchmarks = new Benchmarks({
  //  verbose: true,
  summary: true,
  iterations: 10,
  onBenchmarkFinished: onBenchmarkFinished
});

init(benchmarks);
//initEntities(benchmarks);
init$1(benchmarks);
//initComponents(benchmarks);
benchmarks.run();

console.log(benchmarks.getReport("json"));
