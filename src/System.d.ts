import {Component, ComponentConstructor} from "./Component";

/**
 * A system that manipulates entities in the world.
 */
export abstract class System {
  /**
   * Resume execution of this system.
   */
  play():void

  /**
   * Stop execution of this system.
   */
  stop():void
}

export interface SystemConstructor<T extends System> {
  new (...args: any): T;
}

/**
 * Use the Not class to negate a component query.
 */
export function Not<T>(Component:ComponentConstructor<T>):object
