import { Component, ComponentConstructor } from "./Component";
import { System, SystemConstructor } from "./System";
import { Entity } from "./Entity";

interface Options {
  entityPoolSize?: number;
  [propName: string]: any;
}

/**
 * The World is the root of the ECS.
 */
export class World {
  /**
   * Whether the world tick should execute.
   */
  enabled:boolean;

  /**
   * Create a new World.
   */
  constructor(options?: Options);

  /**
   * Register a component.
   * @param Component Type of component to register
   */
  registerComponent<T extends Component>(Component:ComponentConstructor<T>): this;

  /**
   * Register a system.
   * @param System Type of system to register
   */
  registerSystem<T extends System>(System:SystemConstructor<T>, attributes?: object): this;

  /**
   * Get a system registered in this world.
   * @param System Type of system to get.
   */
  getSystem<T extends System>(System:SystemConstructor<T>):System;

  /**
   * Get a list of systems registered in this world.
   */
  getSystems():Array<System>;

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
  createEntity(name?: string):Entity
}
