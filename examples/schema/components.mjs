import { SchemaTypes } from "../../build/ecsy.module.js";

export class Rotating {
  constructor() {
    this.rotatingSpeed = 0.1;
    this.decreasingSpeed = 0.001;
  }

  copy(srcComponent) {
    this.rotatingSpeed = srcComponent.rotatingSpeed;
    this.decreasingSpeed = srcComponent.decreasingSpeed;
  }
}

Rotating.prototype.schema = {
  rotatingSpeed: {
    type: SchemaTypes.float
  },
  decreasingSpeed: {
    type: SchemaTypes.float,
    min: 0,
    max: 10
  }
};

export class Pulsating {
  constructor() {
    this.pulsatingSpeed = 0.1;
    this.phase = 0;
  }

  copy(srcComponent) {
    this.pulsatingSpeed = srcComponent.pulsatingSpeed;
    this.phase = srcComponent.phase;
  }
}

export class Transform {
  constructor() {
    this.rotation = { x: 0, y: 0, z: 0 };
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
  }
}
