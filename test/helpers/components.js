import { Component } from "../../src/Component";
import { Types } from "../../src/Types";

export class FooComponent extends Component {}

FooComponent.schema = {
  variableFoo: { type: Types.Number }
};

export class BarComponent extends Component {}

BarComponent.schema = {
  variableBar: { type: Types.Number }
};

export class EmptyComponent extends Component {}
