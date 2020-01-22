import { TagComponent } from '@ecs';

export class Collidable extends TagComponent {}
export class Collider extends TagComponent {}
export class Recovering extends TagComponent {}
export class Moving extends TagComponent {}

export class PulsatingScale {
  offset = 0;

  reset() {
    this.offset = 0;
  }
}

export class Object3D {
  object = null;

  reset() {
    this.object = null;
  }
}

export class Timeout {
  timer = 0;
  addComponents = [];
  removeComponents = [];

  reset() {
    this.timer = 0;
    this.addComponents.length = 0;
    this.removeComponents.length = 0;
  }
}

export class PulsatingColor {
  offset = 0;

  reset() {
    this.offset = 0;
  }
}

export class Colliding {
  value = false;

  reset() {
    this.value = false;
  }
}

export class Rotating {
  enabled = true;
  rotatingSpeed = 0;
  decreasingSpeed = 0.001;

  reset() {
    this.enabled = true;
    this.rotatingSpeed = 0;
    this.decreasingSpeed = 0.001;
  }
}

export class PerformanceСompensation {
  delta: number;
  time: number;

  reset() {
    this.delta = 0;
    this.time = 0;
  }
}