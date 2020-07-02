import { Component, ComponentConstructor } from "./Component";

/**
 * Create components that extend TagComponent in order to take advantage of performance optimizations for components
 * that do not store data
 */
export class TagComponent extends Component<{}> {
  static isTagComponent: true;
}

export interface TagComponentConstructor<C extends Component<{}>> extends ComponentConstructor<C> {
  isTagComponent: true;
  new (): C;
}
