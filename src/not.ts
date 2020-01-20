import { Component, ComponentConstructor } from './component.interface';

/**
 * Use the Not class to negate a component query.
 */
export const Not = (component: ComponentConstructor): Not => ({
  operator: 'not',
  component,
});

export interface Not {
  operator: 'not';
  component: ComponentConstructor;
}
