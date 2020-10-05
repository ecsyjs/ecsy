import {
  ComponentConstructor,
  ComponentInstance,
  ComponentStatic,
} from "./Component";

/**
 * Create components that extend TagComponent in order to take advantage of performance optimizations for components
 * that do not store data
 */
interface TagComponentStatic extends ComponentStatic {
  isTagComponent: true;
  new (): ComponentInstance<{}>;
}

export interface TagComponentConstructor extends ComponentConstructor<{}> {
  isTagComponent: true;
}

export declare const TagComponent: TagComponentStatic;
