export default class Group {
  constructor(Components) {
    this.Components = Components;
    this.entities = [];
  }

  stats() {
    return {
      numComponents: this.Components.length,
      numEntities: this.entities.length
    };
  }
}
