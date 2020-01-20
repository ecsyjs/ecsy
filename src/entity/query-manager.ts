import { ComponentConstructor, Component } from '../component.interface';
import { queryKey } from '../utils';
import { Entity } from './entity';
import { EntityManager } from './entity-manager';
import { Query } from './query';

// tslint:disable:no-bitwise

/**
 * QueryManager
 */
export class QueryManager {
  // Queries indexed by a unique identifier for the components it has
  queries = new Map<string, Query>();

  constructor(
    private entityManager: EntityManager,
  ) {}

  onEntityRemoved(entity: Entity): void {
    for (const [_, query] of this.queries) {

      if (entity.queries.indexOf(query) !== -1) {
        query.removeEntity(entity);
      }

    }
  }

  /**
   * Callback when a component is added to an entity
   * @param entity Entity that just got the new component
   * @param componentConstructor Component added to the entity
   */
  onEntityComponentAdded(entity: Entity, componentConstructor: ComponentConstructor): void {
    // @todo Use bitmask for checking components?

    // Check each indexed query to see if we need to add this entity to the list
    for (const [_, query] of  this.queries) {

        if (
          !!~query.NotComponents.indexOf(componentConstructor) &&
          ~query.entities.indexOf(entity)
        ) {
          query.removeEntity(entity);
          continue;
        }

        // Add the entity only if:
        // Component is in the query
        // and Entity has ALL the components of the query
        // and Entity is not already in the query
        if (
          !~query.Components.indexOf(componentConstructor) ||
          !query.match(entity) ||
          ~query.entities.indexOf(entity)
        ) {
          continue;
        }



        query.addEntity(entity);
    }
  }

  /**
   * Callback when a component is removed from an entity
   * @param entity Entity to remove the component from
   * @param componentConstructor Component to remove from the entity
   */
  onEntityComponentRemoved(entity: Entity, componentConstructor: ComponentConstructor): void {
    for (const [_, query] of this.queries) {

      if (
        !!~query.NotComponents.indexOf(componentConstructor) &&
        !~query.entities.indexOf(entity) &&
        query.match(entity)
      ) {
        query.addEntity(entity);
        continue;
      }

      if (
        !!~query.Components.indexOf(componentConstructor) &&
        !!~query.entities.indexOf(entity) &&
        !query.match(entity)
      ) {
        query.removeEntity(entity);
        continue;
      }

    }
  }

  /**
   * Get a query for the specified components
   * @param componentConstructors Components that the query should have
   */
  getQuery(componentConstructors: ComponentConstructor[]): Query {
    const key = queryKey(componentConstructors);

    let query = this.queries.get(key);

    if (!query) {
      query = new Query(componentConstructors, this.entityManager);

      this.queries.set(key, query);
    }

    return query;
  }

  /**
   * Return some stats from this class
   */
  stats(): { [key: string]: Query; } {
    const stats = {};
    for (const [queryName, query] of this.queries) {

      stats[queryName] = query.stats();
    }

    return stats;
  }
}
