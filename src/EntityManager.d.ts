import { ComponentConstructor } from "./Component.js";
import { Entity } from "./Entity";

export class EntityManager {

  constructor(world);

  getEntityByName(name): Entity | undefined;

  /**
   * Create a new entity
   */
  createEntity(name): Entity;

  entityAddComponent(entity, Component, values): void;

  /**
   * Remove a component from an entity
   * @param {Entity} entity Entity which will get removed the component
   * @param {*} Component Component to remove from the entity
   * @param {Bool} immediately If you want to remove the component immediately instead of deferred (Default is false)
   */
  entityRemoveComponent(entity, Component, immediately): void;

  _entityRemoveComponentSync(entity, Component, index): void;

  /**
   * Remove all the components from an entity
   * @param {Entity} entity Entity from which the components will be removed
   */
  entityRemoveAllComponents(entity, immediately): void;

  /**
   * Remove the entity from this manager. It will clear also its components
   * @param {Entity} entity Entity to remove from the manager
   * @param {Bool} immediately If you want to remove the component immediately instead of deferred (Default is false)
   */
  removeEntity(entity, immediately): void;

  /**
   * Remove all entities from this manager
   */
  removeAllEntities(): void;

  processDeferredRemoval(): void;

  /**
   * Get a query based on a list of components
   * @param {Array(Component)} Components List of components that will form the query
   */
  queryComponents(Components): [ ComponentConstructor<any> ];

  /**
   * Return number of entities
   */
  count(): number;

  /**
   * Return some stats
   */
  stats(): Stats;
}

interface EventDispatcherStats {
  fired: number;
  handled: number;
}

interface PoolStats {
  used: number;
  size: number;
}

interface QueryStats {
  numComponents: number;
  numEntities: number;
}

interface Stats {
  numEntities: number;
  numQueries: number;
  queries: { [ key: string ]: QueryStats };
  numComponentPool: number;
  componentPool: { [ key: string ]: PoolStats };
  eventDispatcher: EventDispatcherStats;
}
