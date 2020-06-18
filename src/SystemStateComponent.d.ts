import { Component, ComponentConstructor } from "./Component";

/**
 * Components that extend the SystemStateComponent are not removed when an entity is deleted.
 */
export class SystemStateComponent<P> extends Component<P> {
  static isSystemStateComponent: true;
}

export interface SystemStateComponentConstructor<P, C extends Component<P>> extends ComponentConstructor<P, C> {
  isSystemStateComponent: true;
  new (): C;
}

