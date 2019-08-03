import { TagComponent } from "../../../build/ecsy.module.js";

export class Collidable extends TagComponent {}
export class Collider extends TagComponent {}
export class Recovering extends TagComponent {}
export class Moving extends TagComponent {}

export class PulsatingScale {
  constructor() {
    this.offset = 0;
  }
  reset() {
    this.offset = 0;
  }
}

export class Object3D {
  constructor() {
    this.object = null;
  }
  reset() {
    this.object = null;
  }
}

export class Timeout {
  constructor() {
    this.timer = 0;
    this.addComponents = [];
    this.removeComponents = [];
  }

  reset() {
    this.timer = 0;
    this.addComponents.length = 0;
    this.removeComponents.length = 0;
  }
}

export class PulsatingColor {
  constructor() {
    this.offset = 0;
  }

  reset() {
    this.offset = 0;
  }
}

export class Colliding {
  constructor() {
    this.value = false;
  }
  reset() {
    this.value = false;
  }
}

export class Rotating {
  constructor() {
    this.enabled = true;
    this.rotatingSpeed = 0;
    this.decreasingSpeed = 0.001;
  }

  reset() {
    this.enabled = true;
    this.rotatingSpeed = 0;
    this.decreasingSpeed = 0.001;
  }
}
