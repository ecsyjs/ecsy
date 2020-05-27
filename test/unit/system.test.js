import test from "ava";
import { World, System, Not } from "../../src/index.js";
import {
  FooComponent,
  BarComponent,
  EmptyComponent
} from "../helpers/components";
/*
test("Initialize", t => {
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
    world.systemManager.getSystems().map(s => {
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
    world.systemManager.getSystems().map(s => {
      return s.constructor.name;
    }),
    ["SystemC", "SystemA", "SystemD", "SystemE", "SystemB"]
  );
  world.execute();
});
*/

test("Empty queries", t => {
  var world = new World();

  // System 1
  class SystemEmpty1 extends System {}

  // System 2
  class SystemEmpty2 extends System {}

  SystemEmpty2.queries = {};

  // System 3
  class SystemEmpty3 extends System {}

  SystemEmpty3.queries = {
    entities: {}
  };

  // System 4
  class SystemEmpty4 extends System {}

  SystemEmpty4.queries = {
    entities: { components: [] }
  };

  // Register empty system
  world.registerSystem(SystemEmpty1).registerSystem(SystemEmpty2);

  t.deepEqual(world.systemManager.getSystem(SystemEmpty1).queries, {});
  t.deepEqual(world.systemManager.getSystem(SystemEmpty2).queries, {});

  const error = t.throws(() => {
    world.registerSystem(SystemEmpty3);
  }, Error);

  t.is(error.message, "'components' attribute can't be empty in a query");
  const error2 = t.throws(() => {
    world.registerSystem(SystemEmpty4);
  }, Error);
  t.is(error2.message, "'components' attribute can't be empty in a query");
});

test("Queries", t => {
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  for (var i = 0; i < 15; i++) {
    var entity = world.createEntity();
    if (i < 10) entity.addComponent(FooComponent);
    if (i >= 5) entity.addComponent(BarComponent);
    entity.addComponent(EmptyComponent);
  }

  class SystemFoo extends System {}

  SystemFoo.queries = {
    entities: { components: [FooComponent] }
  };

  class SystemBar extends System {}

  SystemBar.queries = {
    entities: { components: [BarComponent] }
  };

  class SystemBoth extends System {}

  SystemBoth.queries = {
    entities: { components: [FooComponent, BarComponent] }
  };

  world
    .registerSystem(SystemFoo)
    .registerSystem(SystemBar)
    .registerSystem(SystemBoth);

  // Foo
  t.is(
    world.systemManager.getSystem(SystemFoo).queries.entities.results.length,
    10
  );
  // Bar
  t.is(
    world.systemManager.getSystem(SystemBar).queries.entities.results.length,
    10
  );
  // Both
  t.is(
    world.systemManager.getSystem(SystemBoth).queries.entities.results.length,
    5
  );
});

test("Queries with 'Not' operator", t => {
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

  class SystemNotNot extends System {}

  SystemNotNot.queries = {
    notFoo: { components: [Not(FooComponent), Not(BarComponent)] }
  };

  const error = t.throws(() => {
    world.registerSystem(SystemNotNot);
  }, Error);

  t.is(error.message, "Can't create a query without components");

  class SystemNotBar extends System {}

  SystemNotBar.queries = {
    fooNotBar: { components: [FooComponent, Not(BarComponent)] },
    emptyNotBar: { components: [EmptyComponent, Not(BarComponent)] },
    emptyNotBarFoo: {
      components: [EmptyComponent, Not(BarComponent), Not(FooComponent)]
    }
  };

  world.registerSystem(SystemNotBar);
  var queries = world.systemManager.getSystems()[0].queries;

  t.is(queries.fooNotBar.results.length, 5);
  t.is(queries.emptyNotBar.results.length, 5);
  t.is(queries.emptyNotBarFoo.results.length, 0);

  // Adding BarComponent to entity0 will remove it from the queries Not(BarComponent)
  world.entityManager._entities[0].addComponent(BarComponent);
  t.is(queries.fooNotBar.results.length, 4);
  t.is(queries.emptyNotBar.results.length, 4);

  // Removing BarComponent from entity0 will add it from the queries Not(BarComponent)
  world.entityManager._entities[0].removeComponent(BarComponent);
  t.is(queries.fooNotBar.results.length, 5);
  t.is(queries.emptyNotBar.results.length, 5);
});

test("Queries with sync removal", t => {
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  // 10 Foo
  // 10 Bar
  for (var i = 0; i < 10; i++) {
    var entity = world.createEntity();
    entity.addComponent(FooComponent);
  }

  class SystemA extends System {
    execute() {
      var entities = this.queries.entities.results;
      for (var i = 0; i < entities.length; i++) {
        entities[i].remove(true);
      }
    }
  }

  SystemA.queries = {
    entities: {
      components: [FooComponent],
      listen: {
        removed: true
      }
    }
  };

  class SystemB extends System {
    execute() {
      var entities = this.queries.entities.results;
      for (var i = 0, l = entities.length; i < l; i++) {
        entities[i].remove(true);
      }
    }
  }

  SystemB.queries = {
    entities: {
      components: [FooComponent],
      listen: {
        removed: true
      }
    }
  };

  world.registerSystem(SystemA).registerSystem(SystemB);

  var systemA = world.systemManager.getSystems()[0];
  var systemB = world.systemManager.getSystems()[1];

  var entitiesA = systemA.queries.entities.results;
  var entitiesB = systemA.queries.entities.results;
  var entitiesRemovedA = systemA.queries.entities.removed;
  var entitiesRemovedB = systemB.queries.entities.removed;

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

test("Queries with deferred removal", t => {
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  for (var i = 0; i < 6; i++) {
    var entity = world.createEntity();
    if (i < 4) entity.addComponent(FooComponent);
    if (i >= 2) entity.addComponent(BarComponent);
  }

  class SystemF extends System {
    execute() {
      this.queries.entities.results[1].remove();
      this.queries.entities.results[0].remove();
    }
  }

  SystemF.queries = {
    entities: {
      components: [FooComponent],
      listen: {
        removed: true
      }
    }
  };

  class SystemFB extends System {
    execute() {
      // @todo Instead of removing backward should it work also forward?
      var entities = this.queries.entities.results;
      for (let i = entities.length - 1; i >= 0; i--) {
        entities[i].remove();
      }
    }
  }

  SystemFB.queries = {
    entities: {
      components: [FooComponent, BarComponent],
      listen: {
        removed: true
      }
    }
  };

  class SystemB extends System {}

  SystemB.queries = {
    entities: {
      components: [BarComponent],
      listen: {
        removed: true
      }
    }
  };

  world
    .registerSystem(SystemF)
    .registerSystem(SystemFB)
    .registerSystem(SystemB);

  var systemF = world.systemManager.getSystem(SystemF);
  var systemFB = world.systemManager.getSystem(SystemFB);
  var systemB = world.systemManager.getSystem(SystemB);

  var entitiesF = systemF.queries.entities.results;
  var entitiesFB = systemFB.queries.entities.results;
  var entitiesB = systemB.queries.entities.results;
  var entitiesRemovedF = systemF.queries.entities.removed;
  var entitiesRemovedFB = systemFB.queries.entities.removed;
  var entitiesRemovedB = systemB.queries.entities.removed;

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
  t.is(world.entityManager._entities.length, 6);
  t.is(world.entityManager._entityPool.totalUsed(), 6);
  world.entityManager.processDeferredRemoval();
  t.is(world.entityManager._entityPool.totalUsed(), 2);
  t.is(world.entityManager._entities.length, 2);
});

test("Queries removing multiple components", t => {
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
    execute() {
      this.queries.entities.removed.forEach(entity => {
        t.false(entity.hasComponent(FooComponent));
        t.true(entity.hasRemovedComponent(FooComponent));
      });

      // this query should never match
      t.is(this.queries.notTest.results.length, 0);
    }
  }

  SystemA.queries = {
    entities: {
      components: [FooComponent, BarComponent],
      listen: {
        removed: true
      }
    },
    notTest: {
      components: [Not(FooComponent), BarComponent, EmptyComponent]
    }
  };

  world.registerSystem(SystemA);

  var systemA = world.systemManager.getSystem(SystemA);
  var query = systemA.queries.entities;
  var entitiesA = query.results;
  var entitiesRemovedA = query.removed;

  // Remove one entity => entityRemoved x1
  t.is(entitiesA.length, 6);
  world.entityManager._entities[0].remove();
  t.is(entitiesA.length, 5);
  t.is(entitiesRemovedA.length, 1);
  systemA.execute();
  systemA.clearEvents();

  // Remove both components => entityRemoved x1
  world.entityManager._entities[1].removeComponent(FooComponent);
  t.is(entitiesA.length, 4);
  t.is(entitiesRemovedA.length, 1);
  systemA.execute();
  // Remove second component => It will be the same result
  world.entityManager._entities[1].removeComponent(BarComponent);
  t.is(entitiesA.length, 4);
  t.is(entitiesRemovedA.length, 1);
  systemA.execute();
  systemA.clearEvents();

  // Remove entity and component deferred
  world.entityManager._entities[2].remove();
  world.entityManager._entities[2].removeComponent(FooComponent);
  world.entityManager._entities[2].removeComponent(BarComponent);
  t.is(entitiesA.length, 3);
  t.is(entitiesRemovedA.length, 1);
  systemA.execute();
  systemA.clearEvents();

  // Check deferred queues
  t.is(world.entityManager._entities.length, 6);
  t.is(world.entityManager.entitiesToRemove.length, 2);
  t.is(world.entityManager.entitiesWithComponentsToRemove.length, 3);

  t.is(world.entityManager._entityPool.totalUsed(), 6);
  world.entityManager.processDeferredRemoval();
  t.is(world.entityManager.entitiesWithComponentsToRemove.length, 0);
  t.is(world.entityManager._entityPool.totalUsed(), 4);
  t.is(world.entityManager._entities.length, 4);
  t.is(world.entityManager.entitiesToRemove.length, 0);
});

test("Querries removing deferred components", t => {
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  for (var i = 0; i < 6; i++) {
    var entity = world.createEntity();
    if (i < 4) entity.addComponent(FooComponent);
    if (i >= 2) entity.addComponent(BarComponent);
  }

  class SystemF extends System {
    execute() {
      this.queries.entities.results[0].removeComponent(FooComponent);
    }
  }

  SystemF.queries = {
    entities: {
      components: [FooComponent],
      listen: {
        removed: true
      }
    }
  };

  class SystemFB extends System {
    execute() {
      // @todo Instead of removing backward should it work also forward?
      var entities = this.queries.entities.results;
      for (let i = entities.length - 1; i >= 0; i--) {
        entities[i].removeComponent(BarComponent);
      }
    }
  }

  SystemFB.queries = {
    entities: {
      components: [FooComponent, BarComponent],
      listen: {
        removed: true
      }
    }
  };

  class SystemB extends System {}

  SystemB.queries = {
    entities: {
      components: [BarComponent],
      listen: {
        removed: true
      }
    }
  };

  world
    .registerSystem(SystemF)
    .registerSystem(SystemFB)
    .registerSystem(SystemB);

  var systemF = world.systemManager.getSystems()[0];
  var systemFB = world.systemManager.getSystems()[1];
  var systemB = world.systemManager.getSystems()[2];

  var entitiesF = systemF.queries.entities.results;
  var entitiesFB = systemFB.queries.entities.results;
  var entitiesB = systemB.queries.entities.results;
  var entitiesRemovedF = systemF.queries.entities.removed;
  var entitiesRemovedFB = systemFB.queries.entities.removed;
  var entitiesRemovedB = systemB.queries.entities.removed;

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

test("Reactive", t => {
  var world = new World();

  class ReactiveSystem extends System {
    execute() {}
  }

  ReactiveSystem.queries = {
    entities: {
      components: [FooComponent, BarComponent],
      listen: {
        added: true,
        removed: true,
        changed: [FooComponent, BarComponent]
      }
    }
  };

  // Register empty system
  world.registerSystem(ReactiveSystem);

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  for (var i = 0; i < 15; i++) {
    world
      .createEntity()
      .addComponent(FooComponent)
      .addComponent(BarComponent);
  }

  var system = world.systemManager.getSystems()[0];
  var query = system.queries.entities;
  var entity0 = world.entityManager._entities[0];

  // Entities from the standard query
  t.is(query.results.length, 15);

  // Added entities
  t.is(query.added.length, 15);
  world.execute(); // After execute, events should be cleared
  t.is(query.added.length, 0);
  system.clearEvents();

  // Add a new one
  world
    .createEntity()
    .addComponent(FooComponent)
    .addComponent(BarComponent);

  t.is(query.added.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(query.added.length, 0);

  // Changing
  entity0.getMutableComponent(FooComponent);
  t.is(query.changed.length, 1);
  //t.is(query.changed.fooComponent.length, 1);
  //t.is(query.changed.barComponent.length, 0);
  world.execute(); // After execute, events should be cleared
  //  t.is(query.changed.length, 0);

  entity0.getMutableComponent(BarComponent);
  t.is(query.changed.length, 1);
  //t.is(query.changed.fooComponent.length, 0);
  //t.is(query.changed.barComponent.length, 1);

  world.execute(); // After execute, events should be cleared
  t.is(query.changed.length, 0);
  //t.is(query.changed.barComponent.length, 0);
  // Check if the entity is already on the list?
  entity0.getMutableComponent(FooComponent);
  entity0.getMutableComponent(BarComponent);
  t.is(query.changed.length, 1);
  //t.is(query.changed.fooComponent.length, 1);
  //t.is(query.changed.barComponent.length, 1);

  world.execute(); // After execute, events should be cleared
  t.is(query.changed.length, 0);
  //t.is(query.changed.fooComponent.length, 0);
  //t.is(query.changed.barComponent.length, 0);

  // remove an entity
  entity0.remove();
  t.is(query.removed.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(query.removed.length, 0);

  // Removed
  entity0 = world.entityManager._entities[0];
  entity0.removeComponent(FooComponent);
  t.is(query.removed.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(query.removed.length, 0);

  // Added componets to the previous one
  entity0.addComponent(FooComponent);
  t.is(query.added.length, 1);
  world.execute(); // After execute, events should be cleared
  t.is(query.added.length, 0);

  // Remove all components from the first 5 entities
  for (i = 0; i < 5; i++) {
    world.entityManager._entities[i].removeAllComponents();
  }
  t.is(query.removed.length, 5);
  world.execute(); // After execute, events should be cleared
  t.is(query.removed.length, 0);

  // remove all entities
  world.entityManager.removeAllEntities();
  t.is(query.removed.length, 10);
  world.execute(); // After execute, events should be cleared
  t.is(query.removed.length, 0);
});

test("Queries with 'mandatory' parameter", t => {
  var counter = {
    a: 0,
    b: 0,
    c: 0
  };

  class SystemA extends System {
    execute() {
      counter.a++;
    }
  }

  SystemA.queries = {
    entities: { components: [FooComponent], mandatory: false }
  };

  class SystemB extends System {
    execute() {
      counter.b++;
    }
  }

  SystemB.queries = {
    entities: { components: [FooComponent], mandatory: true }
  };

  class SystemC extends System {
    execute() {
      counter.c++;
    }
  }

  SystemC.queries = {
    entities: { components: [BarComponent], mandatory: true }
  };

  // -------
  var world = new World();
  var entity = world.createEntity();

  world
    .registerSystem(SystemA) // FooComponent
    .registerSystem(SystemB) // Mandatory FooComponent
    .registerSystem(SystemC); // Mandatory BarComponent

  world.execute();
  t.deepEqual(counter, { a: 1, b: 0, c: 0 });

  entity.addComponent(FooComponent);

  world.execute();
  t.deepEqual(counter, { a: 2, b: 1, c: 0 });

  entity.addComponent(BarComponent);

  world.execute();
  t.deepEqual(counter, { a: 3, b: 2, c: 1 });

  entity.removeComponent(FooComponent);

  world.execute();
  t.deepEqual(counter, { a: 4, b: 2, c: 2 });
});

test("Get Systems", t => {
  var world = new World();

  class SystemA extends System {}
  class SystemB extends System {}
  class SystemC extends System {}

  // Register empty system
  world.registerSystem(SystemA).registerSystem(SystemB);

  t.true(world.getSystem(SystemA) instanceof SystemA);
  t.true(world.getSystem(SystemB) instanceof SystemB);
  t.true(typeof world.getSystem(SystemC) === "undefined");

  var systems = world.getSystems();
  t.deepEqual(systems, world.systemManager._systems);
});

test("Systems without queries", t => {
  var world = new World();

  var counter = 0;
  class SystemA extends System {
    execute() {
      counter++;
    }
  }

  // Register empty system
  world.registerSystem(SystemA);

  t.is(counter, 0);
  for (var i = 0; i < 10; i++) {
    world.execute();
  }
  t.is(counter, 10);
});

test("Systems with component case sensitive", t => {
  var world = new World();

  class A {}
  class a {}

  var counter = { a: 0, A: 0 };

  class System_A extends System {
    execute() {
      this.queries.A.results.forEach(() => counter.A++);
    }
  }
  System_A.queries = { A: { components: [A] } };

  class System_a extends System {
    execute() {
      this.queries.a.results.forEach(() => counter.a++);
    }
  }
  System_a.queries = { a: { components: [a] } };

  // Register empty system
  world.registerSystem(System_A);
  world.registerSystem(System_a);

  world.execute();
  t.deepEqual(counter, { a: 0, A: 0 });
  let entity_A = world.createEntity();
  entity_A.addComponent(A);
  world.execute();
  t.deepEqual(counter, { a: 0, A: 1 });

  let entity_a = world.createEntity();
  entity_a.addComponent(a);
  world.execute();
  t.deepEqual(counter, { a: 1, A: 2 });

  entity_A.removeComponent(A);
  world.execute();
  t.deepEqual(counter, { a: 2, A: 2 });
});

test("Components with the the same name in uppercase and lowercase", t => {
  class B {}

  class b {}

  class S extends System {
    execute() {
      this.queries.S.results.forEach(entity =>
        console.log(entity.getComponents())
      );
    }
  }
  S.queries = { S: { components: [B, b] } };

  const world = new World();
  world.registerSystem(S);
  world
    .createEntity()
    .addComponent(B)
    .addComponent(b);

  let query = world.getSystem(S).queries.S;
  let entity = query.results[0];
  let components = entity.getComponents();
  t.deepEqual(Object.keys(components), ["B", "b"]);
  t.deepEqual(
    Object.values(components).map(c => c.constructor.name),
    ["B", "b"]
  );
});

test("Unregister systems", t => {
  class SystemA extends System {}

  class SystemB extends System {
    execute() {}
  }

  const world = new World();
  world.registerSystem(SystemA).registerSystem(SystemB);

  t.is(world.systemManager._systems.length, 2);
  t.is(world.systemManager._executeSystems.length, 1);

  world.unregisterSystem(SystemA);
  t.is(world.systemManager._systems.length, 1);
  t.is(world.systemManager._executeSystems.length, 1);

  world.unregisterSystem(SystemB);
  t.is(world.systemManager._systems.length, 0);
  t.is(world.systemManager._executeSystems.length, 0);
});

test("Register a system that does not extend System", t => {
  class SystemA {}

  const world = new World();
  const error = t.throws(() => {
    world.registerSystem(SystemA);
  }, Error);

  t.is(error.message, "System 'SystemA' does not extends 'System' class");
});
