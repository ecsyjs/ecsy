import { System, World } from '@ecs';

class Box {}

let frame = 1;

class SystemFoo implements System {

  static systemData = {
    boxes: {
      components: [ Box ],
      listen: { removed: true }, // To listen for removed entities from the query
    }
  };

  enabled = true;
  initialized = true;
  queries: any = {};
  queriesOther: any = {};
  mandatoryQueries = [];

  run() {

    console.log(`Frame`, frame++, this.queries.boxes.removed);

    this.queries.boxes.removed.forEach((entity) => {
      const component = entity.getRemovedComponent(Box);
      console.log(' - Component removed:', component, 'on entity: ', entity.id);
    });

    this.queries.boxes.results.forEach((entity) => {
      console.log(' - Iterating on entity: ', entity.id);
    });
  }

  play() {
    this.enabled = true;
  }

  stop() {
    this.enabled = false;
  }
}

export class RemovingComponentsComponent {

  constructor() {
    const world = new World()
      .registerSystem(SystemFoo);

    const entity = world.createEntity()
      .addComponent(Box);

    world.run(); // Execute frame 1
    // on frame 1 will Iterating on entity with box;
    entity.removeComponent(Box);
    world.run(); // Execute frame 2
    // on frame 2 no box component, no Iterating on entity;

    world.run(); // Execute frame 3
  }

}
