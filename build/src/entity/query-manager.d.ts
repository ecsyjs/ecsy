import { ComponentConstructor, Components } from '../component.interface';
import { Entity } from './entity';
import { Query } from './query';
/**
 * QueryManager
 */
export declare class QueryManager {
    queries: Map<string, Query>;
    constructor();
    onEntityRemoved(entity: Entity): void;
    /**
     * Callback when a component is added to an entity
     * @param entity Entity that just got the new component
     * @param componentConstructor Component added to the entity
     */
    onEntityComponentAdded(entity: Entity, componentConstructor: ComponentConstructor): void;
    /**
     * Callback when a component is removed from an entity
     * @param entity Entity to remove the component from
     * @param componentConstructor Component to remove from the entity
     */
    onEntityComponentRemoved(entity: Entity, componentConstructor: ComponentConstructor): void;
    /**
     * Get a query for the specified components
     * @param componentConstructors Components that the query should have
     */
    getQuery(componentConstructors: Components[], entities: Entity[]): Query;
    /**
     * Return some stats from this class
     */
    stats(): {
        [key: string]: Query;
    };
}
