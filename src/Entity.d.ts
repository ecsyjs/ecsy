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
   * Get an immutable reference to a component on this entity.
   * @param Component Type of component to get
   */
  getComponent<T extends Component>(Component:ComponentConstructor<T>): T;

  /**
   * Get an object containing all the components on this entity, where the object keys are the component types.
   */
  getComponents(): object;

  /**
   * Get a list of component types that have been added to this entity.
   */
  getComponentTypes<T extends Component>(): Array<T>;

  /**
   * Get a component that is slated to be removed from this entity.
   */
  getRemovedComponent<T extends Component>(
    Component: ComponentConstructor<T>
  ): T;

  /**
   * Get a mutable reference to a component on this entity.
   * @param Component Type of component to get
   */
  getMutableComponent<T extends Component>(
    Component: ComponentConstructor<T>
  ): T;

  /**
   * Add a component to the entity.
   * @param Component Type of component to add to this entity
   * @param values Optional values to replace the default attributes on the component
   */
  addComponent<T extends Component>(
    Component: ComponentConstructor<T>,
    values?: object
  ): this;

  /**
   * Remove a component from the entity.
   * @param Component Type of component to remove from this entity
   */
  removeComponent<T extends Component>(
    Component: ComponentConstructor<T>
  ): this;

  /**
   * Check if the entity has a component.
   * @param Component Type of component
   */
  hasComponent<T extends Component>(
    Component: ComponentConstructor<T>
  ): boolean;

  /**
   * Check if the entity has a component that is slated to be removed.
   * @param Component Type of component
   */
  hasRemovedComponent<T extends Component>(
    Component: ComponentConstructor<T>
  ): boolean;

  /**
   * Check if the entity has all components in a list.
   * @param Components Component types to check
   */
  hasAllComponents<T extends Component>(
    Components: Array<ComponentConstructor<T>>
  ): boolean

  /**
   * Check if the entity has any of the components in a list.
   * @param Components Component types to check
   */
  hasAnyComponents<T extends Component>(
    Components: Array<ComponentConstructor<T>>
  ): boolean

  /**
   * Remove all components on this entity.
   */
  removeAllComponents():void

  /**
   * Remove this entity from the world.
   */
  remove():void;
}
