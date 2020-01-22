import { System } from '@ecs';

import {
  Collidable,
  Collider,
  Colliding,
  Moving,
  Object3D,
  PulsatingColor,
  PulsatingScale,
  Recovering,
  Rotating,
  Timeout,
  PerformanceСompensation,
} from './components';

declare var THREE: any;

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
        object.material.color.setRGB(1, 1, 0);
      } else if (entity.hasComponent(Recovering)) {
        const col = 0.3 + entity.getComponent(Timeout).timer / TIMER_TIME;
        object.material.color.setRGB(col, col, 0);
      } else {
        const r =
          Math.sin(
            time / 500 + entity.getComponent(PulsatingColor).offset * 12
          ) /
            2 +
          0.5;
        object.material.color.setRGB(r, 0, 0);
      }
    }
  }
}



export class PulsatingScaleSystem extends System {

  static queries = {
    entities: { components: [PulsatingScale] },
    context: { components: [PerformanceСompensation], mandatory: true }
  }

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
      object.scale.set(sca, sca, sca);
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



const ballWorldPos = new THREE.Vector3();

export class ColliderSystem extends System {

  static queries = {
    boxes: { components: [Collidable] },
    balls: { components: [Collider] }
  };

  run() {
    const boxes = this.queries.boxes.results;
    const balls = this.queries.balls.results;
    for (const ball of balls) {
      const ballObject = ball.getComponent(Object3D).object;
      ballObject.getWorldPosition(ballWorldPos);
      if (!ballObject.geometry.boundingSphere) {
        ballObject.geometry.computeBoundingSphere();
      }
      const radiusBall = ballObject.geometry.boundingSphere.radius;

      for (const box of boxes) {
        const boxObject = box.getComponent(Object3D).object;
        const prevColliding = box.hasComponent(Colliding);
        if (!boxObject.geometry.boundingSphere) {
          boxObject.geometry.computeBoundingSphere();
        }
        const radiusBox = boxObject.geometry.boundingSphere.radius;
        const radiusSum = radiusBox + radiusBall;

        if (
          boxObject.position.distanceToSquared(ballWorldPos) <=
          radiusSum * radiusSum
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

