import { ComponentManager } from './component';
import { ComponentConstructor } from './component.interface';
import { Entity, EntityManager } from './entity';
import { System, SystemManager } from './system';
import { SystemConstructor } from './system.interface';
/**
 * The World is the root of the ECS.
 */
export declare class World {
    componentsManager: ComponentManager;
    entityManager: EntityManager;
    systemManager: SystemManager;
    enabled: boolean;
    eventQueues: {};
    lastTime: number;
    /**
     * Create a new World.
     */
    constructor(componentsManager?: ComponentManager, entityManager?: EntityManager, systemManager?: SystemManager);
    /**
     * Register a component.
     * @param component Type of component to register
     */
    registerComponent(component: ComponentConstructor): this;
    /**
     * Register a system.
     * @param system Type of system to register
     */
    registerSystem<T extends System>(system: SystemConstructor<T>, attributes?: any): this;
    /**
     * Get a system registered in this world.
     * @param System Type of system to get.
     */
    getSystem<T extends System>(SystemClass: SystemConstructor<T>): System;
    /**
     * Get a list of systems registered in this world.
     */
    getSystems(): Map<SystemConstructor<any>, System>;
    /**
     * Update the systems.
     */
    run(): void;
    /**
     * Stop execution of this world.
     */
    stop(): void;
    /**
     * Resume execution of this world.
     */
    play(): void;
    /**
     * Create a new entity
     */
    createEntity(): Entity;
    stats(): void;
}
