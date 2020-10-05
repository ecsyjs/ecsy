import { ComponentConstructor, ComponentStatic } from "./Component";

/**
 * Components that extend the SystemStateComponent are not removed when an entity is deleted.
 */
interface SystemStateComponentStatic extends ComponentStatic {
  isSystemStateComponent: true;
}

export interface SystemStateComponentConstructor<C>
  extends ComponentConstructor<C> {
  isSystemStateComponent: true;
}

export declare const SystemStateComponent: SystemStateComponentStatic;
