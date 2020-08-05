import {Component, ComponentConstructor} from "./Component";
import { Entity } from "./Entity";
import { World } from "./World";

interface Attributes {
  priority?: number;
  [propName: string]: any;
}

export interface SystemQueryDefinitions  {
  [queryName: string]: {
    components: (ComponentConstructor<any> | NotComponent<any>)[],
    listen?: {
      added?: boolean,
      removed?: boolean,
      changed?: boolean | ComponentConstructor<any>[],
    },
  }
}

export interface SystemQueryResults<Q extends (Component<any> | undefined) = undefined> {
  results: Entity<Q>[],
  added?: Entity<Q>[],
  removed?: Entity<undefined>[],
  changed?: Entity<Q>[],
}

/**
 * A system that manipulates entities in the world.
 */
export abstract class System<S extends { queries: SystemQueryDefinitions }> {
  /**
   * Defines what Components the System will query for.
   * This needs to be user defined.
   */
  static queries: SystemQueryDefinitions;

  static isSystem: true;

  constructor(world: World, attributes?: Attributes);

  /**
   * The results of the queries.
   * Should be used inside of execute.
   */
  queries: { [K in keyof S["queries"]]: SystemQueryResults<InstanceType<Extract<S["queries"][K]["components"][number], ComponentConstructor<Component<any>>>> | undefined> }

  world: World;
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

export interface SystemConstructor<T extends System<any>> {
  isSystem: true;
  queries: SystemQueryDefinitions;
  new (...args: any): T;
}

export interface NotComponent<C extends Component<any>> {
  type: "not",
  Component: ComponentConstructor<C>
}

/**
 * Use the Not class to negate a component query.
 */
export function Not<C extends Component<any>>(Component: ComponentConstructor<C>): NotComponent<C>;