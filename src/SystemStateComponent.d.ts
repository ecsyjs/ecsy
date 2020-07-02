import { Component, ComponentConstructor } from "./Component";

/**
 * Components that extend the SystemStateComponent are not removed when an entity is deleted.
 */
export class SystemStateComponent<C> extends Component<C> {
  static isSystemStateComponent: true;
}

export interface SystemStateComponentConstructor<C extends Component<any>> extends ComponentConstructor<C> {
  isSystemStateComponent: true;
  new (): C;
}

