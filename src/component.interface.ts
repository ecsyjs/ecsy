import { Resettable } from './resettable.interface';

export interface Component extends Resettable {
  [key: string]: any;
  copy?(src: Component): void;
}

export type ComponentConstructor = new () => Component;
