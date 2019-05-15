import { Rotating, Transform } from "./components.mjs";
import { System } from "../../../build/ecsy.module.js";

export class RotatingSystem extends System {
  init() {
    return {
      entities: this.world.entityManager.queryComponents([Rotating, Transform])
    };
  }

  execute(delta) {
    let entities = this.queries.entities;
    for (var i = 0; i < entities.length; i++) {
      let entity = entities[i];
      let rotationSpeed = entity.rotating.rotatingSpeed;
      let transform = entity.transform;

      transform.rotation.x += rotationSpeed * delta;
      transform.rotation.y += rotationSpeed * delta * 2;
      transform.rotation.z += rotationSpeed * delta * 3;
    }
  }
}
