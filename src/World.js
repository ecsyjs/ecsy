import { SystemManager } from "./SystemManager.js";
import { EntityManager } from "./EntityManager.js";
import { ComponentManager } from "./ComponentManager.js";

export class World {
  constructor() {
    this.componentsManager = new ComponentManager(this);
    this.entityManager = new EntityManager(this);
    this.systemManager = new SystemManager(this);

    this.enabled = true;

    this.eventQueues = {};

    if (typeof CustomEvent !== "undefined") {
      var event = new CustomEvent("ecsy-world-created", { detail: this });
      window.dispatchEvent(event);
    }
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
