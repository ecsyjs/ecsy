import { ComponentConstructor } from './component.interface';

/**
 * Use the Not class to negate a component query.
 */
export const Not = (component: ComponentConstructor): NotComponent => ({
  operator: 'not',
  component,
});

export interface NotComponent {
  operator: 'not';
  component: ComponentConstructor;
}
