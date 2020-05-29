import { TagComponent } from "../../src/index";

export class TagComponentA extends TagComponent {}
export class TagComponentB extends TagComponent {}
export class TagComponentC extends TagComponent {}

export class Component1 {
  constructor() {
    this.attr = 0;
  }

  copy(src) {
    this.attr = src.attr;
  }
}

export class Component2 {
  constructor() {
    this.attr = 0;
    this.attr2 = 0;
  }

  copy(src) {
    this.attr = src.attr;
    this.attr2 = src.attr2;
  }
}

export class Component3 {
  constructor() {
    this.attr = 0;
    this.attr2 = 0;
    this.attr2 = 0;
  }

  copy(src) {
    this.attr = src.attr;
    this.attr2 = src.attr2;
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
