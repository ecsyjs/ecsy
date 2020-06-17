import { TagComponent } from "../../src/index";

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

export class TagComponentA extends TagComponent {}
export class TagComponentB extends TagComponent {}
export class TagComponentC extends TagComponent {}

export class Component1 {
  constructor() {
    this.attr = 0;
  }

  reset() {
    this.attr = 0;
  }
}

export class Component2 {
  constructor() {
    this.attr = 0;
    this.attr2 = "";
  }

  reset() {
    this.attr = 0;
    this.attr2 = "";
  }
}

export class Component3 {
  constructor() {
    this.attr = 0;
    this.attr2 = 0;
    this.attr3 = new Vector3();
  }

  reset() {
    this.attr = 0;
    this.attr2 = "";
    this.attr3.set(0, 0, 0);
  }
}

export class Component3NoReset {
  constructor() {
    this.attr = 0;
    this.attr2 = 0;
    this.attr3 = new Vector3();
  }
}

export class BarComponent {
  constructor() {
    this.variableBar = 0;
  }

  copy(src) {
    this.variableBar = src.variableBar;
  }
}

export class NoCopyComponent {
  constructor() {
    this.variable = 0;
  }
}

export class EmptyComponent {}
