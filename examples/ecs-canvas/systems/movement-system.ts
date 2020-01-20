import { System } from '@ecs';

import {
  Acceleration,
  CanvasContext,
  Circle,
  DemoSettings,
  PerformanceСompensation,
  Position,
  Velocity,
} from '../components';

export class MovementSystem implements System {

  static systemData = {
    entities: { components: [Circle, Velocity, Acceleration, Position] },
    context: { components: [PerformanceСompensation, CanvasContext, DemoSettings], mandatory: true }
  };

  enabled = true;
  initialized = true;

  queriesOther = {};
  queries: any = {};

  mandatoryQueries = [];

  run() {

    // console.log(`MovementSystem`, this, (this as any).executeTime);

    const context = this.queries.context.results[0];
    const canvasContext = context.getComponent(CanvasContext);
    const canvasWidth = canvasContext.width;
    const canvasHeight = canvasContext.height;
    const delta = context.getComponent(PerformanceСompensation).delta;
    const multiplier = context.getComponent(DemoSettings).speedMultiplier;

    const entities = this.queries.entities.results;

    for (const entity of entities) {
      const circle = entity.getMutableComponent(Circle);
      const velocity = entity.getMutableComponent(Velocity);
      const acceleration = entity.getMutableComponent(Acceleration);
      const position = entity.getMutableComponent(Position);

      position.x +=
        velocity.x * acceleration.x * delta * multiplier;
      position.y +=
        velocity.y * acceleration.y * delta * multiplier;

      if (acceleration.x > 1) {
        acceleration.x -= delta * multiplier;
      }
      if (acceleration.y > 1) {
        acceleration.y -= delta * multiplier;
      }
      if (acceleration.x < 1) { acceleration.x = 1; }
      if (acceleration.y < 1) { acceleration.y = 1; }

      if (position.y + circle.radius < 0) {
        position.y = canvasHeight + circle.radius;
      }

      if (position.y - circle.radius > canvasHeight) {
        position.y = -circle.radius;
      }

      if (position.x - circle.radius > canvasWidth) {
        position.x = 0;
      }

      if (position.x + circle.radius < 0) {
        position.x = canvasWidth;
      }
    }
  }

  play() {
    this.enabled = true;
  }

  stop() {
    this.enabled = false;
  }
}
