import { SystemManager } from "./SystemManager.js";
import { EntityManager } from "./EntityManager.js";
import { ComponentManager } from "./ComponentManager.js";

export class World {
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
    this.ctx[componentPropertyName(Component)] = new Component();
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

function getName(Component) {
  return Component.name;
}

function componentPropertyName(Component) {
  var name = getName(Component);
  return name.charAt(0).toLowerCase() + name.slice(1);
}
