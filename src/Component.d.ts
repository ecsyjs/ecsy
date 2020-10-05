import { PropType } from "./Types";

export type ComponentSchemaProp = {
  default?: any;
  type: PropType<any, any>;
};

export type ComponentSchema = {
  [propName: string]: ComponentSchemaProp;
};

// Base class for components,
export declare class ComponentClass<C> {
  copy(source: this): this;
  clone(): this;
  reset(): void;
  dispose(): void;
  constructor(props?: Partial<C> | false);
}

export type ComponentInstance<C> = ComponentClass<C> & C;

interface ComponentStatic {
  schema: ComponentSchema;
  isComponent: true;
  new <C>(props?: Partial<C> | false): ComponentInstance<C>;
}

export interface ComponentConstructor<C> {
  schema: ComponentSchema;
  isComponent: true;
  new (props?: Partial<C> | false): ComponentInstance<C>;
}

export declare const Component: ComponentStatic;
