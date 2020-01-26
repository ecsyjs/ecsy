import { ComponentManager } from '../component';
import { ComponentConstructor, Components } from '../component.interface';
import { ObjectPool } from '../utils/object-pool';
import { Entity } from './entity';
import { EventDispatcher } from './event-dispatcher';
import { Query } from './query';
import { QueryManager } from './query-manager';
export declare enum EntityManagerEvents {
    ENTITY_CREATED = 0,
    ENTITY_REMOVED = 1,
    COMPONENT_ADDED = 2,
    COMPONENT_REMOVE = 3
}
/**
 * EntityManager
 */
export declare class EntityManager {
    private componentManager;
    private queryManager;
    entities: Entity[];
    eventDispatcher: EventDispatcher<EntityManagerEvents>;
    entityPool: ObjectPool<Entity>;
    entitiesWithComponentsToRemove: Set<Entity>;
    entitiesToRemove: Entity[];
    deferredRemovalEnabled: boolean;
    numStateComponents: number;
    constructor(componentManager: ComponentManager, queryManager: QueryManager);
    /**
     * Create a new entity
     */
    createEntity(): Entity;
    /**
     * Add a component to an entity
     * @param entity Entity where the component will be added
     * @param componentConstructor Component to be added to the entity
     * @param values Optional values to replace the default attributes
     */
    entityAddComponent(entity: Entity, componentConstructor: ComponentConstructor, values?: {
        [key: string]: any;
    }): void;
    /**
     * Remove a component from an entity
     * @param entity Entity which will get removed the component
     * @param componentConstructor Component to remove from the entity
     * @param immediately If you want to remove the component immediately instead of deferred (Default is false)
     */
    entityRemoveComponent(entity: Entity, componentConstructor: ComponentConstructor, immediately?: boolean): void;
    entityRemoveComponentSync(entity: Entity, componentConstructor: ComponentConstructor): void;
    /**
     * Remove all the components from an entity
     * @param entity Entity from which the components will be removed
     */
    entityRemoveAllComponents(entity: Entity, immediately?: boolean): void;
    /**
     * Remove the entity from this manager. It will clear also its components
     * @param entity Entity to remove from the manager
     * @param immediately If you want to remove the component immediately instead of deferred (Default is false)
     */
    removeEntity(entity: Entity, immediately?: boolean): void;
    private releaseEntity;
    /**
     * Remove all entities from this manager
     */
    removeAllEntities(): void;
    processDeferredRemoval(): void;
    /**
     * Get a query based on a list of components
     * @param componentConstructors List of components that will form the query
     */
    getQuery(componentConstructors: Components[]): Query;
    /**
     * Return number of entities
     */
    count(): number;
    /**
     * Return some stats
     */
    stats(): {
        numEntities: number;
        numQueries: number;
        queries: {
            [key: string]: Query;
        };
        numComponentPool: number;
        componentPool: {};
        eventDispatcher: {
            fired: number;
            handled: number;
        };
    };
}
