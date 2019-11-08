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
