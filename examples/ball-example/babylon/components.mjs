export class Collisionable {}
export class Collider {}
export class Recovering {}
export class Moving {}

export class PulsatingScale {
  constructor() {
    this.offset = 0;
  }
}

export class Object3D {
  constructor() {
    this.object = null;
  }
}

export class Timeout {
  constructor() {
    this.timer = 0;
    this.addComponents = [];
    this.removeComponents = [];
  }
}

export class PulsatingColor {
  constructor() {
    this.offset = 0;
  }
}

export class Colliding {
  constructor() {
    this.value = false;
  }
}

export class Rotating {
  constructor() {
    this.enabled = true;
    this.rotatingSpeed = 0;
    this.decreasingSpeed = 0.001;
  }
}
