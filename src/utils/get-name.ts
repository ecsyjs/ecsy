import { ComponentConstructor } from '../component.interface';

/**
 * Return the name of a component
 */
export function getName(componentConstructor: ComponentConstructor) {
  return componentConstructor.name;
}
