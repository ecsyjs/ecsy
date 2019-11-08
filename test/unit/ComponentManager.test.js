import test from "ava";
import { World } from "../../src/index.js";
import { FooComponent, BarComponent } from "../helpers/components";

test("registerComponents", t => {
  var world = new World();

  world.registerComponent(FooComponent);
  t.is(Object.keys(world.componentsManager.Components).length, 1);
  world.registerComponent(BarComponent);
  t.is(Object.keys(world.componentsManager.Components).length, 2);

  // Can't register twice the same component
  world.registerComponent(FooComponent);
  t.is(Object.keys(world.componentsManager.Components).length, 2);
});
