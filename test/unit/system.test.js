import test from "ava";
import { World, System } from "../../src/index.js";
import { FooComponent, BarComponent } from "../helpers/components";

class SystemA extends System {}
class SystemB extends System {}
class SystemC extends System {}
class SystemD extends System {}
class SystemE extends System {}

/**
 * TODO
 * - IDs
 * - tags
 */

test("init", t => {
  var world = new World();

  world
    .registerSystem(SystemA)
    .registerSystem(SystemB)
    .registerSystem(SystemC)
    .registerSystem(SystemD)
    .registerSystem(SystemE);

  t.deepEqual(
    world.systemManager.systems.map(s => {
      return s.constructor.name;
    }),
    ["SystemA", "SystemB", "SystemC", "SystemD", "SystemE"]
  );

  world = new World();
  world
    .registerSystem(SystemA)
    .registerSystem(SystemB, { priority: 2 })
    .registerSystem(SystemC, { priority: -1 })
    .registerSystem(SystemD)
    .registerSystem(SystemE);

  t.deepEqual(
    world.systemManager.systems.map(s => {
      return s.constructor.name;
    }),
    ["SystemB", "SystemA", "SystemD", "SystemE", "SystemC"]
  );
/*
  world = new World();
  world
    .registerSystem(SystemA, { before: SystemC })
    .registerSystem(SystemB)
    .registerSystem(SystemC, { after: SystemE })
    .registerSystem(SystemD)
    .registerSystem(SystemE, { after: SystemB });

  t.deepEqual(
    world.systemManager.systems.map(s => {
      return s.constructor.name;
    }),
    ["SystemB", "SystemE", "SystemC", "SystemA", "SystemD"]
  );
*/
});
