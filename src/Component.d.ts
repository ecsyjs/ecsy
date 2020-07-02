import { PropType } from "./Types";

/**
 * Base class for components.
 */

export type ComponentSchemaProp = {
  default?: any;
  type: PropType<any, any>;
};

export type ComponentSchema = {
  [propName: string]: ComponentSchemaProp;
};

export class Component<P> {
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
