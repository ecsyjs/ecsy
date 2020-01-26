import { ComponentConstructor, Components } from '../component.interface';
import { Entity } from './entity';
import { EventDispatcher } from './event-dispatcher';
export declare enum QueryEvents {
    ENTITY_ADDED = 0,
    ENTITY_REMOVED = 1,
    COMPONENT_CHANGED = 2
}
export declare class Query {
    key: string;
    componentConstructors: ComponentConstructor[];
    notComponentConstructor: ComponentConstructor[];
    entities: Entity[];
    eventDispatcher: EventDispatcher<QueryEvents>;
    reactive: boolean;
    /**
     * @param componentConstructors List of types of components to query
     */
    constructor(componentConstructors: Components[], entities: Entity[], key: string);
    /**
     * Add entity to this query
     */
    addEntity(entity: Entity): void;
    /**
     * Remove entity from this query
     */
    removeEntity(entity: Entity): void;
    match(entity: Entity): boolean;
    toJSON(): {
        key: string;
        reactive: boolean;
        components: {
            included: string[];
            not: string[];
        };
        numEntities: number;
    };
    /**
     * Return stats for this query
     */
    stats(): {
        numComponents: number;
        numEntities: number;
    };
}
