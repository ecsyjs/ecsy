export class Movement {
  constructor() {
    this.velocity = new THREE.Vector2();
    this.acceleration = new THREE.Vector2();
  }

  copy(src) {
    this.velocity.copy(src.velocity);
    this.acceleration.copy(src.acceleration);
  }
}

export class Circle {
  constructor() {
    this.position = new THREE.Vector2();
    this.radius = 0;
    this.velocity = new THREE.Vector2();
    this.acceleration = new THREE.Vector2();
  }

  copy(src) {
    this.position.copy(src.position);
    this.radius = src.radius;
    this.velocity.copy(src.velocity);
    this.acceleration.copy(src.acceleration);
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
    this.speedMultiplier = 1;
  }
}

export class Intersecting {
  constructor() {
    this.points = [];
  }
}
