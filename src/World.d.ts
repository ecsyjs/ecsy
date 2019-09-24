import { Component, ComponentConstructor } from "./Component";
import { System, SystemConstructor } from "./System";
import { Entity } from "./Entity";

/**
 * The World is the root of the ECS.
 */
export class World {
  /**
   * Create a new World.
   */
  constructor();

  /**
   * Register a component.
   * @param Component Type of component to register
   */
  registerComponent<T extends Component>(Component:ComponentConstructor<T>): this;

  /**
   * Register a system.
   * @param System Type of system to register
   */
  registerSystem<T extends System>(System:SystemConstructor<T>): this;

  /**
   * Update the systems per frame.
   * @param delta Delta time since the last call
   * @param time Elapsed time
   */
  execute(delta:number, time:number):void;

  /**
   * Resume execution of this world.
   */
  play():void
 
  /**
   * Stop execution of this world.
   */
  stop():void

  /**
   * Create a new entity
   */
  createEntity():Entity
}
