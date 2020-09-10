import { Component, ComponentConstructor } from "./Component";
import { System, SystemConstructor } from "./System";
import { Entity } from "./Entity";
import { ObjectPool } from "./ObjectPool";

export interface WorldOptions {
  entityPoolSize?: number;
  [propName: string]: any;
}

/**
 * The World is the root of the ECS.
 */
export class World<EntityType extends Entity = Entity> {

  /**
   * Whether the world tick should execute.
   */
  enabled: boolean;

  /**
   * Create a new World.
   */
  constructor(options?: WorldOptions);

  /**
   * Register a component.
   * @param Component Type of component to register
   */
  registerComponent<C extends Component<any>>(Component: ComponentConstructor<C>, objectPool?: ObjectPool<C> | false): this;

  /**
   * Evluate whether a component has been registered to this world or not.
   * @param Component Type of component to to evaluate
   */
  hasRegisteredComponent<C extends Component<any>>(Component: ComponentConstructor<C>): boolean;

  /**
   * Register a system.
   * @param System Type of system to register
   */
  registerSystem(System: SystemConstructor<any>, attributes?: object): this;

  /**
   * Unregister a system.
   * @param System Type of system to unregister
   */
  unregisterSystem(System: SystemConstructor<any>): this;

  /**
   * Get a system registered in this world.
   * @param System Type of system to get.
   */
  getSystem<S extends System>(System: SystemConstructor<S>): S;

  /**
   * Get a list of systems registered in this world.
   */
  getSystems(): Array<System>;

  /**
   * Update the systems per frame.
   * @param delta Delta time since the last call
   * @param time Elapsed time
   */
  execute(delta?: number, time?: number): void;

  /**
   * Resume execution of this world.
   */
  play(): void

  /**
   * Stop execution of this world.
   */
  stop(): void

  /**
   * Create a new entity
   */
  createEntity(name?: string): EntityType

}
