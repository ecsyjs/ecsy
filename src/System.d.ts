import {Component, ComponentConstructor} from "./Component";

/**
 * A system that manipulates entities in the world.
 */
export abstract class System {
  /**
   * Defines what Components the System will query for.
   * This needs to be user defined.
  */
  static queries: {
    [queryName: string]: Component[],
  };
  /**
   * Whether the system will execute during the world tick.
   */
  enabled: boolean;
  /**
   * Resume execution of this system.
   */
  play(): void;

  /**
   * Stop execution of this system.
   */
  stop(): void;

  /**
   * This function is called for each run of world.
   * All of the `queries` defined on the class are available here.
   * @param delta
   * @param time
   */
  abstract execute(delta: number, time: number): void;
}

export interface SystemConstructor<T extends System> {
  new (...args: any): T;
}

/**
 * Use the Not class to negate a component query.
 */
export function Not<T>(Component:ComponentConstructor<T>):object
