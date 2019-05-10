export class System {
  constructor(world) {
    this.world = world;
    this.enabled = true;
    this.ctx = this.init ? this.init() : null;
    this.queries = {};
    for (var name in this.ctx) {
      this.queries[name] = this.ctx[name].entities;
    }
  }
}
