import { Component, ComponentConstructor } from "./Component";

/**
 * Create a component class from a schema.
 * @param schema An object that describes the schema of the component
 * @param name The name of the component
 */
export function createComponentClass<T extends Component>(schema: object, name: string):ComponentConstructor<T>
