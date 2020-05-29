import { SystemManager } from "./SystemManager.js";
import { EntityManager } from "./EntityManager.js";
import { ComponentManager } from "./ComponentManager.js";
import { Version } from "./Version.js";
import { hasWindow, now } from "./Utils.js";
import { Entity } from "./Entity.js";
<<<<<<< HEAD

const DEFAULT_OPTIONS = {
  entityPoolSize: 0,
  entityClass: Entity
};
=======
>>>>>>> Export Entity as _Entity and allow parameter to be set in World constructor

const DEFAULT_OPTIONS = {
  entityPoolSize: 0,
  entityClass: Entity
};

export class World {
  constructor(options = {}) {
<<<<<<< HEAD
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
=======
    this.options = Object.assign(DEFAULT_OPTIONS, options);
>>>>>>> Added options to the world. entityPoolSize

    this.componentsManager = new ComponentManager(this);
    this.entityManager = new EntityManager(this);
    this.systemManager = new SystemManager(this);

    this.enabled = true;

    this.eventQueues = {};

    if (hasWindow && typeof CustomEvent !== "undefined") {
      var event = new CustomEvent("ecsy-world-created", {
        detail: { world: this, version: Version }
      });
      window.dispatchEvent(event);
    }

    this.lastTime = now();
  }

  registerComponent(Component, objectPool) {
    this.componentsManager.registerComponent(Component, objectPool);
    return this;
  }

  registerSystem(System, attributes) {
    this.systemManager.registerSystem(System, attributes);
    return this;
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
      time = now();
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
      system: this.systemManager.stats()
    };

    console.log(JSON.stringify(stats, null, 2));
  }
}
