import test from "ava";
import { World, System, Not, Component } from "../../src/index.js";
import { FooComponent, BarComponent } from "../helpers/components";

function queriesLength(queries) {
  let result = {};
  Object.entries(queries).forEach((q) => {
    const name = q[0];
    const values = q[1];
    result[name] = values.length;
  });

  return result;
}

test("Reactive queries with Not operator", (t) => {
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

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
        removed: true,
      },
    },
    not: {
      components: [FooComponent, Not(BarComponent)],
      listen: {
        added: true,
        changed: true,
        removed: true,
      },
    },
  };

  // Register empty system
  world.registerSystem(SystemTest);

  let system = world.systemManager.getSystem(SystemTest);

  // Both queries starts empty
  t.deepEqual(queriesLength(system.queries.normal), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0,
  });

  t.deepEqual(queriesLength(system.queries.not), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0,
  });

  //
  let entity = world.createEntity().addComponent(FooComponent);

  // It doesn't match the `BarComponent`
  t.deepEqual(queriesLength(system.queries.normal), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0,
  });

  // It matches the `Not(BarComponent)`
  t.deepEqual(queriesLength(system.queries.not), {
    added: 1,
    changed: 0,
    removed: 0,
    results: 1,
  });

  // clean up reactive queries
  world.execute();

  entity.addComponent(BarComponent);

  // It matches the `BarComponent`
  t.deepEqual(queriesLength(system.queries.normal), {
    added: 1,
    changed: 0,
    removed: 0,
    results: 1,
  });

  // It does not match `Not(BarComponent)` so it's being removed
  t.deepEqual(queriesLength(system.queries.not), {
    added: 0,
    changed: 0,
    removed: 1,
    results: 0,
  });

  // clean up
  world.execute();
  entity.removeComponent(BarComponent);

  // It doesn't match `BarComponent` anymore, so it's being removed
  t.deepEqual(queriesLength(system.queries.normal), {
    added: 0,
    changed: 0,
    removed: 1,
    results: 0,
  });

  // It does match `Not(BarComponent)` so it's being added
  t.deepEqual(queriesLength(system.queries.not), {
    added: 1,
    changed: 0,
    removed: 0,
    results: 1,
  });
});

test("Entity living just within the frame", (t) => {
  var world = new World();

  world.registerComponent(FooComponent);

  // System 1
  class SystemTest extends System {
    execute() {}
  }

  SystemTest.queries = {
    normal: {
      components: [FooComponent],
      listen: {
        added: true,
        changed: true,
        removed: true,
      },
    },
  };

  // Register empty system
  world.registerSystem(SystemTest);

  let system = world.systemManager.getSystem(SystemTest);
  let query = system.queries.normal;

  // Query starts empty
  t.deepEqual(queriesLength(query), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0,
  });

  let entity = world.createEntity().addComponent(FooComponent);

  // Adding `FooComponent` on frame #0 it's added and matches the results query too
  t.deepEqual(queriesLength(query), {
    added: 1,
    changed: 0,
    removed: 0,
    results: 1,
  });

  let addedEntity = query.added[0];
  let resultEntity = query.results[0];

  t.true(addedEntity.getComponent(FooComponent) !== undefined);
  t.true(resultEntity.getComponent(FooComponent) !== undefined);

  entity.removeComponent(FooComponent);

  // After removing the component on the same frame #0, it's still in the `added` list
  // added also to the `remove` list, but removed from the `results`
  t.deepEqual(queriesLength(query), {
    added: 1,
    changed: 0,
    removed: 1,
    results: 0,
  });

  addedEntity = query.added[0];
  let removedEntity = query.removed[0];

  // As the component has been removed, `getComponent` won't return it
  t.true(removedEntity.getComponent(FooComponent) === undefined);

  // But both, `getComponent(_, true)` or `getRemovedComponent` will success
  t.true(removedEntity.getComponent(FooComponent, true) !== undefined);
  t.true(removedEntity.getRemovedComponent(FooComponent) !== undefined);

  // The entity has been removed from the query so `getComponent` won't return it either
  t.true(addedEntity.getComponent(FooComponent) === undefined);

  // Advance 1 frame
  world.execute();

  // Now it's not available anymore as it was purged
  t.deepEqual(queriesLength(query), {
    added: 0,
    changed: 0,
    removed: 0,
    results: 0,
  });
});

test("Two components with the same name get unique queries", (t) => {
  const world = new World();

  // Create two components that have the same name.
  function createComponentClass() {
    return class TestComponent extends Component {};
  }
  const Component1 = createComponentClass();
  const Component2 = createComponentClass();
  world.registerComponent(Component1);
  world.registerComponent(Component2);
  t.is(Component1.name, Component2.name);

  // Create an entity for each component.
  const entity1 = world.createEntity().addComponent(Component1);
  const entity2 = world.createEntity().addComponent(Component2);

  // Define two queries, one for each entity.
  class SystemTest extends System {
    execute() {}
  }
  SystemTest.queries = {
    comp1: { components: [Component1] },
    comp2: { components: [Component2] },
  };
  world.registerSystem(SystemTest);

  // Verify that the query system can identify them as unique components.
  const system = world.systemManager.getSystem(SystemTest);
  const query1Entity = system.queries.comp1.results[0];
  const query2Entity = system.queries.comp2.results[0];

  t.is(query1Entity.id, entity1.id);
  t.is(query2Entity.id, entity2.id);
});
