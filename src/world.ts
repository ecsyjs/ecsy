import { ComponentManager } from './component';
import { ComponentConstructor } from './component.interface';
import { Entity, EntityManager } from './entity';
import { QueryManager } from './entity/query-manager';
import { System, SystemManager } from './system';
import { SystemConstructor } from './system.interface';

/**
 * The World is the root of the ECS.
 */
export class World {

  enabled = true;

  eventQueues = {};

  lastTime = performance.now();

  /**
   * Create a new World.
   */
  constructor(
    public componentsManager = new ComponentManager(),
    public entityManager = new EntityManager(componentsManager, new QueryManager()),
    public systemManager = new SystemManager(entityManager),
  ) {}

  /**
   * Register a component.
   * @param component Type of component to register
   */
  registerComponent(component: ComponentConstructor): this {
    this.componentsManager.registerComponent(component);

    return this;
  }

  /**
   * Register a system.
   * @param system Type of system to register
   */
  registerSystem<T extends System>(system: SystemConstructor<T>, attributes?: any): this {
    this.systemManager.registerSystem(system, attributes);

    return this;
  }

  /**
   * Get a system registered in this world.
   * @param System Type of system to get.
   */
  getSystem<T extends System>(SystemClass: SystemConstructor<T>): System {
    return this.systemManager.getSystem(SystemClass);
  }

  /**
   * Get a list of systems registered in this world.
   */
  getSystems(): Map<SystemConstructor<any>, System> {
    return this.systemManager.getSystems();
  }

  /**
   * Update the systems.
   */
  run(): void {
    if (this.enabled) {
      this.systemManager.run();
      this.entityManager.processDeferredRemoval();
    }
  }

  /**
   * Stop execution of this world.
   */
  stop(): void {
    this.enabled = false;
  }

  /**
   * Resume execution of this world.
   */
  play(): void {
    this.enabled = true;
  }

  /**
   * Create a new entity
   */
  createEntity(): Entity {
    return this.entityManager.createEntity();
  }

  stats() {
    const stats = {
      entities: this.entityManager.stats(),
      system: this.systemManager.stats()
    };

    console.log(JSON.stringify(stats, null, 2));
  }
}
