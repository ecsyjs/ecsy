import test from "ava";
import { World, System } from "../../src/index.js";
import { FooComponent, BarComponent } from "../helpers/components";

test("Stats", async (t) => {
  var world = new World();

  class SystemA extends System {}
  SystemA.queries = {
    compFoo: { components: [FooComponent] },
    compBar: { components: [BarComponent] },
    compBtoh: { components: [FooComponent, BarComponent] },
  };

  world
    .registerComponent(FooComponent)
    .registerComponent(BarComponent)
    .registerSystem(SystemA);

  // Add a new component and check it exist
  for (var i = 0; i < 10; i++) {
    let entity = world.createEntity();
    entity.addComponent(FooComponent);
    if (i > 5) {
      entity.addComponent(BarComponent);
    }
  }

  t.deepEqual(world.stats(), {
    entities: {
      numEntities: 10,
      numQueries: 3,
      queries: {
        0: {
          numComponents: 1,
          numEntities: 10,
        },
        1: {
          numComponents: 1,
          numEntities: 4,
        },
        "0-1": {
          numComponents: 2,
          numEntities: 4,
        },
      },
      numComponentPool: 2,
      componentPool: {
        FooComponent: {
          used: 10,
          size: 12,
        },
        BarComponent: {
          used: 4,
          size: 5,
        },
      },
      eventDispatcher: {
        fired: 24,
        handled: 0,
      },
    },
    system: {
      numSystems: 1,
      systems: {
        SystemA: {
          queries: {},
          executeTime: 0,
        },
      },
    },
  });
});
