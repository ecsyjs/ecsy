import { ComponentConstructor, Components } from '../component.interface';
import { Entity } from './entity';
import { EventDispatcher } from './event-dispatcher';

// tslint:disable:no-bitwise

export enum QueryEvents {
  ENTITY_ADDED,
  ENTITY_REMOVED,
  COMPONENT_CHANGED,
}

export class Query {

  componentConstructors: ComponentConstructor[] = [];
  notComponentConstructor: ComponentConstructor[] = [];

  entities: Entity[] = [];

  eventDispatcher = new EventDispatcher<QueryEvents>();

  // This query is being used by a reactive system
  reactive = false;

  /**
   * @param componentConstructors List of types of components to query
   */
  constructor(
    componentConstructors: Components[],
    entities: Entity[],
    public key: string,
  ) {

    componentConstructors.forEach((componentConstructor) => {
      if (typeof componentConstructor === 'object') {
        this.notComponentConstructor.push(componentConstructor.component);
      } else {
        this.componentConstructors.push(componentConstructor);
      }
    });

    if (this.componentConstructors.length === 0) {
      throw new Error('Can\'t create a query without components');
    }

    // Fill the query with the existing entities
    for (const entity of entities) {
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

    this.eventDispatcher.dispatchEvent(QueryEvents.ENTITY_ADDED, entity);
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

      this.eventDispatcher.dispatchEvent(QueryEvents.ENTITY_REMOVED, entity);
    }
  }

  match(entity: Entity) {
    return (
      entity.hasAllComponents(this.componentConstructors) &&
      !entity.hasAnyComponents(this.notComponentConstructor)
    );
  }

  toJSON() {
    return {
      key: this.key,
      reactive: this.reactive,
      components: {
        included: this.componentConstructors.map(C => C.name),
        not: this.notComponentConstructor.map(C => C.name)
      },
      numEntities: this.entities.length
    };
  }

  /**
   * Return stats for this query
   */
  stats() {
    return {
      numComponents: this.componentConstructors.length,
      numEntities: this.entities.length
    };
  }
}

