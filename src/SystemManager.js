import { ReactiveSystem } from "./ReactiveSystem.js";

export class SystemManager {
  constructor(world) {
    this.systems = [];
    this.world = world;
  }

  registerSystem(System) {
    this.systems.push(new System(this.world));
    return this;
  }

  removeSystem(System) {
    var index = this.systems.indexOf(System);
    if (!~index) return;

    this.systems.splice(index, 1);
  }

  execute(delta, time) {
    this.systems.forEach(system => {
      if (system.enabled) {
        if (system instanceof ReactiveSystem) {
          if (system.onEntitiesAdded && system.counters.added) {
            system.onEntitiesAdded();
          }
          if (system.onEntitiesRemoved && system.counters.removed) {
            system.onEntitiesRemoved();
          }
          if (system.onEntitiesChanged && system.counters.changed) {
            system.onEntitiesChanged();
          }
        } else if (system.execute) {
          system.execute(delta, time);
        }
      }
    });

    this.systems.forEach(system => {
      if (system instanceof ReactiveSystem) {
        system.clearQueries();
      }
    });
  }

  stats() {
    var stats = {
      numSystems: this.systems.length,
      systems: {}
    };

    for (var i = 0; i < this.systems.length; i++) {
      var system = this.systems[i];
      var systemStats = (stats.systems[system.constructor.name] = {
        queries: {}
      });
      for (var name in system.ctx) {
        systemStats.queries[name] = system.ctx[name].stats();
      }
    }

    return stats;
  }
}
