import { ComponentConstructor, Component } from '../component.interface';
import { queryKey } from '../utils';
import { Entity } from './entity';
import { EntityManager } from './entity-manager';
import { EventDispatcher } from './event-dispatcher';

// tslint:disable:no-bitwise

export class Query {

  ENTITY_ADDED = 'Query#ENTITY_ADDED';
  ENTITY_REMOVED = 'Query#ENTITY_REMOVED';
  COMPONENT_CHANGED = 'Query#COMPONENT_CHANGED';

  Components: ComponentConstructor<Component>[] = [];
  NotComponents: ComponentConstructor<Component>[] = [];

  entities: Entity[] = [];

  eventDispatcher = new EventDispatcher();

  // This query is being used by a reactive system
  reactive = false;

  key: any;

  /**
   * @param componentConstructors List of types of components to query
   */
  constructor(
    componentConstructors: (ComponentConstructor<Component> | any)[],
    manager: EntityManager,
  ) {

    componentConstructors.forEach((componentConstructor) => {
      if (typeof componentConstructor === 'object') {
        this.NotComponents.push(componentConstructor.component);
      } else {
        this.Components.push(componentConstructor);
      }
    });

    if (this.Components.length === 0) {
      throw new Error('Can\'t create a query without components');
    }

    this.key = queryKey(componentConstructors);

    // Fill the query with the existing entities
    for (const entity of manager.entities) {
      if (this.match(entity)) {
        // @todo ??? this.addEntity(entity); => preventing the event to be generated
        entity.queries.push(this);
        this.entities.push(entity);
      }
    }
  }

  /**
   * Add entity to this query
   */
  addEntity(entity: Entity) {
    entity.queries.push(this);
    this.entities.push(entity);

    this.eventDispatcher.dispatchEvent(Query.prototype.ENTITY_ADDED, entity);
  }

  /**
   * Remove entity from this query
   */
  removeEntity(entity: Entity) {
    let index = this.entities.indexOf(entity);

    if (~index) {
      this.entities.splice(index, 1);

      index = entity.queries.indexOf(this);
      entity.queries.splice(index, 1);

      this.eventDispatcher.dispatchEvent(
        Query.prototype.ENTITY_REMOVED,
        entity
      );
    }
  }

  match(entity: Entity) {
    return (
      entity.hasAllComponents(this.Components) &&
      !entity.hasAnyComponents(this.NotComponents)
    );
  }

  toJSON() {
    return {
      key: this.key,
      reactive: this.reactive,
      components: {
        included: this.Components.map(C => C.name),
        not: this.NotComponents.map(C => C.name)
      },
      numEntities: this.entities.length
    };
  }

  /**
   * Return stats for this query
   */
  stats() {
    return {
      numComponents: this.Components.length,
      numEntities: this.entities.length
    };
  }
}

