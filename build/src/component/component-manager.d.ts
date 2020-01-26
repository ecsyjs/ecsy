import { Component, ComponentConstructor } from '../component.interface';
import { Pool } from '../pool.interface';
export declare class ComponentManager {
    componentConstructors: Set<ComponentConstructor>;
    componentPool: Map<ComponentConstructor, Pool<Component>>;
    registerComponent(componentConstructor: ComponentConstructor): void;
    componentAddedToEntity(componentConstructor: ComponentConstructor): void;
    getComponentsPool(componentConstructor: ComponentConstructor): Pool<Component>;
}
