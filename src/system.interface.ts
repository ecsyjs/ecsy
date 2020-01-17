import { Entity } from './entity';

/**
 * A system that manipulates entities in the world.
 */
export interface System {

  queries: { [key: string]: {
    results: Entity[];
    added?: any[];
    removed?: any[];
    changed?: any[] | any;
  }; };
  queriesOther: any;

  priority?: number;
  order?: number;

  mandatoryQueries: any[];

  /**
   * Whether the system will execute during the world tick.
   */
  enabled: boolean;

  initialized: boolean;
  /**
   * Resume execution of this system.
   */
  play(): void;

  /**
   * Stop execution of this system.
   */
  stop(): void;

  run(): void;

  [key: string]: any;
}

export interface SystemConstructor<T extends System> {
  new (...args: any): T;
  queries: any;
}

