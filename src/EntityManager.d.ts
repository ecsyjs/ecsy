import { ObjectPool } from "./ObjectPool.js";
import QueryManager from "./QueryManager.js";
import EventDispatcher from "./EventDispatcher.js";
import { SystemStateComponent } from "./SystemStateComponent.js";

export class EntityManager {

  constructor(world);

  getEntityByName(name);

  /**
   * Create a new entity
   */
  createEntity(name);

  entityAddComponent(entity, Component, values);

  /**
   * Remove a component from an entity
   * @param {Entity} entity Entity which will get removed the component
   * @param {*} Component Component to remove from the entity
   * @param {Bool} immediately If you want to remove the component immediately instead of deferred (Default is false)
   */
  entityRemoveComponent(entity, Component, immediately);

  _entityRemoveComponentSync(entity, Component, index);

  /**
   * Remove all the components from an entity
   * @param {Entity} entity Entity from which the components will be removed
   */
  entityRemoveAllComponents(entity, immediately);

  /**
   * Remove the entity from this manager. It will clear also its components
   * @param {Entity} entity Entity to remove from the manager
   * @param {Bool} immediately If you want to remove the component immediately instead of deferred (Default is false)
   */
  removeEntity(entity, immediately);

  /**
   * Remove all entities from this manager
   */
  removeAllEntities();

  processDeferredRemoval();

  /**
   * Get a query based on a list of components
   * @param {Array(Component)} Components List of components that will form the query
   */
  queryComponents(Components);

  /**
   * Return number of entities
   */
  count();

  /**
   * Return some stats
   */
  stats();
}
