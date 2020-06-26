import { Component, TagComponent, Types } from "../../../build/ecsy.module.js";

export class Collisionable extends TagComponent {}
export class Collider extends TagComponent {}
export class Recovering extends TagComponent {}
export class Moving extends TagComponent {}

export class PulsatingScale extends Component {}

PulsatingScale.schema = {
  offset: { type: Types.Number, default: 0 }
};

export class Object3D extends Component {}

Object3D.schema = {
  object: { type: Types.Ref }
};

export class Timeout extends Component {}

Timeout.schema = {
  timer: { type: Types.Number },
  addComponents: { type: Types.Array },
  removeComponents: { type: Types.Array }
};

export class PulsatingColor extends Component {}

PulsatingColor.schema = {
  offset: { type: Types.Number }
};

export class Colliding extends Component {}

Colliding.schema = {
  value: { type: Types.Boolean }
};

export class Rotating extends Component {}

Rotating.schema = {
  enabled: { type: Types.Boolean },
  rotatingSpeed: { type: Types.Number },
  decreasingSpeed: { type: Types.Number, default: 0.001 }
};
