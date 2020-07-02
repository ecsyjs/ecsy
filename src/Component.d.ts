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

export class Component<C> {
  static schema: ComponentSchema;
  static isComponent: true;
  constructor(props?: Partial<Omit<C, keyof Component<any>>> | false);
  copy(source: this): this;
  clone(): this;
  reset(): void;
  dispose(): void;
}

export interface ComponentConstructor<C extends Component<any>> {
  schema: ComponentSchema;
  isComponent: true;
  new (props?: Partial<Omit<C, keyof Component<any>>> | false): C;
}
