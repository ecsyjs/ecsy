import "../helpers/common.js";
import test from "ava";
import { World, System } from "../../src/index.js";

test("registerSystems", t => {
  var world = new World();

  class SystemA extends System {}
  class SystemB extends System {}

  world.registerSystem(SystemA);
  t.is(world.systemManager._systems.length, 1);
  world.registerSystem(SystemB);
  t.is(world.systemManager._systems.length, 2);

  // Can't register twice the same system
  world.registerSystem(SystemA);
  t.is(world.systemManager._systems.length, 2);
});

test("Copies attributes to created system", t => {
  var world = new World();

  var mockAttributes = { testAttribute: 10 };

  class mockSystem {}

  world.registerSystem(mockSystem, mockAttributes);
  t.is(world.systemManager._systems[0].testAttribute, 10);
});
