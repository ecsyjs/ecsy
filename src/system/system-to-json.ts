import { System, SystemConstructor } from '../system.interface';

export function systemToJSON(system: System) {
  const json = {
    name: system.constructor.name,
    enabled: system.enabled,
    executeTime: (system as any).executeTime,
    priority: system.priority,
    queries: {}
  };

  const constructor: SystemConstructor<System> = system.constructor as any;

  if (constructor.queries) {
    const queries = constructor.queries;

    for (const queryName in queries) {
      if (queries.hasOwnProperty(queryName)) {

        const query = system.queries[queryName];
        const queryDefinition = queries[queryName];
        const jsonQuery = (json.queries[queryName] = {
          key: system.queriesOther[queryName].key,
          mandatory: undefined,
          reactive: undefined,
          listen: undefined,
        });

        jsonQuery.mandatory = queryDefinition.mandatory === true;
        jsonQuery.reactive =
          queryDefinition.listen &&
          (queryDefinition.listen.added === true ||
            queryDefinition.listen.removed === true ||
            queryDefinition.listen.changed === true ||
            Array.isArray(queryDefinition.listen.changed));

        if (jsonQuery.reactive) {
          jsonQuery.listen = {};

          const methods = ['added', 'removed', 'changed'];
          methods.forEach(method => {
            if (query[method]) {
              jsonQuery.listen[method] = {
                entities: query[method].length
              };
            }
          });
        }
      }
    }
  }

  return json;
}
