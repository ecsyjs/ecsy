import {Component, ComponentConstructor} from "./Component";
import { Entity } from "./Entity";
import { World } from "./World";

interface Attributes {
  priority?: number;
  [propName: string]: any;
}

export interface SystemQueries {
  [queryName: string]: {
    components: (ComponentConstructor<any> | NotComponent<any>)[],
    listen?: {
      added?: boolean,
      removed?: boolean,
      changed?: boolean | ComponentConstructor<any>[],
    },
  }
}

/**
 * A system that manipulates entities in the world.
 */
export abstract class System<EntityType extends Entity = Entity> {
  /**
   * Defines what Components the System will query for.
   * This needs to be user defined.
   */
  static queries: SystemQueries;

  static isSystem: true;

  constructor(world: World<EntityType>, attributes?: Attributes);

  /**
   * The results of the queries.
   * Should be used inside of execute.
   */
  queries: {
    [queryName: string]: {
      results: EntityType[],
      added?: EntityType[],
      removed?: EntityType[],
      changed?: EntityType[],
    }
  }

  world: World<EntityType>;

  /**
   * Whether the system will execute during the world tick.
   */
  enabled: boolean;

  /**
   * Execution priority (i.e: order) of the system.
   */
  readonly priority: number;

  /**
   * Called when the system is added to the world.
   */
  init(attributes?: Attributes): void

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
  isSystem: true;
  queries: SystemQueries
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
