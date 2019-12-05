import { Vector2 } from "./math.js";

export class Movement {
  constructor() {
    this.velocity = new Vector2();
    this.acceleration = new Vector2();
  }

  reset() {
    this.velocity.set(0, 0);
    this.acceleration.set(0, 0);
  }
}

export class Circle {
  constructor() {
    this.position = new Vector2();
    this.radius = 0;
    this.velocity = new Vector2();
    this.acceleration = new Vector2();
  }

  reset() {
    this.position.set(0, 0);
    this.radius = 0;
    this.velocity.set(0, 0);
    this.acceleration.set(0, 0);
  }
}

export class CanvasContext {
  constructor() {
    this.ctx = null;
    this.width = 0;
    this.height = 0;
  }
}

export class DemoSettings {
  constructor() {
    this.speedMultiplier = 0.001;
  }
}

export class Intersecting {
  constructor() {
    this.points = [];
  }

  reset() {
    this.points.length = 0;
  }
}
