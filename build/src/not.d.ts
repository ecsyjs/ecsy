import { ComponentConstructor } from './component.interface';
/**
 * Use the Not class to negate a component query.
 */
export declare const Not: (component: ComponentConstructor) => NotComponent;
export interface NotComponent {
    operator: 'not';
    component: ComponentConstructor;
}
