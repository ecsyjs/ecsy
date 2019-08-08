import { SystemManager } from "./SystemManager.js";
import { EntityManager } from "./EntityManager.js";
import { ComponentManager } from "./ComponentManager.js";
import EventDispatcher from "./EventDispatcher.js";
import Entity from "./Entity.js";

/**
 * @class World
 */
export class World {
  constructor() {
    this.componentsManager = new ComponentManager(this);
    this.entityManager = new EntityManager(this);
    this.systemManager = new SystemManager(this);

    this.enabled = true;

    // "Singleton" entity to store world components
    // Created directly to avoid using pooling and interfere with
    // the rest of the components and alter stats
    // this._entity = this.createEntity();
    this._entity = new Entity(this.entityManager);
    this.entityManager._entities.push(this._entity);

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
   * Add a component to the world's entity
   * @param {Component} Component component
   */
  addComponent(Component) {
    this._entity.addComponent(Component);
    return this;
  }

  removeComponent(Component, forceRemove) {
    this._entity.removeComponent(Component, forceRemove);
    return this;
  }

  getComponent(Component) {
    return this._entity.getComponent(Component);
  }

  getMutableComponent(Component) {
    return this._entity.getMutableComponent(Component);
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
