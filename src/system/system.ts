import { ComponentConstructor } from '../component.interface';
import { NotComponent } from '../not';

/**
 * A system that manipulates entities in the world.
 * Every run systems are executed and they create, remove or modify entities and components.
 */
export abstract class System {

  static queries?: {
    [key: string]: {
      components: (ComponentConstructor | NotComponent)[];
      mandatory?: boolean;
      listen?: {
        added?: boolean;
        removed?: boolean;
        changed?: boolean | (ComponentConstructor | NotComponent)[];
      };
    };
  };

  /**
   * Whether the system will execute during the world tick.
   */
  enabled = true;
  initialized = true;

  queriesOther = {};
  queries: any = {};

  mandatoryQueries = [];

  priority = 0;
  order = 0;

  executeTime?: number;

  /**
   * It will get called each run by default (unless a custom scheduler is being used).
   * Usually it will be used to loop through the lists of entities from each query and
   * process the value of theirs components.
   */
  run?(): void;

  /**
   * This function is called when the system is registered in a world (Calling `world.registerSystem`)
   * and can be used to initialize anything the system needs.
   */
  init?(): void;

  /**
   * Resume execution of this system.
   */
  play() {
    this.enabled = true;
  }

  /**
   * Stop execution of this system.
   */
  stop() {
    this.enabled = false;
  }
}
