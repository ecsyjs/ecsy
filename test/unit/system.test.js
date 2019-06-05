import test from "ava";
import { World, System, Not } from "../../src/index.js";
import {
  FooComponent,
  BarComponent,
  EmptyComponent
} from "../helpers/components";

test("init", t => {
  var world = new World();

  class SystemA extends System {}
  class SystemB extends System {}
  class SystemC extends System {}
  class SystemD extends System {}
  class SystemE extends System {}

  // Register empty system
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

  world.execute();
});

test("empty_queries", t => {
  var world = new World();

  class SystemEmpty0 extends System {}

  class SystemEmpty1 extends System {
    init() {}
  }

  class SystemEmpty2 extends System {
    init() {
      return {};
    }
  }

  class SystemEmpty3 extends System {
    init() {
      return { queries: {} };
    }
  }

  class SystemEmpty4 extends System {
    init() {
      return {
        queries: {
          entities: {}
        }
      };
    }
  }

  class SystemEmpty5 extends System {
    init() {
      return {
        queries: {
          entities: { components: [] }
        }
      };
    }
  }

  // Register empty system
  world
    .registerSystem(SystemEmpty0)
    .registerSystem(SystemEmpty1)
    .registerSystem(SystemEmpty2)
    .registerSystem(SystemEmpty3);

  t.deepEqual(world.systemManager.systems[0].queries, {});
  t.deepEqual(world.systemManager.systems[1].queries, {});
  t.deepEqual(world.systemManager.systems[2].queries, {});
  t.deepEqual(world.systemManager.systems[3].queries, {});

  const error = t.throws(() => {
    world.registerSystem(SystemEmpty4);
  }, Error);

  t.is(error.message, "'components' attribute can't be empty in a query");

  const error2 = t.throws(() => {
    world.registerSystem(SystemEmpty5);
  }, Error);
  t.is(error2.message, "'components' attribute can't be empty in a query");
});

test("queries", t => {
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  for (var i = 0; i < 15; i++) {
    var entity = world.createEntity();
    if (i < 10) entity.addComponent(FooComponent);
    if (i >= 5) entity.addComponent(BarComponent);
    entity.addComponent(EmptyComponent);
  }

  class SystemFoo extends System {
    init() {
      return {
        queries: {
          entities: { components: [FooComponent] }
        }
      };
    }
  }

  class SystemBar extends System {
    init() {
      return {
        queries: {
          entities: { components: [BarComponent] }
        }
      };
    }
  }

  class SystemBoth extends System {
    init() {
      return {
        queries: {
          entities: { components: [FooComponent, BarComponent] }
        }
      };
    }
  }

  world
    .registerSystem(SystemFoo)
    .registerSystem(SystemBar)
    .registerSystem(SystemBoth);

  // Foo
  t.is(world.systemManager.systems[0].queries.entities.length, 10);
  // Bar
  t.is(world.systemManager.systems[1].queries.entities.length, 10);
  // Both
  t.is(world.systemManager.systems[2].queries.entities.length, 5);
});

test("queries_not", t => {
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  // 10 Foo
  // 10 Bar
  // 15 Empty
  for (var i = 0; i < 15; i++) {
    var entity = world.createEntity();
    if (i < 10) entity.addComponent(FooComponent);
    if (i >= 5) entity.addComponent(BarComponent);
    entity.addComponent(EmptyComponent);
  }

  class SystemNotNot extends System {
    init() {
      return {
        queries: {
          notFoo: { components: [Not(FooComponent), Not(BarComponent)] }
        }
      };
    }
  }

  const error = t.throws(() => {
    world.registerSystem(SystemNotNot);
  }, Error);

  t.is(error.message, "Can't create a query without components");

  class SystemNotBar extends System {
    init() {
      return {
        queries: {
          fooNotBar: { components: [FooComponent, Not(BarComponent)] },
          emptyNotBar: { components: [EmptyComponent, Not(BarComponent)] },
          emptyNotBarFoo: {
            components: [EmptyComponent, Not(BarComponent), Not(FooComponent)]
          }
        }
      };
    }
  }

  world.registerSystem(SystemNotBar);
  var queries = world.systemManager.systems[0].queries;

  t.is(queries.fooNotBar.length, 5);
  t.is(queries.emptyNotBar.length, 5);
  t.is(queries.emptyNotBarFoo.length, 0);

  // Adding BarComponent to entity0 will remove it from the queries Not(BarComponent)
  world.entityManager._entities[0].addComponent(BarComponent);
  t.is(queries.fooNotBar.length, 4);
  t.is(queries.emptyNotBar.length, 4);

  // Removing BarComponent from entity0 will add it from the queries Not(BarComponent)
  world.entityManager._entities[0].removeComponent(BarComponent);
  t.is(queries.fooNotBar.length, 5);
  t.is(queries.emptyNotBar.length, 5);
});

/*
test("reactive", t => {
  var world = new World();

  class ReactiveSystem extends System {
    init() {
      return {
        queries: {
          entities: {
            components: [FooComponent, BarComponent],
            events: {
              added: {
                event: "EntityAdded"
              },
              removed: {
                event: "EntityRemoved"
              },
              changed: {
                event: "EntityChanged"
              },
              fooChanged: {
                event: "ComponentChanged",
                components: [FooComponent]
              },
              barChanged: {
                event: "ComponentChanged",
                components: [BarComponent]
              },
              foobarChanged: {
                event: "ComponentChanged",
                components: [FooComponent, BarComponent]
              }
            }
          }
        }
      };
    }
  }

  // Register empty system
  world.registerSystem(ReactiveSystem);

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  for (var i = 0; i < 15; i++) {
    world
      .createEntity()
      .addComponent(FooComponent)
      .addComponent(BarComponent);
  }

  // Entities from the standard query
  t.is(world.systemManager.systems[0].queries.entities.length, 15);

  // Added entities
  t.is(world.systemManager.systems[0].events.entities.added.length, 15);
  world.execute(); // After execute, events should be cleared
  t.is(world.systemManager.systems[0].events.entities.added.length, 0);

  // Add a new one
  world
    .createEntity()
    .addComponent(FooComponent)
    .addComponent(BarComponent);
  t.is(world.systemManager.systems[0].events.entities.added.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(world.systemManager.systems[0].events.entities.added.length, 0);

  // Changing
  world.entityManager._entities[0].getMutableComponent(FooComponent);
  t.is(world.systemManager.systems[0].events.entities.changed.length, 1);
  t.is(world.systemManager.systems[0].events.entities.fooChanged.length, 1);
  t.is(world.systemManager.systems[0].events.entities.barChanged.length, 0);
  t.is(world.systemManager.systems[0].events.entities.foobarChanged.length, 0);
  world.execute(); // After execute, events should be cleared
  t.is(world.systemManager.systems[0].events.entities.changed.length, 0);
  t.is(world.systemManager.systems[0].events.entities.fooChanged.length, 0);

  world.entityManager._entities[0].getMutableComponent(BarComponent);
  t.is(world.systemManager.systems[0].events.entities.changed.length, 1);
  t.is(world.systemManager.systems[0].events.entities.fooChanged.length, 0);
  t.is(world.systemManager.systems[0].events.entities.barChanged.length, 1);
  t.is(world.systemManager.systems[0].events.entities.foobarChanged.length, 0);
  world.execute(); // After execute, events should be cleared
  t.is(world.systemManager.systems[0].events.entities.changed.length, 0);
  t.is(world.systemManager.systems[0].events.entities.barChanged.length, 0);

  // Check if the entity is already on the list?
  world.entityManager._entities[0].getMutableComponent(FooComponent);
  world.entityManager._entities[0].getMutableComponent(BarComponent);
  t.is(world.systemManager.systems[0].events.entities.changed.length, 1);
  t.is(world.systemManager.systems[0].events.entities.fooChanged.length, 1);
  t.is(world.systemManager.systems[0].events.entities.barChanged.length, 1);
  t.is(world.systemManager.systems[0].events.entities.foobarChanged.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(world.systemManager.systems[0].events.entities.changed.length, 0);
  t.is(world.systemManager.systems[0].events.entities.fooChanged.length, 0);
  t.is(world.systemManager.systems[0].events.entities.barChanged.length, 0);
  t.is(world.systemManager.systems[0].events.entities.foobarChanged.length, 0);

  // Dispose an entity
  world.entityManager._entities[0].dispose();
  t.is(world.systemManager.systems[0].events.entities.removed.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(world.systemManager.systems[0].events.entities.removed.length, 0);

  // Removed
  world.entityManager._entities[0].removeComponent(FooComponent);
  t.is(world.systemManager.systems[0].events.entities.removed.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(world.systemManager.systems[0].events.entities.removed.length, 0);

  // Added componets to the previous one
  world.entityManager._entities[0].addComponent(FooComponent);
  t.is(world.systemManager.systems[0].events.entities.added.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(world.systemManager.systems[0].events.entities.added.length, 0);

  // Remove all components from the first 5 entities
  for (i = 0; i < 5; i++) {
    world.entityManager._entities[i].removeAllComponents();
  }
  t.is(world.systemManager.systems[0].events.entities.removed.length, 5);
  world.execute(); // After execute, events should be cleared
  t.is(world.systemManager.systems[0].events.entities.removed.length, 0);

  // Dispose all entities
  world.entityManager.removeAllEntities();
  t.is(world.systemManager.systems[0].events.entities.removed.length, 10);
  world.execute(); // After execute, events should be cleared
  t.is(world.systemManager.systems[0].events.entities.removed.length, 0);
});
*/
