import { Component, ComponentConstructor } from "./Component";

/**
 * An entity in the world.
 */
export class Entity {
  /**
   * A unique ID for this entity.
   */
  id: number;

  /**
   * Whether or not the entity is alive or removed.
   */
  alive: boolean;

  /**
   * Get an immutable reference to a component on this entity.
   * @param Component Type of component to get
   * @param includeRemoved Whether a component that is staled to be removed should be also considered
   */
  getComponent<P, C extends Component<P>>(
      Component: ComponentConstructor<P, C>,
      includeRemoved?: boolean
  ): C;

  /**
   * Get a component that is slated to be removed from this entity.
   */
  getRemovedComponent<P, C extends Component<P>>(
      Component: ComponentConstructor<P, C>
  ): C;

  /**
   * Get an object containing all the components on this entity, where the object keys are the component types.
   */
  getComponents(): { [componentName: string]: Component<any> };

  /**
   * Get an object containing all the components that are slated to be removed from this entity, where the object keys are the component types.
   */
  getComponentsToRemove(): { [componentName: string]: Component<any> };

  /**
   * Get a list of component types that have been added to this entity.
   */
  getComponentTypes(): Array<Component<any>>;

  /**
   * Get a mutable reference to a component on this entity.
   * @param Component Type of component to get
   */
  getMutableComponent<P, C extends Component<P>>(
    Component: ComponentConstructor<P, C>
  ): C;

  /**
   * Add a component to the entity.
   * @param Component Type of component to add to this entity
   * @param values Optional values to replace the default attributes on the component
   */
  addComponent<P, C extends Component<P>>(
    Component: ComponentConstructor<P, C>,
    values?: Omit<Partial<C>, "copy" | "clone" | "reset" | "dispose">
  ): this;

  /**
   * Remove a component from the entity.
   * @param Component Type of component to remove from this entity
   * @param forceImmediate Whether a component should be removed immediately
   */
  removeComponent<P, C extends Component<P>>(
    Component: ComponentConstructor<P, C>,
    forceImmediate?: boolean
  ): this;

  /**
   * Check if the entity has a component.
   * @param Component Type of component
   * @param includeRemoved Whether a component that is staled to be removed should be also considered
   */
  hasComponent<P, C extends Component<P>>(
    Component: ComponentConstructor<P, C>,
    includeRemoved?: boolean
  ): boolean;

  /**
   * Check if the entity has a component that is slated to be removed.
   * @param Component Type of component
   */
  hasRemovedComponent<P, C extends Component<P>>(
    Component: ComponentConstructor<P, C>
  ): boolean;

  /**
   * Check if the entity has all components in a list.
   * @param Components Component types to check
   */
  hasAllComponents(
    Components: Array<ComponentConstructor<any, any>>
  ): boolean

  /**
   * Check if the entity has any of the components in a list.
   * @param Components Component types to check
   */
  hasAnyComponents(
    Components: Array<ComponentConstructor<any, any>>
  ): boolean

  /**
   * Remove all components on this entity.
   * @param forceImmediate Whether all components should be removed immediately
   */
  removeAllComponents(
      forceImmediate?: boolean
  ): void

  copy(source: this): this

  clone(): this

  reset(): void

  /**
   * Remove this entity from the world.
   * @param forceImmediate Whether this entity should be removed immediately
   */
  remove(
      forceImmediate?: boolean
  ): void;
}
