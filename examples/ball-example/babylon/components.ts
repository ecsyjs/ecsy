export class Collisionable {}
export class Collider {}
export class Recovering {}
export class Moving {}

export class PulsatingScale {
  offset = 0;
}

export class Object3D {
  object = null;
}

export class Timeout {
  timer = 0;
  addComponents = [];
  removeComponents = [];
}

export class PulsatingColor {
  offset = 0;
}

export class Colliding {
  value = false;
}

export class Rotating {
  enabled = true;
  rotatingSpeed = 0;
  decreasingSpeed = 0.001;
}

export class PerformanceСompensation {
  delta: number;
  time: number;

  reset() {
    this.delta = 0;
    this.time = 0;
  }
}