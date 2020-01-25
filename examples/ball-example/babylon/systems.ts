import { System } from '@ecs';

import {
  Collider,
  Colliding,
  Collisionable,
  Moving,
  Object3D,
  PerformanceСompensation,
  PulsatingColor,
  PulsatingScale,
  Recovering,
  Rotating,
  Timeout,
} from './components';

declare var BABYLON: any;

export class RotatingSystem extends System {

  static queries = {
    entities: { components: [Rotating, Object3D] },
    context: { components: [PerformanceСompensation], mandatory: true }
  };

  run() {
    const context = this.queries.context.results[0];
    const delta = context.getComponent(PerformanceСompensation).delta;

    const entities = this.queries.entities.results;

    for (const entity of entities) {
      const rotatingSpeed = entity.getComponent(Rotating).rotatingSpeed;
      const object = entity.getComponent(Object3D).object;

      object.rotation.x += rotatingSpeed * delta;
      object.rotation.y += rotatingSpeed * delta * 2;
      object.rotation.z += rotatingSpeed * delta * 3;
    }
  }
}


const TIMER_TIME = 1;

export class PulsatingColorSystem extends System {

  static queries = {
    entities: { components: [PulsatingColor, Object3D] },
    context: { components: [PerformanceСompensation], mandatory: true }
  };

  run() {

    const context = this.queries.context.results[0];
    let time = context.getComponent(PerformanceСompensation).time;

    time *= 1000;
    const entities = this.queries.entities.results;

    for (const entity of entities) {
      const object = entity.getComponent(Object3D).object;
      if (entity.hasComponent(Colliding)) {
        object.instancedBuffers.color.set(1, 1, 0, 1);
      } else if (entity.hasComponent(Recovering)) {
        const col = 0.3 + entity.getComponent(Timeout).timer / TIMER_TIME;
        object.instancedBuffers.color.set(col, col, 0, 1);
      } else {
        const r =
          Math.sin(
            time / 500 + entity.getComponent(PulsatingColor).offset * 12
          ) /
            2 +
          0.5;
        object.instancedBuffers.color.set(r, 0, 0, 1);
      }
    }
  }
}



export class PulsatingScaleSystem extends System {

  static queries = {
    entities: { components: [PulsatingScale] },
    context: { components: [PerformanceСompensation], mandatory: true }
  };

  run() {

    const context = this.queries.context.results[0];
    const time = context.getComponent(PerformanceСompensation).time;

    const entities = this.queries.entities.results;
    for (const entity of entities) {
      const object = entity.getComponent(Object3D).object;

      let mul;
      if (entity.hasComponent(Colliding)) {
        mul = 2;
      } else if (entity.hasComponent(Recovering)) {
        mul = 1.2;
      } else {
        mul = 0.8;
      }

      const offset = entity.getComponent(PulsatingScale).offset;
      const sca = mul * (Math.cos(time + offset) / 2 + 1) + 0.2;
      object.scaling.set(sca, sca, sca);
    }
  }
}

export class MovingSystem extends System {

  static queries = {
    entities: { components: [Moving] },
    context: { components: [PerformanceСompensation], mandatory: true }
  };

  run() {

    const context = this.queries.context.results[0];
    const time = context.getComponent(PerformanceСompensation).time;

    const entities = this.queries.entities.results;

    for (const entity of entities) {
      const object = entity.getComponent(Object3D).object;
      const offset = entity.getComponent(Moving).offset;
      const radius = 5;
      const maxRadius = 5;
      object.position.z = Math.cos(time + 3 * offset) * maxRadius + radius;
    }
  }
}


export class TimeoutSystem extends System {

  static queries = {
    entities: { components: [Timeout] },
    context: { components: [PerformanceСompensation], mandatory: true }
  };

  run() {
    const context = this.queries.context.results[0];
    const delta = context.getComponent(PerformanceСompensation).delta;

    const entities = this.queries.entities.results;
    for (const entity of entities) {

      const timeout = entity.getMutableComponent(Timeout);
      timeout.timer -= delta;
      if (timeout.timer < 0) {
        timeout.timer = 0;
        timeout.addComponents.forEach(componentName => {
          entity.addComponent(componentName);
        });
        timeout.removeComponents.forEach(componentName => {
          entity.removeComponent(componentName);
        });

        entity.removeComponent(Timeout);
      }
    }
  }
}


export class ColliderSystem extends System {

  static queries = {
    boxes: { components: [Collisionable] },
    balls: { components: [Collider] }
  };

  run() {
    const boxes = this.queries.boxes.results;
    const balls = this.queries.balls.results;
    for (const ball of balls) {
      const ballObject = ball.getComponent(Object3D).object;

      for (const box of boxes) {
        const boxObject = box.getComponent(Object3D).object;
        const prevColliding = box.hasComponent(Colliding);
        if (
          BABYLON.BoundingSphere.Intersects(
            ballObject.getBoundingInfo().boundingSphere,
            boxObject.getBoundingInfo().boundingSphere
          )
        ) {
          if (!prevColliding) {
            box.addComponent(Colliding);
          }
        } else {
          if (prevColliding) {
            box.removeComponent(Colliding);
            box.addComponent(Recovering);
            box.addComponent(Timeout, {
              timer: TIMER_TIME,
              removeComponents: [Recovering]
            });
          }
        }
      }
    }
  }
}

