/* global ENGINE */
import { System } from "../../build/ecsy.module.js";
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
  init() {
    return {
      entities: [Rotating, Object3D]
    };
  }

  execute(delta) {
    let entities = this.queries.entities;
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i];
      let rotatingSpeed = entity.getComponent(Rotating).rotatingSpeed;
      let object = entity.object3D.object;

      object.rotation.x += rotatingSpeed * delta;
      object.rotation.y += rotatingSpeed * delta * 2;
      object.rotation.z += rotatingSpeed * delta * 3;
    }
  }
}

const TIMER_TIME = 1;

export class PulsatingColorSystem extends System {
  init() {
    return {
      entities: [PulsatingColor, Object3D]
    };
  }

  execute(delta, time) {
    time *= 1000;
    let entities = this.queries.entities;
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i];
      let object = entity.object3D.object;
      if (entity.hasComponent(Colliding)) {
        ENGINE.setObjectMaterialColor(object, 1, 1, 0);
      } else if (entity.hasComponent(Recovering)) {
        let col = 0.3 + entity.timeout.timer / TIMER_TIME;
        ENGINE.setObjectMaterialColor(object, col, col, 0);
      } else {
        let r =
          Math.sin(time / 500 + entity.pulsatingColor.offset * 12) / 2 + 0.5;
        ENGINE.setObjectMaterialColor(object, r, 0, 0);
      }
    }
  }
}

export class PulsatingScaleSystem extends System {
  init() {
    return {
      entities: [PulsatingScale]
    };
  }

  execute(delta, time) {
    let entities = this.queries.entities;
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i];
      let object = entity.object3D.object;

      let mul;
      if (entity.hasComponent(Colliding)) {
        mul = 2;
      } else if (entity.hasComponent(Recovering)) {
        mul = 1.2;
      } else {
        mul = 0.8;
      }

      let offset = entity.pulsatingScale.offset;
      let sca = mul * (Math.cos(time + offset) / 2 + 1) + 0.2;
      ENGINE.setObjectScale(object, sca);
    }
  }
}

export class MovingSystem extends System {
  init() {
    return {
      entities: [Moving]
    };
  }

  execute(delta, time) {
    let entities = this.queries.entities;
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i];
      let object = entity.object3D.object;
      let offset = entity.moving.offset;
      let radius = 5;
      let maxRadius = 5;
      object.position.z = Math.cos(time + 3 * offset) * maxRadius + radius;
    }
  }
}

export class TimeoutSystem extends System {
  init() {
    return {
      entities: [Timeout]
    };
  }

  execute(delta) {
    let entities = this.queries.entities;
    for (let i = 0; i < entities.length; i++) {
      let entity = entities[i];

      let timeout = entity.timeout;
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
  init() {
    return {
      boxes: [Collisionable],
      balls: [Collider]
    };
  }

  execute() {
    let boxes = this.queries.boxes;
    let balls = this.queries.balls;
    for (let i = 0; i < balls.length; i++) {
      let ball = balls[i];
      let ballObject = ball.object3D.object;
      for (let j = 0; j < boxes.length; j++) {
        let box = boxes[j];
        let boxObject = box.object3D.object;
        let prevColliding = box.hasComponent(Colliding);

        if (ENGINE.objectsColliding(ballObject, boxObject)) {
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
