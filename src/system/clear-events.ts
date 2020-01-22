import { System } from './system';

export const clearEvents = (system: System) => {

  for (const queryName in system.queries) {
    if (system.queries.hasOwnProperty(queryName)) {

      const query = system.queries[queryName];

      if (query.added) {
        query.added.length = 0;
      }

      if (query.removed) {
        query.removed.length = 0;
      }

      if (query.changed) {
        if (Array.isArray(query.changed)) {

          query.changed.length = 0;

        } else {
          for (const name in query.changed) {
            if (query.changed.hasOwnProperty(name)) {

              query.changed[name].length = 0;

            }
          }
        }
      }
    }
  }
};
