import { System, World } from '@ecs';

class Box {}

let frame = 1;

class SystemFoo extends System {

  static queries = {
    boxes: {
      components: [ Box ],
      listen: { removed: true }, // To listen for removed entities from the query
    }
  };

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
