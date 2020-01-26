import { Query } from '../system.interface';
import { Entity } from 'src/entity';
export interface ResultQuery {
    [key: string]: {
        /**
         * All the entities with selected component
         */
        results: Entity[];
        /**
         * All the entities added to the query since the last call
         */
        added?: Entity[];
        /**
         * All the entities removed from the query since the last call
         */
        removed?: Entity[];
        /**
         * All the entities which selected components have changed since the last call
         */
        changed?: Entity[];
    };
}
/**
 * A system that manipulates entities in the world.
 * Every run systems are executed and they create, remove or modify entities and components.
 */
export declare abstract class System {
    static queries?: Query;
    /**
     * Whether the system will execute during the world tick.
     */
    enabled: boolean;
    initialized: boolean;
    queriesOther: {};
    queries: ResultQuery;
    mandatoryQueries: any[];
    priority: number;
    order: number;
    executeTime?: number;
    /**
     * It will get called each run by default (unless a custom scheduler is being used).
     * Usually it will be used to loop through the lists of entities from each query and
     * process the value of theirs components.
     */
    run?(): void;
    /**
     * This function is called when the system is registered in a world (Calling `world.registerSystem`)
     * and can be used to initialize anything the system needs.
     */
    init?(): void;
    /**
     * Resume execution of this system.
     */
    play(): void;
    /**
     * Stop execution of this system.
     */
    stop(): void;
}
