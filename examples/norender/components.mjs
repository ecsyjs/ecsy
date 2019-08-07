export class Rotating {
  constructor() {
    this.rotatingSpeed = 0.1;
    this.decreasingSpeed = 0.001;
  }

  reset() {
    this.rotatingSpeed = 0.1;
    this.decreasingSpeed = 0.001;
  }
}

export class Pulsating {
  constructor() {
    this.pulsatingSpeed = 0.1;
    this.phase = 0;
  }

  reset() {
    this.pulsatingSpeed = 0.1;
    this.phase = 0;
  }
}

export class Transform {
  constructor() {
    this.rotation = { x: 0, y: 0, z: 0 };
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
  }
}

export class InputState {
  constructor() {
    this.up = false;
    this.down = false;
    this.left = false;
    this.right = false;
    this.z = false;
    this.x = false;
  }
}