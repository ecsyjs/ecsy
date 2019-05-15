import { Rotating, Transform } from "./components.mjs";
import { System } from "../../../build/ecsy.module.js";

export class RotatingSystem extends System {
  init() {
    return {
      entities: [Rotating, Transform]
    };
  }

  execute(delta) {
    let entities = this.queries.entities;
    for (var i = 0; i < entities.length; i++) {
      let entity = entities[i];
      let rotationSpeed = entity.getComponent(Rotating).rotatingSpeed;
      let transform = entity.getMutableComponent(Transform);

      transform.rotation.x += rotationSpeed * delta;
      transform.rotation.y += rotationSpeed * delta * 2;
      transform.rotation.z += rotationSpeed * delta * 3;
    }
  }
}

export class InputSystem extends System {
  init() {
    var state = this.world.components.inputState;

    window.addEventListener("keydown", evt => {
      switch (evt.keyCode) {
        case 38:
          state.up = true;
          break;
        case 40:
          state.down = true;
          break;
        case 37:
          state.left = true;
          break;
        case 39:
          state.right = true;
          break;
        case 90:
          state.z = true;
          break;
        case 88:
          state.x = true;
          break;
      }
    });

    window.addEventListener("keyup", evt => {
      switch (evt.keyCode) {
        case 38:
          state.up = false;
          break;
        case 40:
          state.down = false;
          break;
        case 37:
          state.left = false;
          break;
        case 39:
          state.right = false;
          break;
        case 90:
          state.z = false;
          break;
        case 88:
          state.x = false;
          break;
      }
    });

    return {};
  }

  execute() {
//    console.log(this.world.ctx.inputState);
  }
}
