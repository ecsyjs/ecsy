import { ComponentConstructor } from '../component.interface';

/**
 * Return the name of a component
 */
export function getName<T>(componentConstructor: ComponentConstructor<T>) {
  return componentConstructor.name;
}
