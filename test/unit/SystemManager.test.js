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

test("passes attributes to system.init", t => {
  var world = new World();

  const attributes = { test: 10 };

  class SystemTest extends System {
    init(attributes) {
      this.attributes = attributes;
    }
  }

  world.registerSystem(SystemTest, attributes);
  const system = world.getSystem(SystemTest);
  t.deepEqual(system.attributes, attributes);
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
