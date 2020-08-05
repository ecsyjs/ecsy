import test from "ava";
import { World, Component } from "../../src/index.js";
import { FooComponent, BarComponent } from "../helpers/components";

test("registerComponents", (t) => {
  var world = new World();

  world.registerComponent(FooComponent);
  t.is(Object.keys(world.componentsManager.Components).length, 1);
  world.registerComponent(BarComponent);
  t.is(Object.keys(world.componentsManager.Components).length, 2);

  // Can't register the same component twice
  world.registerComponent(FooComponent);
  t.is(Object.keys(world.componentsManager.Components).length, 2);
});

test("Register two components with the same name", (t) => {
  var world = new World();

  {
    class ComponentA extends Component {}
    world.registerComponent(ComponentA);
  }

  {
    class ComponentA extends Component {}
    world.registerComponent(ComponentA);
  }

  t.is(Object.keys(world.componentsManager.Components).length, 2);
});
