import test from "ava";
import { World, System, Not } from "../../src/index.js";
import { FooComponent, BarComponent } from "../helpers/components";

function queriesLength(queries) {
  let result = {};
  Object.entries(queries).forEach(q => {
    const name = q[0];
    const values = q[1];
    result[name] = values.length;
  });

  return result;
}

test("Reactive queries with Not operator", t => {
  var world = new World();

  // System 1
  class SystemTest extends System {
    execute() {}
  }

  SystemTest.queries = {
    normal: {
      components: [FooComponent, BarComponent],
      listen: {
        added: true,
        changed: true,
        removed: true
      }
    },
    not: {
      components: [FooComponent, Not(BarComponent)],
      listen: {
        added: true,
        changed: true,
        removed: true
      }
    }
  };

  // Register empty system
  world.registerSystem(SystemTest);

  let system = world.systemManager.getSystem(SystemTest);

  // Both queries starts empty
  t.deepEqual(queriesLength(system.queries.normal), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0
  });

  t.deepEqual(queriesLength(system.queries.not), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0
  });

  //
  let entity = world.createEntity().addComponent(FooComponent);

  // It doesn't match the `BarComponent`
  t.deepEqual(queriesLength(system.queries.normal), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0
  });

  // It matches the `Not(BarComponent)`
  t.deepEqual(queriesLength(system.queries.not), {
    added: 1,
    changed: 0,
    removed: 0,
    results: 1
  });

  // clean up reactive queries
  world.execute();

  entity.addComponent(BarComponent);

  // It matches the `BarComponent`
  t.deepEqual(queriesLength(system.queries.normal), {
    added: 1,
    changed: 0,
    removed: 0,
    results: 1
  });

  // It does not match `Not(BarComponent)` so it's being removed
  t.deepEqual(queriesLength(system.queries.not), {
    added: 0,
    changed: 0,
    removed: 1,
    results: 0
  });

  // clean up
  world.execute();
  entity.removeComponent(BarComponent);

  // It doesn't match `BarComponent` anymore, so it's being removed
  t.deepEqual(queriesLength(system.queries.normal), {
    added: 0,
    changed: 0,
    removed: 1,
    results: 0
  });

  // It does match `Not(BarComponent)` so it's being added
  t.deepEqual(queriesLength(system.queries.not), {
    added: 1,
    changed: 0,
    removed: 0,
    results: 1
  });
});
