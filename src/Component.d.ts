import { PropType } from "./Types";

/**
 * Base class for components.
 */

export type ComponentSchemaProp<T> = {
  default?: T;
  type: PropType<T, T>;
};

export type ComponentSchema = {
  [propName: string]: ComponentSchemaProp<any>;
};

export type SchemaProperties<Schema> =
  Partial<Omit<Schema, keyof Component<Schema>>>;

export class AbstractComponent<Properties> {
  static isComponent: true;
  static getName(): string;
  constructor(props?: Properties);
  copy(source: this | Properties): this;
  clone(): this
  setProperties(props?: Properties): this;
  reset(): void;
  dispose(): void;
}

export class Component<Schema>
  extends AbstractComponent<SchemaProperties<Schema>> {
  static schema: ComponentSchema;
  static isSchemaComponent: true;
  constructor(props?: SchemaProperties<Schema>);
}

export interface ComponentConstructor<C extends AbstractComponent<any>> {
  isComponent: true;
  new (...args: any): C;
}

export interface SchemaConstructable<C extends Component<C>> {
  schema: ComponentSchema;
  isSchemaComponent: true;
  new (props?: SchemaProperties<C>): C;
}
