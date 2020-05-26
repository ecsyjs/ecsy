import test from "ava";
import { World, System } from "../../src/index.js";

test("registerSystems", t => {
  let world = new World();

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

test("registerSystems with different systems matching names", t => {
  let world = new World();

  function importSystemA() {
    class SystemWithCommonName extends System {}
    return SystemWithCommonName;
  }
  function importSystemB() {
    class SystemWithCommonName extends System {}
    return SystemWithCommonName;
  }

  let SystemA = importSystemA();
  let SystemB = importSystemB();

  world.registerSystem(SystemA);
  t.is(world.systemManager._systems.length, 1);
  world.registerSystem(SystemB);
  t.is(world.systemManager._systems.length, 2);

  // Can't register twice the same system
  world.registerSystem(SystemA);
  t.is(world.systemManager._systems.length, 2);
});
