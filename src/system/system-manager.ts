import { EntityManager } from '../entity';
import { QueryEvents } from '../entity/query';
import { System, SystemConstructor } from '../system.interface';
import { canExecute } from './can-execute';
import { clearEvents } from './clear-events';

// tslint:disable:no-bitwise

export class SystemManager {
  private systems: System[] = [];
  private executeSystems: System[] = []; // Systems that have `execute` method

  lastExecutedSystem = null;

  constructor(
    private entityManager: EntityManager,
  ) {}

  registerSystem(systemConstructor: SystemConstructor<System>, attributes) {
    if (
      this.systems.find((s) => s.constructor.name === systemConstructor.name) !== undefined
    ) {
      console.warn(`System '${systemConstructor.name}' already registered.`);

      return this;
    }

    const system = new systemConstructor();

    // ----------

    if (attributes && attributes.priority) {
      system.priority = attributes.priority;
    }

    if (systemConstructor.systemData) {
      system.queriesOther = [];
      system.queries = {};

      for (const queryName in systemConstructor.systemData) {
        if (systemConstructor.systemData.hasOwnProperty(queryName)) {

          const queryConfig = systemConstructor.systemData[queryName];

          const components = queryConfig.components;

          if (!components || components.length === 0) {
            throw new Error('\'components\' attribute can\'t be empty in a query');
          }

          const query = this.entityManager.queryComponents(components);

          system.queriesOther[queryName] = query;

          if (queryConfig.mandatory === true) {
            system.mandatoryQueries.push(query);
          }

          system.queries[queryName] = {
            results: query.entities
          };

          // Reactive configuration added/removed/changed
          const validEvents: ['added', 'removed', 'changed'] = ['added', 'removed', 'changed'];

          const eventMapping = {
            added: QueryEvents.ENTITY_ADDED,
            removed: QueryEvents.ENTITY_REMOVED,
            changed: QueryEvents.COMPONENT_CHANGED // Query.prototype.ENTITY_CHANGED
          };

          if (queryConfig.listen) {

            validEvents.forEach((eventName) => {
              // Is the event enabled on this system's query?
              if (queryConfig.listen[eventName]) {
                const event = queryConfig.listen[eventName];

                if (eventName === 'changed') {
                  query.reactive = true;
                  if (event === true) {
                    // Any change on the entity from the components in the query
                    const eventList = (system.queries[queryName][eventName] = []);
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
                    const eventList = (system.queries[queryName][eventName] = []);
                    query.eventDispatcher.addEventListener(
                      QueryEvents.COMPONENT_CHANGED,
                      (entity, changedComponent) => {
                        // Avoid duplicates
                        if (
                          event.indexOf(changedComponent.constructor) !== -1 &&
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
                } else {

                  const eventList = (system.queries[queryName][eventName] = []);

                  query.eventDispatcher.addEventListener(eventMapping[eventName],
                    (entity) => {

                      // @fixme overhead?
                      if (eventList.indexOf(entity) === -1) {

                        eventList.push(entity);
                      }
                    }
                  );
                }
              }
            });
          }
        }
      }
    }

    // ----------

    if (system.init) {
      system.init();
    }

    system.order = this.systems.length;
    this.systems.push(system);

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

  getSystem(systemConstructor: SystemConstructor<any>): System {
    return this.systems.find(s => s instanceof systemConstructor);
  }

  getSystems(): System[] {
    return this.systems;
  }

  removeSystem(system: System): void {
    const index = this.systems.indexOf(system);

    if (!~index) { return; }

    this.systems.splice(index, 1);
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
      numSystems: this.systems.length,
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
