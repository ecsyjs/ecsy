import { Component, ComponentConstructor } from "./Component";
import { TypeDefinition } from "./CreateType";

export interface ComponentPropertyDefinition {
  default?: any,
  type: TypeDefinition
}

export type ComponentSchema = { [propertyName: string]: ComponentPropertyDefinition };

/**
 * Create a component class from a schema.
 * @param schema An object that describes the schema of the component
 * @param name The name of the component
 */
export function createComponentClass<T extends Component>(schema: ComponentSchema, name?: string): ComponentConstructor<T>
