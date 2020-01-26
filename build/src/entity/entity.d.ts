import { Component, ComponentConstructor } from '../component.interface';
import { Resettable } from '../resettable.interface';
import { EntityManager } from './entity-manager';
import { Query } from './query';
export declare class Entity implements Resettable {
    entityManager: EntityManager;
    id: number;
    componentTypes: Set<ComponentConstructor>;
    components: Map<string, Component>;
    componentsToRemove: Map<string, Component>;
    queries: Query[];
    componentTypesToRemove: Set<ComponentConstructor>;
    alive: boolean;
    constructor(entityManager: EntityManager);
    getComponent(componentConstructor: ComponentConstructor, includeRemoved?: boolean): Component;
    getMutableComponent(componentConstructor: ComponentConstructor): Component;
    /**
     * Once a component is removed from an entity, it is possible to access its contents
     */
    getRemovedComponent(componentConstructor: ComponentConstructor): Component;
    getComponents(): Map<string, Component>;
    getComponentsToRemove(): Map<string, Component>;
    getComponentTypes(): Set<ComponentConstructor>;
    addComponent(componentConstructor: ComponentConstructor, values?: {
        [key: string]: any;
    }): this;
    /**
     * This will mark the component to be removed and will populate all the queues from the
     * systems that are listening to that event, but the component itself won't be disposed
     * until the end of the frame, we call it deferred removal. This is done so systems that
     * need to react to it can still access the data of the components.
     */
    removeComponent(componentConstructor: ComponentConstructor, forceRemove?: boolean): this;
    hasComponent(componentConstructor: ComponentConstructor, includeRemoved?: boolean): boolean;
    hasRemovedComponent(componentConstructor: ComponentConstructor): boolean;
    hasAllComponents(componentConstructors: ComponentConstructor[]): boolean;
    hasAnyComponents(componentConstructors: ComponentConstructor[]): boolean;
    removeAllComponents(forceRemove?: boolean): void;
    reset(): void;
    remove(forceRemove?: boolean): void;
}
