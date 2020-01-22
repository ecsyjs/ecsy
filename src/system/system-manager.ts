import { ComponentConstructor } from '../component.interface';
import { EntityManager } from '../entity';
import { QueryEvents } from '../entity/query';
import { SystemConstructor } from '../system.interface';
import { canExecute } from './can-execute';
import { clearEvents } from './clear-events';
import { System } from './system';

// tslint:disable:no-bitwise

export class SystemManager {
  systems = new Map<SystemConstructor<System>, System>();

  // order is important
  private executeSystems: System[] = []; // Systems that have `execute` method

  lastExecutedSystem = null;

  constructor(
    private entityManager: EntityManager,
  ) {}

  registerSystem(systemConstructor: SystemConstructor<System>, attributes?: any) {
    if (this.systems.has(systemConstructor)) {
      console.warn(`System '${systemConstructor.name}' already registered.`);

      return this;
    }

    const system = new systemConstructor();

    // ----------

    if (attributes && attributes.priority) {
      system.priority = attributes.priority;
    }



    if (systemConstructor.queries) {
      system.queriesOther = [];
      system.queries = {};

      for (const queryName in systemConstructor.queries) {
        if (systemConstructor.queries.hasOwnProperty(queryName)) {

          const queryConfig = systemConstructor.queries[queryName];

          const components = queryConfig.components;

          if (!components || components.length === 0) {
            throw new Error('\'components\' attribute can\'t be empty in a query');
          }

          const query = this.entityManager.getQuery(components);

          system.queriesOther[queryName] = query;

          if (queryConfig.mandatory === true) {
            system.mandatoryQueries.push(query);
          }

          system.queries[queryName] = {
            results: query.entities
          };

          const events = {
            added: () => {
              const eventList = (system.queries[queryName].added = []);

              query.eventDispatcher.addEventListener(QueryEvents.ENTITY_ADDED,
                (entity) => {

                  // @fixme overhead?
                  if (eventList.indexOf(entity) === -1) {

                    eventList.push(entity);
                  }
                }
              );
            },
            removed: () => {
              const eventList = (system.queries[queryName].removed = []);

              query.eventDispatcher.addEventListener(QueryEvents.ENTITY_REMOVED,
                (entity) => {

                  // @fixme overhead?
                  if (eventList.indexOf(entity) === -1) {

                    eventList.push(entity);
                  }
                }
              );
            },
            changed: () => {
              const event = queryConfig.listen.changed;

              query.reactive = true;
              if (event === true) {
                // Any change on the entity from the components in the query
                const eventList = (system.queries[queryName].changed = []);

                query.eventDispatcher.addEventListener(
                  QueryEvents.COMPONENT_CHANGED,
                  (entity) => {
                    // Avoid duplicates
                    if (eventList.indexOf(entity) === -1) {
                      eventList.push(entity);
                    }
                  }
                );
              } else if (Array.isArray(event)) {
                const eventList = (system.queries[queryName].changed = []);

                query.eventDispatcher.addEventListener(
                  QueryEvents.COMPONENT_CHANGED,
                  (entity, changedComponent) => {
                    // Avoid duplicates
                    if (
                      event.indexOf(changedComponent.constructor as ComponentConstructor) !== -1 &&
                      eventList.indexOf(entity) === -1
                    ) {
                      eventList.push(entity);
                    }
                  }
                );
              } else {
                /*
                // Checking just specific components
                let changedList = (this.queries[queryName][eventName] = {});
                event.forEach(component => {
                  let eventList = (changedList[
                    componentPropertyName(component)
                  ] = []);
                  query.eventDispatcher.addEventListener(
                    Query.prototype.COMPONENT_CHANGED,
                    (entity, changedComponent) => {
                      if (
                        changedComponent.constructor === component &&
                        eventList.indexOf(entity) === -1
                      ) {
                        eventList.push(entity);
                      }
                    }
                  );
                });
                */
              }
            }
          };

          if (queryConfig.listen) {
            for (const eventName in queryConfig.listen) {
              if (queryConfig.listen.hasOwnProperty(eventName) && events[eventName]) {
                events[eventName]();
              }
            }
          }
        }
      }
    }

    // ----------

    if (system.init) {
      system.init();
    }

    system.order = this.systems.size;
    this.systems.set(systemConstructor, system);

    if (system.run) {
      this.executeSystems.push(system);
      this.sortSystems();
    }

    return this;
  }

  sortSystems() {
    this.executeSystems.sort((a, b) => {
      return a.priority - b.priority || a.order - b.order;
    });
  }

  getSystem(systemConstructor: SystemConstructor<System>): System {
    return this.systems.get(systemConstructor);
  }

  getSystems(): Map<SystemConstructor<System>, System> {
    return this.systems;
  }

  removeSystem(systemConstructor: SystemConstructor<System>): void {
    this.systems.delete(systemConstructor);
  }

  runSystem(system: System): void {

    if (system.initialized) {
      if (canExecute(system)) {
        const startTime = performance.now(); // ! debag performance

        // main run;
        system.run();

        system.executeTime = performance.now() - startTime; // ! debag performance
        this.lastExecutedSystem = system;

        clearEvents(system);
      }
    }
  }

  stop(): void {
    for (const system of this.executeSystems) {
      system.stop();
      system.executeTime = 0; // ! debag performance
    }
  }

  run(forcePlay?: boolean): void {
    for (const system of this.executeSystems) {
      if (forcePlay || system.enabled) {
        this.runSystem(system);
      }
    }
  }

  stats() {
    const stats = {
      numSystems: this.systems.size,
      systems: {}
    };

    for (const system of this.systems) {
      const systemStats = (stats.systems[system.constructor.name] = {
        queries: {}
      });

      for (const name in (system as any).ctx) {
        if ((system as any).ctx.hasOwnProperty(name)) {
          systemStats.queries[name] = (system as any).ctx[name].stats();
        }
      }
    }

    return stats;
  }
}
