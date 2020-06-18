/* global BABYLON */
import { System } from "../../../build/ecsy.module.js";
import {
  Object3D,
  Collisionable,
  Collider,
  Recovering,
  Moving,
  PulsatingScale,
  Timeout,
  PulsatingColor,
  Colliding,
  Rotating
} from "./components.mjs";

export class RotatingSystem extends System {
  execute(delta) {
    let entities = this.queries.entities.results;
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i];
      let rotatingSpeed = entity.getComponent(Rotating).rotatingSpeed;
      let object = entity.getComponent(Object3D).object;

      object.rotation.x += rotatingSpeed * delta;
      object.rotation.y += rotatingSpeed * delta * 2;
      object.rotation.z += rotatingSpeed * delta * 3;
    }
  }
}

RotatingSystem.queries = {
  entities: { components: [Rotating, Object3D] }
};

const TIMER_TIME = 1;

export class PulsatingColorSystem extends System {
  execute(delta, time) {
    time *= 1000;
    let entities = this.queries.entities.results;
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i];
      let object = entity.getComponent(Object3D).object;
      if (entity.hasComponent(Colliding)) {
        object.instancedBuffers.color.set(1, 1, 0, 1);
      } else if (entity.hasComponent(Recovering)) {
        let col = 0.3 + entity.getComponent(Timeout).timer / TIMER_TIME;
        object.instancedBuffers.color.set(col, col, 0, 1);
      } else {
        let r =
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

PulsatingColorSystem.queries = {
  entities: { components: [PulsatingColor, Object3D] }
};

export class PulsatingScaleSystem extends System {
  execute(delta, time) {
    let entities = this.queries.entities.results;
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i];
      let object = entity.getComponent(Object3D).object;

      let mul;
      if (entity.hasComponent(Colliding)) {
        mul = 2;
      } else if (entity.hasComponent(Recovering)) {
        mul = 1.2;
      } else {
        mul = 0.8;
      }

      let offset = entity.getComponent(PulsatingScale).offset;
      let sca = mul * (Math.cos(time + offset) / 2 + 1) + 0.2;
      object.scaling.set(sca, sca, sca);
    }
  }
}
PulsatingScaleSystem.queries = {
  entities: { components: [PulsatingScale] }
};

export class MovingSystem extends System {
  execute(delta, time) {
    let entities = this.queries.entities.results;
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i];
      let object = entity.getComponent(Object3D).object;
      let offset = entity.getComponent(Moving).offset;
      let radius = 5;
      let maxRadius = 5;
      object.position.z = Math.cos(time + 3 * offset) * maxRadius + radius;
    }
  }
}
MovingSystem.queries = {
  entities: { components: [Moving] }
};

export class TimeoutSystem extends System {
  execute(delta) {
    let entities = this.queries.entities.results;
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i];

      let timeout = entity.getMutableComponent(Timeout);
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
TimeoutSystem.queries = {
  entities: { components: [Timeout] }
};

export class ColliderSystem extends System {
  execute() {
    let boxes = this.queries.boxes.results;
    let balls = this.queries.balls.results;
    for (let i = 0; i < balls.length; i++) {
      let ball = balls[i];
      let ballObject = ball.getComponent(Object3D).object;

      for (let j = 0; j < boxes.length; j++) {
        let box = boxes[j];
        let boxObject = box.getComponent(Object3D).object;
        let prevColliding = box.hasComponent(Colliding);
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
ColliderSystem.queries = {
  boxes: { components: [Collisionable] },
  balls: { components: [Collider] }
};
