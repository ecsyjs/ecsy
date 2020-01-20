import { ComponentConstructor } from './component.interface';
import { Entity } from './entity';

/**
 * A system that manipulates entities in the world.
 * Every run systems are executed and they create, remove or modify entities and components.
 */
export interface System {

  queries?: { [key: string]: {
    results: Entity[];
    added?: any[];
    removed?: any[];
    changed?: any[] | any;
  }; };
  queriesOther?: any;

  priority?: number;
  order?: number;

  mandatoryQueries?: any[];

  executeTime?: number;

  /**
   * Whether the system will execute during the world tick.
   */
  enabled?: boolean;

  initialized?: boolean;
  /**
   * Resume execution of this system.
   */
  play(): void;

  /**
   * Stop execution of this system.
   */
  stop(): void;

  /**
   * It will get called each run by default (unless a custom scheduler is being used).
   * Usually it will be used to loop through the lists of entities from each query and
   * process the value of theirs components.
   */
  run(): void;

  /**
   * This function is called when the system is registered in a world (Calling `world.registerSystem`)
   * and can be used to initialize anything the system needs.
   */
  init?(): void;

  [key: string]: any;
}

export interface SystemConstructor<T extends System> {
  new (...args: any): T;
  systemData: {
    [key: string]: {
      components: ComponentConstructor[];
      mandatory?: boolean;
      listen?: {
        added?: boolean;
        removed?: boolean;
        changed?: boolean;
      };
    };
  };
}
