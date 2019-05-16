/**
 * @class System
 */
export class System {
  constructor(world) {
    this.world = world;
    this.enabled = true;
    this.queryComponents = this.init ? this.init() : null;
    this._queries = {};
    this.queries = {};

    for (var name in this.queryComponents) {
      var Components = this.queryComponents[name];
      var query = this.world.entityManager.queryComponents(Components);
      this._queries[name] = query;
      this.queries[name] = query.entities;
    }
  }
}
