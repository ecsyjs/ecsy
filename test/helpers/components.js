export class FooComponent {
  constructor() {
    this.variableFoo = 0;
  }

  copy(src) {
    this.variableFoo = src.variableFoo;
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
