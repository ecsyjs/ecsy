import { Component, Types } from "../../build/ecsy.module.js";
import { Vector2Type } from "./math.js";

export class Movement extends Component {}

Movement.schema = {
  velocity: { type: Vector2Type },
  acceleration: { type: Vector2Type },
};

export class Circle extends Component {}

Circle.schema = {
  position: { type: Vector2Type },
  radius: { type: Types.Number },
  velocity: { type: Vector2Type },
  acceleration: { type: Vector2Type },
};

export class CanvasContext extends Component {}

CanvasContext.schema = {
  ctx: { type: Types.Ref },
  width: { type: Types.Number },
  height: { type: Types.Number },
};

export class DemoSettings extends Component {}

DemoSettings.schema = {
  speedMultiplier: { type: Types.Number, default: 0.001 },
};

export class Intersecting extends Component {}

Intersecting.schema = {
  points: { type: Types.Array },
};
