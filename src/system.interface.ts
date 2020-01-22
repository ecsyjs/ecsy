import { ComponentConstructor } from './component.interface';
import { NotComponent } from './not';
import { System } from './system';


export interface SystemConstructor<T extends System> {
  new (...args: any): T;
  queries?: {
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
}
