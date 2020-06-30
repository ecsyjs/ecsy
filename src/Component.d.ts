import { PropType } from "./Types";

/**
 * Base class for components.
 */

export type ComponentSchemaProp<T> = {
  default?: T;
  type: PropType<T>;
};

export type ComponentSchema = {
  [propName: string]: ComponentSchemaProp<any>;
};

export class Component<P = false> {
  static schema: ComponentSchema;
  static isComponent: true;
  constructor(props?: P | false);
  copy(source: this): this;
  clone(): this;
  reset(): void;
  dispose(): void;
}

export interface ComponentConstructor<P, C extends Component<P>> {
  schema: ComponentSchema;
  isComponent: true;
  new (props?: P | false): C;
}
