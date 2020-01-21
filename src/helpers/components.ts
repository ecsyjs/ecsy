export class FooComponent {
  variableFoo = 0;

  copy(src) {
    this.variableFoo = src.variableFoo;
  }
}

export class BarComponent {
  variableBar = 0;

  copy(src) {
    this.variableBar = src.variableBar;
  }
}

export class NoCopyComponent {
  variable = 0;
}

export class EmptyComponent {}
