import { ComponentConstructor } from '../component.interface';
import { getName } from './get-name';

/**
 * Return a valid property name for the Component
 */
export function componentPropertyName<T>(componentConstructor: ComponentConstructor<T>): string {
  const name = getName(componentConstructor);
  return name.charAt(0).toLowerCase() + name.slice(1);
}
