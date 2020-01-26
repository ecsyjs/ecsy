import { EntityManager } from '../entity';
import { SystemConstructor } from '../system.interface';
import { System } from './system';
export declare class SystemManager {
    private entityManager;
    systems: Map<SystemConstructor<System>, System>;
    private executeSystems;
    lastExecutedSystem: any;
    constructor(entityManager: EntityManager);
    registerSystem(systemConstructor: SystemConstructor<System>, attributes?: any): this;
    sortSystems(): void;
    getSystem(systemConstructor: SystemConstructor<System>): System;
    getSystems(): Map<SystemConstructor<System>, System>;
    removeSystem(systemConstructor: SystemConstructor<System>): void;
    runSystem(system: System): void;
    stop(): void;
    run(forcePlay?: boolean): void;
    stats(): {
        numSystems: number;
        systems: {};
    };
}
