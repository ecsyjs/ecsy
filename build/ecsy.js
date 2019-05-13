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
	    this.systems = [];
	    this.world = world;
	  }

	  registerSystem(System) {
	    this.systems.push(new System(this.world));
	    return this;
	  }

	  removeSystem(System) {
	    var index = this.systems.indexOf(System);
	    if (!~index) return;

	    this.systems.splice(index, 1);
	  }

	  tick(delta, time) {
	    this.systems.forEach(system => {
	      if (system.enabled && system.tick) {
	        system.tick(delta, time);
	      }
	    });
	  }

	  stats() {
	    var stats = {
	      numSystems: this.systems.length,
	      systems: {}
	    };

	    for (var i = 0; i < this.systems.length; i++) {
	      var system = this.systems[i];
	      var systemStats = (stats.systems[system.constructor.name] = {
	        groups: {}
	      });
	      for (var name in system.ctx) {
	        systemStats.groups[name] = system.ctx[name].stats();
	      }
	    }

	    return stats;
	  }
	}

	class Entity {
	  constructor(manager) {
	    this._manager = manager || null;
	    this.id = nextId++;
	    this._Components = [];
	    this._tags = [];
	  }

	  //---------------------------------------------------------------------------
	  // COMPONENTS
	  //---------------------------------------------------------------------------
	  addComponent(Component, values) {
	    this._manager.entityAddComponent(this, Component, values);
	    return this;
	  }

	  removeComponent(Component) {
	    this._manager.entityRemoveComponent(this, Component);
	    return this;
	  }

	  hasComponent(Component) {
	    return !!~this._Components.indexOf(Component);
	  }

	  hasAllComponents(Components) {
	    var result = true;

	    for (var i = 0; i < Components.length; i++) {
	      result = result && !!~this._Components.indexOf(Components[i]);
	    }

	    return result;
	  }

	  removeAllComponents() {
	    return this._manager.entityRemoveAllComponents(this);
	  }

	  //---------------------------------------------------------------------------
	  // TAGS
	  //---------------------------------------------------------------------------

	  hasTag(tag) {
	    return !!~this._tags.indexOf(tag);
	  }

	  addTag(tag) {
	    this._manager.entityAddTag(this, tag);
	    return this;
	  }

	  removeTag(tag) {
	    this._manager.entityRemoveTag(this, tag);
	    return this;
	  }

	  //---------------------------------------------------------------------------
	  // EXTRAS
	  //---------------------------------------------------------------------------
	  __init() {
	    this.id = nextId++;
	    this._manager = null;
	    this._Components.length = 0;
	    this._tags.length = 0;
	  }

	  trigger(eventName, option) {
	    this._manager.trigger(eventName, this, option);
	  }

	  dispose() {
	    return this._manager.removeEntity(this);
	  }
	}

	var nextId = 0;

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

	class Group {
	  constructor(Components) {
	    this.Components = Components;
	    this.entities = [];
	  }

	  stats() {
	    return {
	      numComponents: this.Components.length,
	      numEntities: this.entities.length
	    };
	  }
	}

	class GroupManager {
	  constructor(manager) {
	    this._manager = manager;
	    this._groups = {};
	  }

	  addEntity(entity, Component) {
	    // Check each indexed group to see if we need to add this entity to the list
	    for (var groupName in this._groups) {
	      var group = this._groups[groupName];

	      // Add the entity only if:
	      // Component is in the group
	      if (!~group.Components.indexOf(Component)) continue;

	      // && Entity has ALL the components of the group
	      if (!entity.hasAllComponents(group.Components)) continue;

	      // && Entity is not already in the group
	      if (~group.entities.indexOf(entity)) continue;

	      group.entities.push(entity);
	    }
	  }

	  removeEntity(entity, Component) {
	    for (var groupName in this._groups) {
	      var group = this._groups[groupName];

	      if (!~group.Components.indexOf(Component)) continue;
	      if (!entity.hasAllComponents(group.Components)) continue;

	      var loc = group.entities.indexOf(entity);
	      if (~loc) {
	        group.entities.splice(loc, 1);
	      }
	    }
	  }

	  _createGroup(Components) {
	    var key = groupKey(Components);

	    if (this._groups[key]) return;

	    var group = (this._groups[key] = new Group(Components));

	    // Fill the group with the existing entities
	    for (var n = 0; n < this._manager._entities.length; n++) {
	      var entity = this._manager._entities[n];
	      if (entity.hasAllComponents(Components)) {
	        group.entities.push(entity);
	      }
	    }

	    return group;
	  }

	  getGroup(Components) {
	    var group = this._groups[groupKey(Components)];
	    if (!group) {
	      group = this._createGroup(Components);
	    }
	    return group;
	  }

	  stats() {
	    var stats = {};
	    for (var groupName in this._groups) {
	      stats[groupName] = this._groups[groupName].stats();
	    }
	    return stats;
	  }
	}

	function getName(Component) {
	  return Component.name;
	}

	function groupKey(Components) {
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

	class EventDispatcher {
	  constructor() {
	    this._listeners = {};
	    this.stats = {
	      fired: 0,
	      handled: 0
	    };
	  }

	  addEventListener(eventName, listener) {
	    let listeners = this._listeners;
	    if (listeners[eventName] === undefined) {
	      listeners[eventName] = [];
	    }

	    if (listeners[eventName].indexOf(listener) === -1) {
	      listeners[eventName].push(listener);
	    }
	  }

	  hasEventListener(eventName, listener) {
	    return (
	      this._listeners[eventName] !== undefined &&
	      this._listeners[eventName].indexOf(listener) !== -1
	    );
	  }

	  removeEventListener(eventName, listener) {
	    var listenerArray = this._listeners[eventName];
	    if (listenerArray !== undefined) {
	      var index = listenerArray.indexOf(listener);
	      if (index !== -1) {
	        listenerArray.splice(index, 1);
	      }
	    }
	  }

	  dispatchEvent(eventName /*, entity, option*/) {
	    this.stats.fired++;

	    var listenerArray = this._listeners[eventName];
	    if (listenerArray !== undefined) {
	      var array = listenerArray.slice(0);

	      for (var i = 0; i < array.length; i++) {
	        array[i].call(this, event);
	      }
	    }
	  }

	  resetCounters() {
	    this.stats.fired = this.stats.handled = 0;
	  }
	}

	class EntityManager {
	  constructor() {
	    this._entities = [];
	    this._componentPool = [];
	    this._groupManager = new GroupManager(this);
	    this.eventDispatcher = new EventDispatcher();
	    this._entityPool = new ObjectPool(Entity);
	    this._tags = {};
	  }

	  createEntity() {
	    var entity = this._entityPool.aquire();
	    entity._manager = this;
	    this._entities.push(entity);
	    this.eventDispatcher.dispatchEvent(ENTITY_CREATED, entity);
	    return entity;
	  }

	  //---------------------------------------------------------------------------
	  // COMPONENTS
	  //---------------------------------------------------------------------------
	  entityAddComponent(entity, Component, values) {
	    if (~entity._Components.indexOf(Component)) return;

	    entity._Components.push(Component);

	    var componentPool = this.getComponentsPool(Component);
	    var component = componentPool.aquire();
	    var componentName = componentPropertyName(Component);
	    entity[componentName] = component;
	    if (values) {
	      for (var name in values) {
	        component[name] = values[name];
	      }
	    }

	    this._groupManager.addEntity(entity, Component);

	    this.eventDispatcher.dispatchEvent(COMPONENT_ADDED, entity, Component);
	  }

	  entityRemoveComponent(entity, Component) {
	    var index = entity._Components.indexOf(Component);
	    if (!~index) return;

	    this.eventDispatcher.dispatchEvent(COMPONENT_REMOVE, entity, Component);

	    // Check each indexed group to see if we need to remove it
	    this._groupManager.removeEntity(entity, Component);

	    // Remove T listing on entity and property ref, then free the component.
	    entity._Components.splice(index, 1);
	    var propName = componentPropertyName(Component);
	    var component = entity[propName];
	    delete entity[propName];
	    this._componentPool[propName].release(component);
	  }

	  entityRemoveAllComponents(entity) {
	    let Components = entity._Components;

	    for (let j = Components.length - 1; j >= 0; j--) {
	      var C = Components[j];
	      entity.removeComponent(C);
	    }
	  }

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

	  removeAllEntities() {
	    for (var i = this._entities.length - 1; i >= 0; i--) {
	      this._entities[i].remove();
	    }
	  }

	  //---------------------------------------------------------------------------
	  // TAGS
	  //---------------------------------------------------------------------------
	  removeEntitiesByTag(tag) {
	    var entities = this._tags[tag];

	    if (!entities) return;

	    for (var x = entities.length - 1; x >= 0; x--) {
	      var entity = entities[x];
	      entity.remove();
	    }
	  }

	  entityAddTag(entity, tag) {
	    var entities = this._tags[tag];

	    if (!entities) entities = this._tags[tag] = [];

	    // Don't add if already there
	    if (~entities.indexOf(entity)) return;

	    // Add to our tag index AND the list on the entity
	    entities.push(entity);
	    entity._tags.push(tag);
	  }

	  entityRemoveTag(entity, tag) {
	    var entities = this._tags[tag];
	    if (!entities) return;

	    var index = entities.indexOf(entity);
	    if (!~index) return;

	    // Remove from our index AND the list on the entity
	    entities.splice(index, 1);
	    entity._tags.splice(entity._tags.indexOf(tag), 1);
	  }

	  queryComponents(Components) {
	    return this._groupManager.getGroup(Components);
	  }

	  getComponentsPool(Component) {
	    var componentName = componentPropertyName(Component);

	    if (!this._componentPool[componentName]) {
	      this._componentPool[componentName] = new ObjectPool(Component);
	    }

	    return this._componentPool[componentName];
	  }

	  //---------------------------------------------------------------------------
	  // EXTRAS
	  //---------------------------------------------------------------------------
	  count() {
	    return this._entities.length;
	  }

	  stats() {
	    var stats = {
	      numEntities: this._entities.length,
	      numGroups: Object.keys(this._groupManager._groups).length,
	      groups: this._groupManager.stats(),
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

	function getName$1(Component) {
	  return Component.name;
	}

	function componentPropertyName(Component) {
	  var name = getName$1(Component);
	  return name.charAt(0).toLowerCase() + name.slice(1);
	}

	const ENTITY_CREATED = "EntityManager#createEntity";
	const ENTITY_REMOVE = "EntityManager#ENTITY_REMOVE";
	const COMPONENT_ADDED = "EntityManager#COMPONENT_ADDED";
	const COMPONENT_REMOVE = "EntityManager#COMPONENT_REMOVE";

	class ComponentManager {
	  constructor() {
	    this.Components = {};
	    this.SingletonComponents = {};
	  }

	  registerComponent(Component) {
	    this.Components[Component.name] = Component;
	  }

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
	    this.ctx = {};
	  }

	  stats() {
	    var stats = {
	      entities: this.entityManager.stats(),
	      system: this.systemManager.stats()
	    };

	    console.log(JSON.stringify(stats, null, 2));
	  }

	  registerSingletonComponent(Component) {
	    this.componentsManager.registerSingletonComponent(Component);
	    this.ctx[componentPropertyName$1(Component)] = new Component();
	    return this;
	  }

	  registerComponent(Component) {
	    this.componentsManager.registerComponent(Component);
	    return this;
	  }

	  registerSystem(System) {
	    this.systemManager.registerSystem(System);
	    return this;
	  }

	  tick(delta, time) {
	    this.systemManager.tick(delta, time);
	  }

	  createEntity() {
	    return this.entityManager.createEntity();
	  }
	}

	function getName$2(Component) {
	  return Component.name;
	}

	function componentPropertyName$1(Component) {
	  var name = getName$2(Component);
	  return name.charAt(0).toLowerCase() + name.slice(1);
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

	exports.SchemaTypes = SchemaTypes;
	exports.System = System;
	exports.World = World;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL1N5c3RlbU1hbmFnZXIuanMiLCIuLi9zcmMvRW50aXR5LmpzIiwiLi4vc3JjL09iamVjdFBvb2wuanMiLCIuLi9zcmMvR3JvdXAuanMiLCIuLi9zcmMvR3JvdXBNYW5hZ2VyLmpzIiwiLi4vc3JjL0V2ZW50RGlzcGF0Y2hlci5qcyIsIi4uL3NyYy9FbnRpdHlNYW5hZ2VyLmpzIiwiLi4vc3JjL0NvbXBvbmVudE1hbmFnZXIuanMiLCIuLi9zcmMvV29ybGQuanMiLCIuLi9zcmMvU3lzdGVtLmpzIiwiLi4vc3JjL1NjaGVtYVR5cGVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjbGFzcyBTeXN0ZW1NYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLnN5c3RlbXMgPSBbXTtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gIH1cblxuICByZWdpc3RlclN5c3RlbShTeXN0ZW0pIHtcbiAgICB0aGlzLnN5c3RlbXMucHVzaChuZXcgU3lzdGVtKHRoaXMud29ybGQpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHJlbW92ZVN5c3RlbShTeXN0ZW0pIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLnN5c3RlbXMuaW5kZXhPZihTeXN0ZW0pO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICB0aGlzLnN5c3RlbXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgfVxuXG4gIHRpY2soZGVsdGEsIHRpbWUpIHtcbiAgICB0aGlzLnN5c3RlbXMuZm9yRWFjaChzeXN0ZW0gPT4ge1xuICAgICAgaWYgKHN5c3RlbS5lbmFibGVkICYmIHN5c3RlbS50aWNrKSB7XG4gICAgICAgIHN5c3RlbS50aWNrKGRlbHRhLCB0aW1lKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIG51bVN5c3RlbXM6IHRoaXMuc3lzdGVtcy5sZW5ndGgsXG4gICAgICBzeXN0ZW1zOiB7fVxuICAgIH07XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuc3lzdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN5c3RlbSA9IHRoaXMuc3lzdGVtc1tpXTtcbiAgICAgIHZhciBzeXN0ZW1TdGF0cyA9IChzdGF0cy5zeXN0ZW1zW3N5c3RlbS5jb25zdHJ1Y3Rvci5uYW1lXSA9IHtcbiAgICAgICAgZ3JvdXBzOiB7fVxuICAgICAgfSk7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHN5c3RlbS5jdHgpIHtcbiAgICAgICAgc3lzdGVtU3RhdHMuZ3JvdXBzW25hbWVdID0gc3lzdGVtLmN0eFtuYW1lXS5zdGF0cygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdGF0cztcbiAgfVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgRW50aXR5IHtcbiAgY29uc3RydWN0b3IobWFuYWdlcikge1xuICAgIHRoaXMuX21hbmFnZXIgPSBtYW5hZ2VyIHx8IG51bGw7XG4gICAgdGhpcy5pZCA9IG5leHRJZCsrO1xuICAgIHRoaXMuX0NvbXBvbmVudHMgPSBbXTtcbiAgICB0aGlzLl90YWdzID0gW107XG4gIH1cblxuICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAvLyBDT01QT05FTlRTXG4gIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGFkZENvbXBvbmVudChDb21wb25lbnQsIHZhbHVlcykge1xuICAgIHRoaXMuX21hbmFnZXIuZW50aXR5QWRkQ29tcG9uZW50KHRoaXMsIENvbXBvbmVudCwgdmFsdWVzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHJlbW92ZUNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB0aGlzLl9tYW5hZ2VyLmVudGl0eVJlbW92ZUNvbXBvbmVudCh0aGlzLCBDb21wb25lbnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgaGFzQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHJldHVybiAhIX50aGlzLl9Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KTtcbiAgfVxuXG4gIGhhc0FsbENvbXBvbmVudHMoQ29tcG9uZW50cykge1xuICAgIHZhciByZXN1bHQgPSB0cnVlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBDb21wb25lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHQgPSByZXN1bHQgJiYgISF+dGhpcy5fQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudHNbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICByZW1vdmVBbGxDb21wb25lbnRzKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW5hZ2VyLmVudGl0eVJlbW92ZUFsbENvbXBvbmVudHModGhpcyk7XG4gIH1cblxuICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAvLyBUQUdTXG4gIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgaGFzVGFnKHRhZykge1xuICAgIHJldHVybiAhIX50aGlzLl90YWdzLmluZGV4T2YodGFnKTtcbiAgfVxuXG4gIGFkZFRhZyh0YWcpIHtcbiAgICB0aGlzLl9tYW5hZ2VyLmVudGl0eUFkZFRhZyh0aGlzLCB0YWcpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcmVtb3ZlVGFnKHRhZykge1xuICAgIHRoaXMuX21hbmFnZXIuZW50aXR5UmVtb3ZlVGFnKHRoaXMsIHRhZyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAvLyBFWFRSQVNcbiAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgX19pbml0KCkge1xuICAgIHRoaXMuaWQgPSBuZXh0SWQrKztcbiAgICB0aGlzLl9tYW5hZ2VyID0gbnVsbDtcbiAgICB0aGlzLl9Db21wb25lbnRzLmxlbmd0aCA9IDA7XG4gICAgdGhpcy5fdGFncy5sZW5ndGggPSAwO1xuICB9XG5cbiAgdHJpZ2dlcihldmVudE5hbWUsIG9wdGlvbikge1xuICAgIHRoaXMuX21hbmFnZXIudHJpZ2dlcihldmVudE5hbWUsIHRoaXMsIG9wdGlvbik7XG4gIH1cblxuICBkaXNwb3NlKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW5hZ2VyLnJlbW92ZUVudGl0eSh0aGlzKTtcbiAgfVxufVxuXG52YXIgbmV4dElkID0gMDtcbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIE9iamVjdFBvb2wge1xuICBjb25zdHJ1Y3RvcihUKSB7XG4gICAgdGhpcy5mcmVlTGlzdCA9IFtdO1xuICAgIHRoaXMuY291bnQgPSAwO1xuICAgIHRoaXMuVCA9IFQ7XG5cbiAgICB2YXIgZXh0cmFBcmdzID0gbnVsbDtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGV4dHJhQXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICBleHRyYUFyZ3Muc2hpZnQoKTtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0ZUVsZW1lbnQgPSBleHRyYUFyZ3NcbiAgICAgID8gKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgVCguLi5leHRyYUFyZ3MpO1xuICAgICAgICB9XG4gICAgICA6ICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFQoKTtcbiAgICAgICAgfTtcblxuICAgIHRoaXMuaW5pdGlhbE9iamVjdCA9IHRoaXMuY3JlYXRlRWxlbWVudCgpO1xuICB9XG5cbiAgYXF1aXJlKCkge1xuICAgIC8vIEdyb3cgdGhlIGxpc3QgYnkgMjAlaXNoIGlmIHdlJ3JlIG91dFxuICAgIGlmICh0aGlzLmZyZWVMaXN0Lmxlbmd0aCA8PSAwKSB7XG4gICAgICB0aGlzLmV4cGFuZChNYXRoLnJvdW5kKHRoaXMuY291bnQgKiAwLjIpICsgMSk7XG4gICAgfVxuXG4gICAgdmFyIGl0ZW0gPSB0aGlzLmZyZWVMaXN0LnBvcCgpO1xuXG4gICAgLy8gV2UgY2FuIHByb3ZpZGUgZXhwbGljaXQgaW5pdGluZywgb3RoZXJ3aXNlIHdlIGNvcHkgdGhlIHZhbHVlIG9mIHRoZSBpbml0aWFsIGNvbXBvbmVudFxuICAgIGlmIChpdGVtLl9faW5pdCkgaXRlbS5fX2luaXQoKTtcbiAgICBlbHNlIGlmIChpdGVtLmNvcHkpIGl0ZW0uY29weSh0aGlzLmluaXRpYWxPYmplY3QpO1xuXG4gICAgcmV0dXJuIGl0ZW07XG4gIH1cblxuICByZWxlYXNlKGl0ZW0pIHtcbiAgICB0aGlzLmZyZWVMaXN0LnB1c2goaXRlbSk7XG4gIH1cblxuICBleHBhbmQoY291bnQpIHtcbiAgICBmb3IgKHZhciBuID0gMDsgbiA8IGNvdW50OyBuKyspIHtcbiAgICAgIHRoaXMuZnJlZUxpc3QucHVzaCh0aGlzLmNyZWF0ZUVsZW1lbnQoKSk7XG4gICAgfVxuICAgIHRoaXMuY291bnQgKz0gY291bnQ7XG4gIH1cblxuICB0b3RhbFNpemUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY291bnQ7XG4gIH1cblxuICB0b3RhbEZyZWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuZnJlZUxpc3QubGVuZ3RoO1xuICB9XG5cbiAgdG90YWxVc2VkKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50IC0gdGhpcy5mcmVlTGlzdC5sZW5ndGg7XG4gIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEdyb3VwIHtcbiAgY29uc3RydWN0b3IoQ29tcG9uZW50cykge1xuICAgIHRoaXMuQ29tcG9uZW50cyA9IENvbXBvbmVudHM7XG4gICAgdGhpcy5lbnRpdGllcyA9IFtdO1xuICB9XG5cbiAgc3RhdHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG51bUNvbXBvbmVudHM6IHRoaXMuQ29tcG9uZW50cy5sZW5ndGgsXG4gICAgICBudW1FbnRpdGllczogdGhpcy5lbnRpdGllcy5sZW5ndGhcbiAgICB9O1xuICB9XG59XG4iLCJpbXBvcnQgR3JvdXAgZnJvbSBcIi4vR3JvdXAuanNcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgR3JvdXBNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3IobWFuYWdlcikge1xuICAgIHRoaXMuX21hbmFnZXIgPSBtYW5hZ2VyO1xuICAgIHRoaXMuX2dyb3VwcyA9IHt9O1xuICB9XG5cbiAgYWRkRW50aXR5KGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgLy8gQ2hlY2sgZWFjaCBpbmRleGVkIGdyb3VwIHRvIHNlZSBpZiB3ZSBuZWVkIHRvIGFkZCB0aGlzIGVudGl0eSB0byB0aGUgbGlzdFxuICAgIGZvciAodmFyIGdyb3VwTmFtZSBpbiB0aGlzLl9ncm91cHMpIHtcbiAgICAgIHZhciBncm91cCA9IHRoaXMuX2dyb3Vwc1tncm91cE5hbWVdO1xuXG4gICAgICAvLyBBZGQgdGhlIGVudGl0eSBvbmx5IGlmOlxuICAgICAgLy8gQ29tcG9uZW50IGlzIGluIHRoZSBncm91cFxuICAgICAgaWYgKCF+Z3JvdXAuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkpIGNvbnRpbnVlO1xuXG4gICAgICAvLyAmJiBFbnRpdHkgaGFzIEFMTCB0aGUgY29tcG9uZW50cyBvZiB0aGUgZ3JvdXBcbiAgICAgIGlmICghZW50aXR5Lmhhc0FsbENvbXBvbmVudHMoZ3JvdXAuQ29tcG9uZW50cykpIGNvbnRpbnVlO1xuXG4gICAgICAvLyAmJiBFbnRpdHkgaXMgbm90IGFscmVhZHkgaW4gdGhlIGdyb3VwXG4gICAgICBpZiAofmdyb3VwLmVudGl0aWVzLmluZGV4T2YoZW50aXR5KSkgY29udGludWU7XG5cbiAgICAgIGdyb3VwLmVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICB9XG4gIH1cblxuICByZW1vdmVFbnRpdHkoZW50aXR5LCBDb21wb25lbnQpIHtcbiAgICBmb3IgKHZhciBncm91cE5hbWUgaW4gdGhpcy5fZ3JvdXBzKSB7XG4gICAgICB2YXIgZ3JvdXAgPSB0aGlzLl9ncm91cHNbZ3JvdXBOYW1lXTtcblxuICAgICAgaWYgKCF+Z3JvdXAuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkpIGNvbnRpbnVlO1xuICAgICAgaWYgKCFlbnRpdHkuaGFzQWxsQ29tcG9uZW50cyhncm91cC5Db21wb25lbnRzKSkgY29udGludWU7XG5cbiAgICAgIHZhciBsb2MgPSBncm91cC5lbnRpdGllcy5pbmRleE9mKGVudGl0eSk7XG4gICAgICBpZiAofmxvYykge1xuICAgICAgICBncm91cC5lbnRpdGllcy5zcGxpY2UobG9jLCAxKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfY3JlYXRlR3JvdXAoQ29tcG9uZW50cykge1xuICAgIHZhciBrZXkgPSBncm91cEtleShDb21wb25lbnRzKTtcblxuICAgIGlmICh0aGlzLl9ncm91cHNba2V5XSkgcmV0dXJuO1xuXG4gICAgdmFyIGdyb3VwID0gKHRoaXMuX2dyb3Vwc1trZXldID0gbmV3IEdyb3VwKENvbXBvbmVudHMpKTtcblxuICAgIC8vIEZpbGwgdGhlIGdyb3VwIHdpdGggdGhlIGV4aXN0aW5nIGVudGl0aWVzXG4gICAgZm9yICh2YXIgbiA9IDA7IG4gPCB0aGlzLl9tYW5hZ2VyLl9lbnRpdGllcy5sZW5ndGg7IG4rKykge1xuICAgICAgdmFyIGVudGl0eSA9IHRoaXMuX21hbmFnZXIuX2VudGl0aWVzW25dO1xuICAgICAgaWYgKGVudGl0eS5oYXNBbGxDb21wb25lbnRzKENvbXBvbmVudHMpKSB7XG4gICAgICAgIGdyb3VwLmVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZ3JvdXA7XG4gIH1cblxuICBnZXRHcm91cChDb21wb25lbnRzKSB7XG4gICAgdmFyIGdyb3VwID0gdGhpcy5fZ3JvdXBzW2dyb3VwS2V5KENvbXBvbmVudHMpXTtcbiAgICBpZiAoIWdyb3VwKSB7XG4gICAgICBncm91cCA9IHRoaXMuX2NyZWF0ZUdyb3VwKENvbXBvbmVudHMpO1xuICAgIH1cbiAgICByZXR1cm4gZ3JvdXA7XG4gIH1cblxuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7fTtcbiAgICBmb3IgKHZhciBncm91cE5hbWUgaW4gdGhpcy5fZ3JvdXBzKSB7XG4gICAgICBzdGF0c1tncm91cE5hbWVdID0gdGhpcy5fZ3JvdXBzW2dyb3VwTmFtZV0uc3RhdHMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldE5hbWUoQ29tcG9uZW50KSB7XG4gIHJldHVybiBDb21wb25lbnQubmFtZTtcbn1cblxuZnVuY3Rpb24gZ3JvdXBLZXkoQ29tcG9uZW50cykge1xuICB2YXIgbmFtZXMgPSBbXTtcbiAgZm9yICh2YXIgbiA9IDA7IG4gPCBDb21wb25lbnRzLmxlbmd0aDsgbisrKSB7XG4gICAgdmFyIFQgPSBDb21wb25lbnRzW25dO1xuICAgIG5hbWVzLnB1c2goZ2V0TmFtZShUKSk7XG4gIH1cblxuICByZXR1cm4gbmFtZXNcbiAgICAubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB4LnRvTG93ZXJDYXNlKCk7XG4gICAgfSlcbiAgICAuc29ydCgpXG4gICAgLmpvaW4oXCItXCIpO1xufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgRXZlbnREaXNwYXRjaGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5fbGlzdGVuZXJzID0ge307XG4gICAgdGhpcy5zdGF0cyA9IHtcbiAgICAgIGZpcmVkOiAwLFxuICAgICAgaGFuZGxlZDogMFxuICAgIH07XG4gIH1cblxuICBhZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICBsZXQgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnROYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgIH1cblxuICAgIGlmIChsaXN0ZW5lcnNbZXZlbnROYW1lXS5pbmRleE9mKGxpc3RlbmVyKSA9PT0gLTEpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudE5hbWVdLnB1c2gobGlzdGVuZXIpO1xuICAgIH1cbiAgfVxuXG4gIGhhc0V2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXS5pbmRleE9mKGxpc3RlbmVyKSAhPT0gLTFcbiAgICApO1xuICB9XG5cbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgdmFyIGxpc3RlbmVyQXJyYXkgPSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXTtcbiAgICBpZiAobGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgaW5kZXggPSBsaXN0ZW5lckFycmF5LmluZGV4T2YobGlzdGVuZXIpO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICBsaXN0ZW5lckFycmF5LnNwbGljZShpbmRleCwgMSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZGlzcGF0Y2hFdmVudChldmVudE5hbWUgLyosIGVudGl0eSwgb3B0aW9uKi8pIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkKys7XG5cbiAgICB2YXIgbGlzdGVuZXJBcnJheSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xuICAgIGlmIChsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBhcnJheSA9IGxpc3RlbmVyQXJyYXkuc2xpY2UoMCk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJyYXlbaV0uY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmVzZXRDb3VudGVycygpIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkID0gdGhpcy5zdGF0cy5oYW5kbGVkID0gMDtcbiAgfVxufVxuIiwiaW1wb3J0IEVudGl0eSBmcm9tIFwiLi9FbnRpdHkuanNcIjtcbmltcG9ydCBPYmplY3RQb29sIGZyb20gXCIuL09iamVjdFBvb2wuanNcIjtcbmltcG9ydCBHcm91cE1hbmFnZXIgZnJvbSBcIi4vR3JvdXBNYW5hZ2VyLmpzXCI7XG5pbXBvcnQgRXZlbnREaXNwYXRjaGVyIGZyb20gXCIuL0V2ZW50RGlzcGF0Y2hlci5qc1wiO1xuXG5leHBvcnQgY2xhc3MgRW50aXR5TWFuYWdlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuX2VudGl0aWVzID0gW107XG4gICAgdGhpcy5fY29tcG9uZW50UG9vbCA9IFtdO1xuICAgIHRoaXMuX2dyb3VwTWFuYWdlciA9IG5ldyBHcm91cE1hbmFnZXIodGhpcyk7XG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIgPSBuZXcgRXZlbnREaXNwYXRjaGVyKCk7XG4gICAgdGhpcy5fZW50aXR5UG9vbCA9IG5ldyBPYmplY3RQb29sKEVudGl0eSk7XG4gICAgdGhpcy5fdGFncyA9IHt9O1xuICB9XG5cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHZhciBlbnRpdHkgPSB0aGlzLl9lbnRpdHlQb29sLmFxdWlyZSgpO1xuICAgIGVudGl0eS5fbWFuYWdlciA9IHRoaXM7XG4gICAgdGhpcy5fZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoRU5USVRZX0NSRUFURUQsIGVudGl0eSk7XG4gICAgcmV0dXJuIGVudGl0eTtcbiAgfVxuXG4gIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIC8vIENPTVBPTkVOVFNcbiAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgZW50aXR5QWRkQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50LCB2YWx1ZXMpIHtcbiAgICBpZiAofmVudGl0eS5fQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkpIHJldHVybjtcblxuICAgIGVudGl0eS5fQ29tcG9uZW50cy5wdXNoKENvbXBvbmVudCk7XG5cbiAgICB2YXIgY29tcG9uZW50UG9vbCA9IHRoaXMuZ2V0Q29tcG9uZW50c1Bvb2woQ29tcG9uZW50KTtcbiAgICB2YXIgY29tcG9uZW50ID0gY29tcG9uZW50UG9vbC5hcXVpcmUoKTtcbiAgICB2YXIgY29tcG9uZW50TmFtZSA9IGNvbXBvbmVudFByb3BlcnR5TmFtZShDb21wb25lbnQpO1xuICAgIGVudGl0eVtjb21wb25lbnROYW1lXSA9IGNvbXBvbmVudDtcbiAgICBpZiAodmFsdWVzKSB7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHZhbHVlcykge1xuICAgICAgICBjb21wb25lbnRbbmFtZV0gPSB2YWx1ZXNbbmFtZV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fZ3JvdXBNYW5hZ2VyLmFkZEVudGl0eShlbnRpdHksIENvbXBvbmVudCk7XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KENPTVBPTkVOVF9BRERFRCwgZW50aXR5LCBDb21wb25lbnQpO1xuICB9XG5cbiAgZW50aXR5UmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgdmFyIGluZGV4ID0gZW50aXR5Ll9Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChDT01QT05FTlRfUkVNT1ZFLCBlbnRpdHksIENvbXBvbmVudCk7XG5cbiAgICAvLyBDaGVjayBlYWNoIGluZGV4ZWQgZ3JvdXAgdG8gc2VlIGlmIHdlIG5lZWQgdG8gcmVtb3ZlIGl0XG4gICAgdGhpcy5fZ3JvdXBNYW5hZ2VyLnJlbW92ZUVudGl0eShlbnRpdHksIENvbXBvbmVudCk7XG5cbiAgICAvLyBSZW1vdmUgVCBsaXN0aW5nIG9uIGVudGl0eSBhbmQgcHJvcGVydHkgcmVmLCB0aGVuIGZyZWUgdGhlIGNvbXBvbmVudC5cbiAgICBlbnRpdHkuX0NvbXBvbmVudHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB2YXIgcHJvcE5hbWUgPSBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KTtcbiAgICB2YXIgY29tcG9uZW50ID0gZW50aXR5W3Byb3BOYW1lXTtcbiAgICBkZWxldGUgZW50aXR5W3Byb3BOYW1lXTtcbiAgICB0aGlzLl9jb21wb25lbnRQb29sW3Byb3BOYW1lXS5yZWxlYXNlKGNvbXBvbmVudCk7XG4gIH1cblxuICBlbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKGVudGl0eSkge1xuICAgIGxldCBDb21wb25lbnRzID0gZW50aXR5Ll9Db21wb25lbnRzO1xuXG4gICAgZm9yIChsZXQgaiA9IENvbXBvbmVudHMubGVuZ3RoIC0gMTsgaiA+PSAwOyBqLS0pIHtcbiAgICAgIHZhciBDID0gQ29tcG9uZW50c1tqXTtcbiAgICAgIGVudGl0eS5yZW1vdmVDb21wb25lbnQoQyk7XG4gICAgfVxuICB9XG5cbiAgcmVtb3ZlRW50aXR5KGVudGl0eSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuX2VudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcblxuICAgIGlmICghfmluZGV4KSB0aHJvdyBuZXcgRXJyb3IoXCJUcmllZCB0byByZW1vdmUgZW50aXR5IG5vdCBpbiBsaXN0XCIpO1xuXG4gICAgdGhpcy5lbnRpdHlSZW1vdmVBbGxDb21wb25lbnRzKGVudGl0eSk7XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBlbnRpdHkgbGlzdFxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoRU5USVRZX1JFTU9WRSwgZW50aXR5KTtcbiAgICB0aGlzLl9lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgLy8gUmVtb3ZlIGVudGl0eSBmcm9tIGFueSB0YWcgZ3JvdXBzIGFuZCBjbGVhciB0aGUgb24tZW50aXR5IHJlZlxuICAgIGVudGl0eS5fdGFncy5sZW5ndGggPSAwO1xuICAgIGZvciAodmFyIHRhZyBpbiB0aGlzLl90YWdzKSB7XG4gICAgICB2YXIgZW50aXRpZXMgPSB0aGlzLl90YWdzW3RhZ107XG4gICAgICB2YXIgbiA9IGVudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcbiAgICAgIGlmICh+bikgZW50aXRpZXMuc3BsaWNlKG4sIDEpO1xuICAgIH1cblxuICAgIC8vIFByZXZlbnQgYW55IGFjZWNzcyBhbmQgZnJlZVxuICAgIGVudGl0eS5tYW5hZ2VyID0gbnVsbDtcbiAgICB0aGlzLl9lbnRpdHlQb29sLnJlbGVhc2UoZW50aXR5KTtcbiAgfVxuXG4gIHJlbW92ZUFsbEVudGl0aWVzKCkge1xuICAgIGZvciAodmFyIGkgPSB0aGlzLl9lbnRpdGllcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdGhpcy5fZW50aXRpZXNbaV0ucmVtb3ZlKCk7XG4gICAgfVxuICB9XG5cbiAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgLy8gVEFHU1xuICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICByZW1vdmVFbnRpdGllc0J5VGFnKHRhZykge1xuICAgIHZhciBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXTtcblxuICAgIGlmICghZW50aXRpZXMpIHJldHVybjtcblxuICAgIGZvciAodmFyIHggPSBlbnRpdGllcy5sZW5ndGggLSAxOyB4ID49IDA7IHgtLSkge1xuICAgICAgdmFyIGVudGl0eSA9IGVudGl0aWVzW3hdO1xuICAgICAgZW50aXR5LnJlbW92ZSgpO1xuICAgIH1cbiAgfVxuXG4gIGVudGl0eUFkZFRhZyhlbnRpdHksIHRhZykge1xuICAgIHZhciBlbnRpdGllcyA9IHRoaXMuX3RhZ3NbdGFnXTtcblxuICAgIGlmICghZW50aXRpZXMpIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddID0gW107XG5cbiAgICAvLyBEb24ndCBhZGQgaWYgYWxyZWFkeSB0aGVyZVxuICAgIGlmICh+ZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpKSByZXR1cm47XG5cbiAgICAvLyBBZGQgdG8gb3VyIHRhZyBpbmRleCBBTkQgdGhlIGxpc3Qgb24gdGhlIGVudGl0eVxuICAgIGVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICBlbnRpdHkuX3RhZ3MucHVzaCh0YWcpO1xuICB9XG5cbiAgZW50aXR5UmVtb3ZlVGFnKGVudGl0eSwgdGFnKSB7XG4gICAgdmFyIGVudGl0aWVzID0gdGhpcy5fdGFnc1t0YWddO1xuICAgIGlmICghZW50aXRpZXMpIHJldHVybjtcblxuICAgIHZhciBpbmRleCA9IGVudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgLy8gUmVtb3ZlIGZyb20gb3VyIGluZGV4IEFORCB0aGUgbGlzdCBvbiB0aGUgZW50aXR5XG4gICAgZW50aXRpZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICBlbnRpdHkuX3RhZ3Muc3BsaWNlKGVudGl0eS5fdGFncy5pbmRleE9mKHRhZyksIDEpO1xuICB9XG5cbiAgcXVlcnlDb21wb25lbnRzKENvbXBvbmVudHMpIHtcbiAgICByZXR1cm4gdGhpcy5fZ3JvdXBNYW5hZ2VyLmdldEdyb3VwKENvbXBvbmVudHMpO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50c1Bvb2woQ29tcG9uZW50KSB7XG4gICAgdmFyIGNvbXBvbmVudE5hbWUgPSBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KTtcblxuICAgIGlmICghdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXSkge1xuICAgICAgdGhpcy5fY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXSA9IG5ldyBPYmplY3RQb29sKENvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudFBvb2xbY29tcG9uZW50TmFtZV07XG4gIH1cblxuICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAvLyBFWFRSQVNcbiAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgY291bnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2VudGl0aWVzLmxlbmd0aDtcbiAgfVxuXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIG51bUVudGl0aWVzOiB0aGlzLl9lbnRpdGllcy5sZW5ndGgsXG4gICAgICBudW1Hcm91cHM6IE9iamVjdC5rZXlzKHRoaXMuX2dyb3VwTWFuYWdlci5fZ3JvdXBzKS5sZW5ndGgsXG4gICAgICBncm91cHM6IHRoaXMuX2dyb3VwTWFuYWdlci5zdGF0cygpLFxuICAgICAgbnVtQ29tcG9uZW50UG9vbDogT2JqZWN0LmtleXModGhpcy5fY29tcG9uZW50UG9vbCkubGVuZ3RoLFxuICAgICAgY29tcG9uZW50UG9vbDoge30sXG4gICAgICBldmVudERpc3BhdGNoZXI6IHRoaXMuZXZlbnREaXNwYXRjaGVyLnN0YXRzXG4gICAgfTtcblxuICAgIGZvciAodmFyIGNuYW1lIGluIHRoaXMuX2NvbXBvbmVudFBvb2wpIHtcbiAgICAgIHZhciBwb29sID0gdGhpcy5fY29tcG9uZW50UG9vbFtjbmFtZV07XG4gICAgICBzdGF0cy5jb21wb25lbnRQb29sW2NuYW1lXSA9IHtcbiAgICAgICAgdXNlZDogcG9vbC50b3RhbFVzZWQoKSxcbiAgICAgICAgc2l6ZTogcG9vbC5jb3VudFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0TmFtZShDb21wb25lbnQpIHtcbiAgcmV0dXJuIENvbXBvbmVudC5uYW1lO1xufVxuXG5mdW5jdGlvbiBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KSB7XG4gIHZhciBuYW1lID0gZ2V0TmFtZShDb21wb25lbnQpO1xuICByZXR1cm4gbmFtZS5jaGFyQXQoMCkudG9Mb3dlckNhc2UoKSArIG5hbWUuc2xpY2UoMSk7XG59XG5cbmNvbnN0IEVOVElUWV9DUkVBVEVEID0gXCJFbnRpdHlNYW5hZ2VyI2NyZWF0ZUVudGl0eVwiO1xuY29uc3QgRU5USVRZX1JFTU9WRSA9IFwiRW50aXR5TWFuYWdlciNFTlRJVFlfUkVNT1ZFXCI7XG5jb25zdCBDT01QT05FTlRfQURERUQgPSBcIkVudGl0eU1hbmFnZXIjQ09NUE9ORU5UX0FEREVEXCI7XG5jb25zdCBDT01QT05FTlRfUkVNT1ZFID0gXCJFbnRpdHlNYW5hZ2VyI0NPTVBPTkVOVF9SRU1PVkVcIjtcbiIsImV4cG9ydCBjbGFzcyBDb21wb25lbnRNYW5hZ2VyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5Db21wb25lbnRzID0ge307XG4gICAgdGhpcy5TaW5nbGV0b25Db21wb25lbnRzID0ge307XG4gIH1cblxuICByZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB0aGlzLkNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gQ29tcG9uZW50O1xuICB9XG5cbiAgcmVnaXN0ZXJTaW5nbGV0b25Db21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5TaW5nbGV0b25Db21wb25lbnRzW0NvbXBvbmVudC5uYW1lXSA9IENvbXBvbmVudDtcbiAgfVxufSIsImltcG9ydCB7IFN5c3RlbU1hbmFnZXIgfSBmcm9tIFwiLi9TeXN0ZW1NYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBFbnRpdHlNYW5hZ2VyIH0gZnJvbSBcIi4vRW50aXR5TWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgQ29tcG9uZW50TWFuYWdlciB9IGZyb20gXCIuL0NvbXBvbmVudE1hbmFnZXIuanNcIjtcblxuZXhwb3J0IGNsYXNzIFdvcmxkIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5lbnRpdHlNYW5hZ2VyID0gbmV3IEVudGl0eU1hbmFnZXIoKTtcbiAgICB0aGlzLnN5c3RlbU1hbmFnZXIgPSBuZXcgU3lzdGVtTWFuYWdlcih0aGlzKTtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyID0gbmV3IENvbXBvbmVudE1hbmFnZXIodGhpcyk7XG5cbiAgICAvLyBTdG9yYWdlIGZvciBzaW5nbGV0b24gY29tcG9uZW50c1xuICAgIHRoaXMuY3R4ID0ge307XG4gIH1cblxuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBlbnRpdGllczogdGhpcy5lbnRpdHlNYW5hZ2VyLnN0YXRzKCksXG4gICAgICBzeXN0ZW06IHRoaXMuc3lzdGVtTWFuYWdlci5zdGF0cygpXG4gICAgfTtcblxuICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHN0YXRzLCBudWxsLCAyKSk7XG4gIH1cblxuICByZWdpc3RlclNpbmdsZXRvbkNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB0aGlzLmNvbXBvbmVudHNNYW5hZ2VyLnJlZ2lzdGVyU2luZ2xldG9uQ29tcG9uZW50KENvbXBvbmVudCk7XG4gICAgdGhpcy5jdHhbY29tcG9uZW50UHJvcGVydHlOYW1lKENvbXBvbmVudCldID0gbmV3IENvbXBvbmVudCgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRzTWFuYWdlci5yZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtKSB7XG4gICAgdGhpcy5zeXN0ZW1NYW5hZ2VyLnJlZ2lzdGVyU3lzdGVtKFN5c3RlbSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICB0aWNrKGRlbHRhLCB0aW1lKSB7XG4gICAgdGhpcy5zeXN0ZW1NYW5hZ2VyLnRpY2soZGVsdGEsIHRpbWUpO1xuICB9XG5cbiAgY3JlYXRlRW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLmVudGl0eU1hbmFnZXIuY3JlYXRlRW50aXR5KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0TmFtZShDb21wb25lbnQpIHtcbiAgcmV0dXJuIENvbXBvbmVudC5uYW1lO1xufVxuXG5mdW5jdGlvbiBjb21wb25lbnRQcm9wZXJ0eU5hbWUoQ29tcG9uZW50KSB7XG4gIHZhciBuYW1lID0gZ2V0TmFtZShDb21wb25lbnQpO1xuICByZXR1cm4gbmFtZS5jaGFyQXQoMCkudG9Mb3dlckNhc2UoKSArIG5hbWUuc2xpY2UoMSk7XG59XG4iLCJleHBvcnQgY2xhc3MgU3lzdGVtIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgICB0aGlzLnF1ZXJ5Q29tcG9uZW50cyA9IHRoaXMuaW5pdCA/IHRoaXMuaW5pdCgpIDogbnVsbDtcbiAgICB0aGlzLl9xdWVyaWVzID0ge307XG4gICAgdGhpcy5xdWVyaWVzID0ge307XG5cbiAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMucXVlcnlDb21wb25lbnRzKSB7XG4gICAgICB2YXIgQ29tcG9uZW50cyA9IHRoaXMucXVlcnlDb21wb25lbnRzW25hbWVdO1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy53b3JsZC5lbnRpdHlNYW5hZ2VyLnF1ZXJ5Q29tcG9uZW50cyhDb21wb25lbnRzKTtcbiAgICAgIHRoaXMuX3F1ZXJpZXNbbmFtZV0gPSBxdWVyeTtcbiAgICAgIHRoaXMucXVlcmllc1tuYW1lXSA9IHF1ZXJ5LmVudGl0aWVzO1xuICAgIH1cbiAgfVxufVxuIiwiY2xhc3MgRmxvYXRWYWxpZGF0b3Ige1xuICBzdGF0aWMgdmFsaWRhdGUobikge1xuICAgIHJldHVybiBOdW1iZXIobikgPT09IG4gJiYgbiAlIDEgIT09IDA7XG4gIH1cbn1cblxudmFyIFNjaGVtYVR5cGVzID0ge1xuICBmbG9hdDogRmxvYXRWYWxpZGF0b3JcbiAgLypcbiAgYXJyYXlcbiAgYm9vbFxuICBmdW5jXG4gIG51bWJlclxuICBvYmplY3RcbiAgc3RyaW5nXG4gIHN5bWJvbFxuXG4gIGFueVxuICBhcnJheU9mXG4gIGVsZW1lbnRcbiAgZWxlbWVudFR5cGVcbiAgaW5zdGFuY2VPZlxuICBub2RlXG4gIG9iamVjdE9mXG4gIG9uZU9mXG4gIG9uZU9mVHlwZVxuICBzaGFwZVxuICBleGFjdFxuKi9cbn07XG5cbmV4cG9ydCB7IFNjaGVtYVR5cGVzIH07XG4iXSwibmFtZXMiOlsiZ2V0TmFtZSIsImNvbXBvbmVudFByb3BlcnR5TmFtZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Q0FBTyxNQUFNLGFBQWEsQ0FBQztDQUMzQixFQUFFLFdBQVcsQ0FBQyxLQUFLLEVBQUU7Q0FDckIsSUFBSSxJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztDQUN0QixJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0NBQ3ZCLEdBQUc7O0NBRUgsRUFBRSxjQUFjLENBQUMsTUFBTSxFQUFFO0NBQ3pCLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7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
