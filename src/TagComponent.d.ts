import { Component, ComponentConstructor } from "./Component";

/**
 * Create components that extend TagComponent in order to take advantage of performance optimizations for components
 * that do not store data
 */
export class TagComponent extends Component<undefined> {}

export interface TagComponentConstructor<C extends Component<undefined>> extends ComponentConstructor<undefined, C> {
  isTagComponent: true;
  new (): C;
}
