import { TagComponent } from "../../src/index";
import { Component } from "../../src/Component";
import { Types } from "../../src/Types";

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

export class Component1 extends Component {}
Component1.schema = {
  attr: { type: Types.Number }
};

export class Component2 extends Component {}
Component2.schema = {
  attr: { type: Types.Number },
  attr2: { type: Types.Number }
};

export class Component3 extends Component {}
Component3.schema = {
  attr: { type: Types.Number },
  attr2: { type: Types.Number },
  attr3: { type: Types.Array }
};
/*
export class Component3NoReset extends Component {
  constructor() {
    this.attr = 0;
    this.attr2 = 0;
    this.attr3 = new Vector3();
  }
}

export class BarComponent extends Component {
  constructor() {
    this.variableBar = 0;
  }

  copy(src) {
    this.variableBar = src.variableBar;
  }
}

export class NoCopyComponent extends Component {
  constructor() {
    this.variable = 0;
  }
}
*/
export class EmptyComponent extends Component {}
