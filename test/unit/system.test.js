var performance =
  typeof performance !== "undefined" ? performance : { now: () => 0 };

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
    ["SystemC", "SystemA", "SystemD", "SystemE", "SystemB"]
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
  world.entityManager.getEntity(0).addComponent(BarComponent);
  t.is(queries.fooNotBar.length, 4);
  t.is(queries.emptyNotBar.length, 4);

  // Removing BarComponent from entity0 will add it from the queries Not(BarComponent)
  world.entityManager.getEntity(0).removeComponent(BarComponent);
  t.is(queries.fooNotBar.length, 5);
  t.is(queries.emptyNotBar.length, 5);
});

test("queries_remove_entities_sync", t => {
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  // 10 Foo
  // 10 Bar
  for (var i = 0; i < 10; i++) {
    var entity = world.createEntity();
    entity.addComponent(FooComponent);
  }

  class SystemA extends System {
    init() {
      return {
        queries: {
          entities: {
            components: [FooComponent],
            events: {
              removed: {
                event: "EntityRemoved"
              }
            }
          }
        }
      };
    }
    execute() {
      var entities = this.queries.entities;
      for (var i = 0; i < entities.length; i++) {
        entities[i].remove(true);
      }
    }
  }

  class SystemB extends System {
    init() {
      return {
        queries: {
          entities: {
            components: [FooComponent],
            events: {
              removed: {
                event: "EntityRemoved"
              }
            }
          }
        }
      };
    }
    execute() {
      var entities = this.queries.entities;
      for (var i = 0, l = entities.length; i < l; i++) {
        entities[i].remove(true);
      }
    }
  }

  world.registerSystem(SystemA).registerSystem(SystemB);

  var systemA = world.systemManager.systems[0];
  var systemB = world.systemManager.systems[1];

  var entitiesA = systemA.queries.entities;
  var entitiesB = systemA.queries.entities;
  var entitiesRemovedA = systemA.events.entities.removed;
  var entitiesRemovedB = systemB.events.entities.removed;

  // Sync standard remove invalid loop
  t.is(entitiesA.length, 10);

  systemA.execute();

  // Just removed half because of the sync update of the array that throws an exception
  t.is(entitiesA.length, 5);
  t.is(entitiesRemovedA.length, 5);

  // Sync standard remove with stored length on invalid loop
  t.is(entitiesB.length, 5);
  const error = t.throws(() => {
    systemB.execute();
  }, Error);

  t.is(error.message, "Cannot read property 'remove' of undefined");

  // Just removed half because of the sync update of the array that throws an exception
  t.is(entitiesB.length, 2);
  t.is(entitiesRemovedB.length, 8);
});

test("queries_remove_entities_deferred", t => {
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  for (var i = 0; i < 6; i++) {
    var entity = world.createEntity();
    if (i < 4) entity.addComponent(FooComponent);
    if (i >= 2) entity.addComponent(BarComponent);
  }

  class SystemF extends System {
    init() {
      return {
        queries: {
          entities: {
            components: [FooComponent],
            events: {
              removed: {
                event: "EntityRemoved"
              }
            }
          }
        }
      };
    }
    execute() {
      this.queries.entities[1].remove();
      this.queries.entities[0].remove();
    }
  }

  class SystemFB extends System {
    init() {
      return {
        queries: {
          entities: {
            components: [FooComponent, BarComponent],
            events: {
              removed: {
                event: "EntityRemoved"
              }
            }
          }
        }
      };
    }
    execute() {
      // @todo Instead of removing backward should it work also forward?
      var entities = this.queries.entities;
      for (let i = entities.length - 1; i >= 0; i--) {
        entities[i].remove();
      }
    }
  }

  class SystemB extends System {
    init() {
      return {
        queries: {
          entities: {
            components: [BarComponent],
            events: {
              removed: {
                event: "EntityRemoved"
              }
            }
          }
        }
      };
    }
  }

  world
    .registerSystem(SystemF)
    .registerSystem(SystemFB)
    .registerSystem(SystemB);

  var systemF = world.systemManager.systems[0];
  var systemFB = world.systemManager.systems[1];
  var systemB = world.systemManager.systems[2];

  var entitiesF = systemF.queries.entities;
  var entitiesFB = systemFB.queries.entities;
  var entitiesB = systemB.queries.entities;
  var entitiesRemovedF = systemF.events.entities.removed;
  var entitiesRemovedFB = systemFB.events.entities.removed;
  var entitiesRemovedB = systemB.events.entities.removed;

  // [F,F,FB,FB,B,B]
  t.is(entitiesF.length, 4);
  t.is(entitiesFB.length, 2);
  t.is(entitiesB.length, 4);

  //world.execute();
  systemF.execute();

  // [-F,-F,FB,FB,B,B]
  // [FB,FB,B, B]
  t.is(entitiesF.length, 2);
  t.is(entitiesFB.length, 2);
  t.is(entitiesB.length, 4);
  t.is(entitiesRemovedF.length, 2);
  t.is(entitiesRemovedFB.length, 0);
  t.is(entitiesRemovedB.length, 0);

  // Clear the previously removed Fs
  systemF.clearEvents();
  t.is(entitiesRemovedF.length, 0);

  // Force remove on systemB
  // [-FB,-FB, B, B]
  // [B, B]
  systemFB.execute();
  t.is(entitiesF.length, 0);
  t.is(entitiesFB.length, 0);
  t.is(entitiesB.length, 2);
  t.is(entitiesRemovedF.length, 2);
  t.is(entitiesRemovedFB.length, 2);
  t.is(entitiesRemovedB.length, 2);

  // Process the deferred removals of entities
  t.is(world.entityManager.count(), 6);
  t.is(world.entityManager._entityPool.totalUsed(), 6);
  world.entityManager.processDeferredRemoval();
  t.is(world.entityManager._entityPool.totalUsed(), 2);
  t.is(world.entityManager.count(), 2);
});

test("queries_remove_multiple_components", t => {
  var world = new World();

  world
    .registerComponent(FooComponent)
    .registerComponent(BarComponent)
    .registerComponent(EmptyComponent);

  for (var i = 0; i < 6; i++) {
    var entity = world.createEntity();
    entity.addComponent(FooComponent).addComponent(BarComponent);
  }

  class SystemA extends System {
    init() {
      return {
        queries: {
          entities: {
            components: [FooComponent, BarComponent],
            events: {
              removed: {
                event: "EntityRemoved"
              }
            }
          },
          notTest: {
            components: [Not(FooComponent), BarComponent, EmptyComponent]
          }
        }
      };
    }
    execute() {
      this.events.entities.removed.forEach(entity => {
        t.true(entity.hasComponent(FooComponent, true));
        t.true(entity.hasComponent(BarComponent, true));
      });

      // this query should never match
      t.is(this.queries.notTest.length, 0);
    }
  }

  world.registerSystem(SystemA);

  var systemA = world.systemManager.systems[0];
  var entitiesA = systemA.queries.entities;
  var entitiesRemovedA = systemA.events.entities.removed;

  // Remove one entity => entityRemoved x1
  t.is(entitiesA.length, 6);
  world.entityManager.getEntity(0).remove();
  t.is(entitiesA.length, 5);
  t.is(entitiesRemovedA.length, 1);
  systemA.execute();
  systemA.clearEvents();

  // Remove both components => entityRemoved x1
  world.entityManager.getEntity(1).removeComponent(FooComponent);
  t.is(entitiesA.length, 4);
  t.is(entitiesRemovedA.length, 1);
  systemA.execute();

  // Remove second component => It will be the same result
  world.entityManager.getEntity(1).removeComponent(BarComponent);
  t.is(entitiesA.length, 4);
  t.is(entitiesRemovedA.length, 1);
  systemA.execute();
  systemA.clearEvents();

  // Remove entity and component deferred
  world.entityManager.getEntity(2).remove();
  world.entityManager.getEntity(2).removeComponent(FooComponent);
  world.entityManager.getEntity(2).removeComponent(BarComponent);
  t.is(entitiesA.length, 3);
  t.is(entitiesRemovedA.length, 1);
  systemA.execute();
  systemA.clearEvents();

  // Check deferred queues
  t.is(world.entityManager.count(), 6);
  t.is(world.entityManager.entitiesToRemove.length, 2);
  t.is(world.entityManager.entitiesWithComponentsToRemove.length, 2);

  t.is(world.entityManager._entityPool.totalUsed(), 6);
  world.entityManager.processDeferredRemoval();
  t.is(world.entityManager.entitiesWithComponentsToRemove.length, 0);
  t.is(world.entityManager._entityPool.totalUsed(), 4);
  t.is(world.entityManager.count(), 4);
  t.is(world.entityManager.entitiesToRemove.length, 0);
});

test("queries_remove_components_deferred", t => {
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  for (var i = 0; i < 6; i++) {
    var entity = world.createEntity();
    if (i < 4) entity.addComponent(FooComponent);
    if (i >= 2) entity.addComponent(BarComponent);
  }

  class SystemF extends System {
    init() {
      return {
        queries: {
          entities: {
            components: [FooComponent],
            events: {
              removed: {
                event: "EntityRemoved"
              }
            }
          }
        }
      };
    }
    execute() {
      this.queries.entities[0].removeComponent(FooComponent);
    }
  }

  class SystemFB extends System {
    init() {
      return {
        queries: {
          entities: {
            components: [FooComponent, BarComponent],
            events: {
              removed: {
                event: "EntityRemoved"
              }
            }
          }
        }
      };
    }
    execute() {
      // @todo Instead of removing backward should it work also forward?
      var entities = this.queries.entities;
      for (let i = entities.length - 1; i >= 0; i--) {
        entities[i].removeComponent(BarComponent);
      }
    }
  }

  class SystemB extends System {
    init() {
      return {
        queries: {
          entities: {
            components: [BarComponent],
            events: {
              removed: {
                event: "EntityRemoved"
              }
            }
          }
        }
      };
    }
  }

  world
    .registerSystem(SystemF)
    .registerSystem(SystemFB)
    .registerSystem(SystemB);

  var systemF = world.systemManager.systems[0];
  var systemFB = world.systemManager.systems[1];
  var systemB = world.systemManager.systems[2];

  var entitiesF = systemF.queries.entities;
  var entitiesFB = systemFB.queries.entities;
  var entitiesB = systemB.queries.entities;
  var entitiesRemovedF = systemF.events.entities.removed;
  var entitiesRemovedFB = systemFB.events.entities.removed;
  var entitiesRemovedB = systemB.events.entities.removed;

  // [F,F,FB,FB,B,B]
  t.is(entitiesF.length, 4);
  t.is(entitiesFB.length, 2);
  t.is(entitiesB.length, 4);

  //world.execute();
  systemF.execute();

  // [-F,F,FB,FB,B,B]
  // [F, FB,FB,B, B]
  t.is(entitiesF.length, 3);
  t.is(entitiesFB.length, 2);
  t.is(entitiesB.length, 4);

  t.is(entitiesRemovedF.length, 1);
  t.is(entitiesRemovedFB.length, 0);
  t.is(entitiesRemovedB.length, 0);

  // Clear the previously removed Fs
  systemF.clearEvents();
  systemF.clearEvents();
  t.is(entitiesRemovedF.length, 0);

  // Force remove on systemB
  // [F, F-B,F-B, B, B]
  // [F, F, F]
  systemFB.execute();

  t.is(entitiesF.length, 3);
  t.is(entitiesFB.length, 0);
  t.is(entitiesB.length, 2);

  t.is(entitiesRemovedF.length, 0);
  t.is(entitiesRemovedFB.length, 2);
  t.is(entitiesRemovedB.length, 2);

  // Process the deferred removals of components
  t.is(world.entityManager.entitiesWithComponentsToRemove.length, 3);
  world.entityManager.processDeferredRemoval();
  t.is(world.entityManager.entitiesWithComponentsToRemove.length, 0);
});

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

  var system = world.systemManager.systems[0];
  var query = system.queries.entities;
  var events = system.events.entities;
  var entity0 = world.entityManager.getEntity(0);

  // Entities from the standard query
  t.is(query.length, 15);

  // Added entities
  t.is(system.events.entities.added.length, 15);
  world.execute(); // After execute, events should be cleared
  t.is(system.events.entities.added.length, 0);
  system.clearEvents();

  // Add a new one
  world
    .createEntity()
    .addComponent(FooComponent)
    .addComponent(BarComponent);

  t.is(events.added.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(events.added.length, 0);

  // Changing
  entity0.getMutableComponent(FooComponent);
  t.is(events.changed.length, 1);
  t.is(events.fooChanged.length, 1);
  t.is(events.barChanged.length, 0);
  world.execute(); // After execute, events should be cleared
  t.is(events.changed.length, 0);

  entity0.getMutableComponent(BarComponent);
  t.is(events.changed.length, 1);
  t.is(events.fooChanged.length, 0);
  t.is(events.barChanged.length, 1);

  world.execute(); // After execute, events should be cleared
  t.is(events.changed.length, 0);
  t.is(events.barChanged.length, 0);
  // Check if the entity is already on the list?
  entity0.getMutableComponent(FooComponent);
  entity0.getMutableComponent(BarComponent);
  t.is(events.changed.length, 1);
  t.is(events.fooChanged.length, 1);
  t.is(events.barChanged.length, 1);

  world.execute(); // After execute, events should be cleared
  t.is(events.changed.length, 0);
  t.is(events.fooChanged.length, 0);
  t.is(events.barChanged.length, 0);

  // remove an entity
  entity0.remove();
  t.is(events.removed.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(events.removed.length, 0);

  // Removed
  entity0 = world.entityManager.getEntity(0);
  entity0.removeComponent(FooComponent);
  t.is(events.removed.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(events.removed.length, 0);

  // Added componets to the previous one
  entity0.addComponent(FooComponent);
  t.is(events.added.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(events.added.length, 0);

  // Remove all components from the first 5 entities
  for (i = 0; i < 5; i++) {
    world.entityManager.getEntity(i).removeAllComponents();
  }
  t.is(events.removed.length, 5);
  world.execute(); // After execute, events should be cleared
  t.is(events.removed.length, 0);

  // remove all entities
  world.entityManager.removeAllEntities();
  t.is(events.removed.length, 10);
  world.execute(); // After execute, events should be cleared
  t.is(events.removed.length, 0);
});
