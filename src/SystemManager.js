export class SystemManager {
  constructor(world) {
    this.systems = [];
    this.world = world;
  }

  registerSystem(System) {
    this.systems.push(new System(this.world));
    return this;
  }

  tick(delta, time) {
    this.systems.forEach(system => {
      if (system.enabled) {
        system.tick(delta, time);
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
        groups: {}
      });
      for (var name in system.ctx) {
        systemStats.groups[name] = system.ctx[name].stats();
      }
    }

    return stats;
  }
}
