import { PropType } from "./Types";

export type ComponentSchemaProp = {
  default?: any;
  type: PropType<any, any>;
};

export type ComponentSchema = {
  [propName: string]: ComponentSchemaProp;
};

// Base class for components,
declare class BaseComponent<C> {
  static schema: ComponentSchema;
  static isComponent: true;
  copy(source: this): this;
  clone(): this;
  reset(): void;
  dispose(): void;
}

type Component<T> = BaseComponent<T> & T;

export interface ComponentConstructor {
  schema: ComponentSchema;
  isComponent: true;
  new <T>(props?: Partial<T> | false): Component<T>;
}

export declare const Component: ComponentConstructor;
