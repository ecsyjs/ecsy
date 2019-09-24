/**
 * Base class for components.
 */
export abstract class Component {}

export interface ComponentConstructor<T extends Component> {
  new (...args: any): T;
}
