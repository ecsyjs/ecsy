import { Resettable } from './resettable.interface';
import { NotComponent } from './not';

export interface Component extends Resettable {
  [key: string]: any;
  copy?(src: Component): void;
}

export type ComponentConstructor = new () => Component;

export type Constructor<T> = new () => T;

export type Components = ComponentConstructor | NotComponent;
