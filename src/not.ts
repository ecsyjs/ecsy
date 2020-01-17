import { Component, ComponentConstructor } from './component.interface';

/**
 * Use the Not class to negate a component query.
 */
export const Not = <T extends Component>(component: ComponentConstructor<T>) => ({
  operator: 'not',
  component,
});

