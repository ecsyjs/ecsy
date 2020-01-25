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

        }
      }
    }
  }
};
