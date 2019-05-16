import { ReactiveSystem } from "./ReactiveSystem.js";

/**
 * @class SystemManager
 */
export class SystemManager {
  constructor(world) {
    this.systems = {};
    this.world = world;
  }

  /**
   * Register a system
   * @param {System} System System to register
   */
  registerSystem(System) {
    this.systems[System.name] = new System(this.world);
    return this;
  }

  /**
   * Remove a system
   * @param {System} System System to remove
   */
  removeSystem(System) {
    delete this.systems[System];
  }

  /**
   * Update all the systems. Called per frame.
   * @param {Number} delta Delta time since the last frame
   * @param {Number} time Elapsed time
   */
  execute(delta, time) {
    var name, system;

    for (name in this.systems) {
      system = this.systems[name];
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
    }

    for (name in this.systems) {
      system = this.systems[name];
      if (system instanceof ReactiveSystem) {
        system.clearQueries();
      }
    }
  }

  /**
   * Return stats
   */
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
