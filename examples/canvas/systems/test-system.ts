import { Circle, Position } from '../components';
import { intersection } from '../utils';

type SystemData = [Circle, Position];

export class TestSystem {

  static systemData = {
    entities: { components: [Circle, Position] }
  };

  enabled = true;
  initialized = true;

  queriesOther = {};
  queries: any = {};

  mandatoryQueries = [];

  run(data: SystemData[]) {

    for (const [circle, position] of data) {

      // if (entity.hasComponent(Intersecting)) {
      //   entity.getMutableComponent(Intersecting).points.length = 0;
      // }

      for (const [circleB, positionB] of data) {

        const intersect = intersection(circle, position, circleB, positionB);

        if (intersect !== false) {
          // let intersectComponent;
          // if (!entity.hasComponent(Intersecting)) {
          //   entity.addComponent(Intersecting);
          // }
          // intersectComponent = entity.getMutableComponent(Intersecting);
          // intersectComponent.points.push(intersect);
        }
      }
      // if (
      //   entity.hasComponent(Intersecting) &&
      //   entity.getComponent(Intersecting).points.length === 0
      // ) {
      //   entity.removeComponent(Intersecting);
      // }
    }
  }

  play() {
    this.enabled = true;
  }

  stop() {
    this.enabled = false;

    // super.stop();
    // Clean up interesection when stopping
    // const entities = this.queries.entities;

    // for (const entity of entities) {
    //   if (entity.hasComponent(Intersecting)) {
    //     entity.getMutableComponent(Intersecting).points.length = 0;
    //   }
    // }
  }
}
