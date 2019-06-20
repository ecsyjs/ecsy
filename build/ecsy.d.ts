declare module "ecsy" {
  type EventListener = (...data: any) => any;

  class EventDispatcher {
    stats: EventDispatcherStats;
    constructor();
    addEventListener(eventName: string, listener: EventListener): void;
    hasEventListener(eventName: string, listener: EventListener): boolean;
    removeEventListener(eventName: string, listener: EventListener): void;
    dispatchEvent(eventName: string, ...data: any): void;
    resetCounters(): void;
  }

  interface ComponentConstructor<T extends Component> {
    new (...args: any): T;
  }

  interface SystemConstructor<T extends System> {
    new (...args: any): T;
  }

  interface Component {}

  class Entity {
    id: number;
    queries: Query[];
    componentsToRemove: ComponentConstructor<Component>[];
    constructor(world: World);
    getComponent<T extends Component>(Component: ComponentConstructor<T>): T;
    getComponents(): { [componentName: string]: Component };
    getComponentTypes(): ComponentConstructor<Component>[];
    getMutableComponent<T extends Component>(
      Component: ComponentConstructor<T>
    ): T;
    addComponent<T extends Component>(
      Component: ComponentConstructor<T>,
      values?: {}
    ): this;
    removeComponent<T extends Component>(
      Component: ComponentConstructor<T>,
      forceRemove?: boolean
    ): this;
    hasComponent<T extends Component>(
      Component: ComponentConstructor<T>
    ): boolean;
    hasAllComponents(Components: ComponentConstructor<Component>[]): boolean;
    removeAllComponents(Components: ComponentConstructor<Component>[]): void;
    hasTag(tag: string): boolean;
    addTag(tag: string): this;
    removeTag(tag: string): this;
    remove(forceRemove?: boolean): void;
  }

  interface Query {
    Components: ComponentConstructor<Component>[];
    entities: Entity[];
    eventDispatcher: EventDispatcher;
    reactive: boolean;
    key: string;
    stats(): QueryStats;
  }

  interface QueryEventConfig {
    event: "EntityAdded" | "EntityRemoved" | "EntityChanged" | string;
    components?: ComponentConstructor<Component>[];
  }

  interface QueryConfig {
    components: (ComponentConstructor<Component> | ComponentQuery)[];
    events?: { [name: string]: QueryEventConfig };
  }

  interface SystemConfig {
    queries?: { [name: string]: QueryConfig };
    events?: { [name: string]: string };
  }

  interface ComponentQuery {
    operator: string;
    Component: ComponentConstructor<Component>;
  }

  export function Not(
    Component: ComponentConstructor<Component>
  ): ComponentQuery;

  export abstract class System {
    public world: World;
    public enabled: boolean;
    public queries: { [name: string]: Entity[] };
    public events: { [name: string]: Entity[] };
    public priority: number;
    public config: SystemConfig;

    constructor(world: World, attributes?: {});

    public abstract init(): SystemConfig;

    public abstract execute(delta: number, time: number): void;

    public play(): void;

    public stop(): void;

    public toJSON(): {};

    public clearEvents(): void;
  }

  interface ObjectPool<T> {
    freeList: T[];
    count: number;
    T: T;
    createElement(...extraArgs: any[]): T;
    initialObject: T;
    aquire(): T;
    release(item: T): void;
    expand(count: number): void;
    totalSize(): number;
    totalFree(): number;
    totalUsed(): number;
  }

  class ComponentManager {
    Components: { [componentName: string]: ComponentConstructor<Component> };
    SingletonComponents: {
      [componentName: string]: ComponentConstructor<Component>;
    };
    constructor();
    registerComponent(Component: ComponentConstructor<Component>): void;
    registerSingletonComponent(
      Component: ComponentConstructor<Component>
    ): void;
    componentAddedToEntity(Component: ComponentConstructor<Component>): void;
    componentRemovedFromEntity(
      Component: ComponentConstructor<Component>
    ): void;
    getComponentsPool<T>(Component: ComponentConstructor<T>): ObjectPool<T>;
  }

  class EntityManager {
    world: World;
    componentsManager: ComponentManager;
    eventDispatcher: EventDispatcher;
    constructor(world: World);
    createEntity(): Entity;
    entityAddComponent(
      entity: Entity,
      Component: ComponentConstructor<Component>,
      values?: {}
    ): void;
    entityRemoveComponent(
      entity: Entity,
      Component: ComponentConstructor<Component>
    ): void;
    entityRemoveAllComponents(entity: Entity, forceRemove?: boolean): void;
    removeEntity(entity: Entity, forceRemove?: boolean): void;
    removeAllEntities(): void;
    processDeferredRemoval(): void;
    removeEntitiesByTag(tag: string): void;
    entityAddTag(entity: Entity, tag: string): void;
    entityRemoveTag(entity: Entity, tag: string): void;
    queryComponents(Components: ComponentConstructor<Component>): Query;
    count(): number;
    stats(): EntityManagerStats;
  }

  class SystemManager {
    systems: System[];
    world: World;
    constructor(world: World);
    registerSystem(System: SystemConstructor<System>, attributes?: {}): this;
    sortSystems(): void;
    removeSystem(System: SystemConstructor<System>): void;
    execute(delta: number, time: number): void;
    stats(): SystemManagerStats;
  }

  interface SystemManagerStats {
    numSystems: number;
    // TODO theres a bug in stats() system.ctx doesn't exist
  }

  interface EventDispatcherStats {
    fired: number;
    handled: number;
  }

  interface QueryManagerStats {
    [name: string]: QueryStats;
  }

  interface QueryStats {
    numComponents: number;
    numEntities: number;
  }

  interface EntityManagerStats {
    numEntities: number;
    numQueries: number;
    queries: QueryManagerStats;
    numComponentPool: number;
    componentPool: { [name: string]: { used: number; size: number } };
    eventDispatcher: EventDispatcherStats;
  }

  export class World {
    public componentsManager: ComponentManager;
    public entityManager: EntityManager;
    public systemManager: SystemManager;
    public enabled: boolean;
    public components: { [name: string]: Component };
    public eventQueues: { [name: string]: any }; // TODO
    public eventDispatcher: EventDispatcher;
    cr: any;
    public emitEvent(eventName: string, data: any): void;
    public addEventListener(eventName: string, listener: EventListener): void;
    public removeEventListener(
      eventName: string,
      listener: EventListener
    ): void;
    public registerSingletonComponent(
      Component: ComponentConstructor<Component>
    ): this;
    public registerComponent(Component: ComponentConstructor<Component>): this;
    public registerSystem(
      System: SystemConstructor<System>,
      attributes?: {}
    ): this;
    public execute(delta: number, time: number): void;
    public stop(): void;
    public play(): void;
    public createEntity(): Entity;
    public stats(): void;
  }
}
