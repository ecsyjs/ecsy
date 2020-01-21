import { Not } from '../not';
import { SystemBase } from '../system-base';
import { World } from '../world';
import { clearEvents } from './clear-events';

describe('system', () => {

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

    expect(
      world.systemManager.getSystems().map(s => {
        return s.constructor.name;
      })).toEqual(
      ["SystemA", "SystemB", "SystemC", "SystemD", "SystemE"]
    );

    world = new World();
    world
      .registerSystem(SystemA)
      .registerSystem(SystemB, { priority: 2 })
      .registerSystem(SystemC, { priority: -1 })
      .registerSystem(SystemD)
      .registerSystem(SystemE);

    expect(
      world.systemManager.getSystems().map(s => {
        return s.constructor.name;
      })).toEqual(
      ["SystemC", "SystemA", "SystemD", "SystemE", "SystemB"]
    );
    world.run();
  });
  */

  it('Empty queries', () => {
    const world = new World();

    // System 1
    class SystemEmpty1 extends SystemBase {}

    // System 2
    class SystemEmpty2 extends SystemBase {
      static systemData = {};
    }


    // System 3
    class SystemEmpty3 extends SystemBase {
      static systemData = {
        entities: {}
      };
    }

    // System 4
    class SystemEmpty4 extends SystemBase {
      static systemData = {
        entities: { components: [] }
      };
    }

    // Register empty system
    world
      .registerSystem(SystemEmpty1)
      .registerSystem(SystemEmpty2);

    expect(world.systemManager.getSystem(SystemEmpty1).queries).toEqual({});
    expect(world.systemManager.getSystem(SystemEmpty2).queries).toEqual({});


    expect(() => {
      world.registerSystem(SystemEmpty3 as any);
    })
      .toThrowError('\'components\' attribute can\'t be empty in a query');


    expect(() => {
      world.registerSystem(SystemEmpty4);
    })
    .toThrowError('\'components\' attribute can\'t be empty in a query');

  });

  it('Queries', () => {
    const world = new World();

    world.registerComponent(FooComponent).registerComponent(BarComponent);

    for (let i = 0; i < 15; i++) {
      const entity = world.createEntity();
      if (i < 10) { entity.addComponent(FooComponent); }
      if (i >= 5) { entity.addComponent(BarComponent); }
      entity.addComponent(EmptyComponent);
    }

    class SystemFoo extends SystemBase {
      static systemData = {
        entities: { components: [FooComponent] }
      };
    }

    class SystemBar extends SystemBase {
      static systemData = {
        entities: { components: [BarComponent] }
      };
    }

    class SystemBoth extends SystemBase {
      static systemData = {
        entities: { components: [FooComponent, BarComponent] }
      };
    }

    world
      .registerSystem(SystemFoo)
      .registerSystem(SystemBar)
      .registerSystem(SystemBoth);

    // Foo
    expect(world.systemManager.getSystem(SystemFoo).queries.entities.results.length).toBe(10);
    // Bar
    expect(world.systemManager.getSystem(SystemBar).queries.entities.results.length).toBe(10);
    // Both
    expect(world.systemManager.getSystem(SystemBoth).queries.entities.results.length).toBe(5);
  });

  it('Queries with \'Not\' operator', () => {
    const world = new World();

    world.registerComponent(FooComponent).registerComponent(BarComponent);

    // 10 Foo
    // 10 Bar
    // 15 Empty
    for (let i = 0; i < 15; i++) {
      const entity = world.createEntity();
      if (i < 10) { entity.addComponent(FooComponent); }
      if (i >= 5) { entity.addComponent(BarComponent); }
      entity.addComponent(EmptyComponent);
    }

    class SystemNotNot extends SystemBase {
      static systemData = {
        notFoo: { components: [Not(FooComponent), Not(BarComponent)] }
      };
    }

    expect(() => {
      world.registerSystem(SystemNotNot);
    })
      .toThrowError('Can\'t create a query without components');


    class SystemNotBar extends SystemBase {
      static systemData = {
        fooNotBar: { components: [FooComponent, Not(BarComponent)] },
        emptyNotBar: { components: [EmptyComponent, Not(BarComponent)] },
        emptyNotBarFoo: {
          components: [EmptyComponent, Not(BarComponent), Not(FooComponent)]
        }
      };
    }

    world.registerSystem(SystemNotBar);
    const queries = world.systemManager.getSystems().get(SystemNotBar).queries;

    expect(queries.fooNotBar.results.length).toBe(5);
    expect(queries.emptyNotBar.results.length).toBe(5);
    expect(queries.emptyNotBarFoo.results.length).toBe(0);

    // Adding BarComponent to entity0 will remove it from the queries Not(BarComponent)
    world.entityManager.entities[0].addComponent(BarComponent);
    expect(queries.fooNotBar.results.length).toBe(4);
    expect(queries.emptyNotBar.results.length).toBe(4);

    // Removing BarComponent from entity0 will add it from the queries Not(BarComponent)
    world.entityManager.entities[0].removeComponent(BarComponent);
    expect(queries.fooNotBar.results.length).toBe(5);
    expect(queries.emptyNotBar.results.length).toBe(5);
  });

  it('Queries with sync removal', () => {
    const world = new World();

    world.registerComponent(FooComponent).registerComponent(BarComponent);

    // 10 Foo
    // 10 Bar
    for (let i = 0; i < 10; i++) {
      const entity = world.createEntity();
      entity.addComponent(FooComponent);
    }

    class SystemA extends SystemBase {

      static systemData = {
        entities: {
          components: [FooComponent],
          listen: {
            removed: true
          }
        }
      };

      run() {
        const entities = this.queries.entities.results;

        for (const entity of entities) {
          entity.remove(true);
        }
      }
    }


    class SystemB extends SystemBase {

      static systemData = {
        entities: {
          components: [FooComponent],
          listen: {
            removed: true
          }
        }
      };

      run() {
        const entities = this.queries.entities.results;
        for (let i = 0, l = entities.length; i < l; i++) {
          entities[i].remove(true);
        }
      }
    }

    world.registerSystem(SystemA).registerSystem(SystemB);

    const systemA = world.systemManager.getSystems().get(SystemA);
    const systemB = world.systemManager.getSystems().get(SystemB);

    const entitiesA = systemA.queries.entities.results;
    const entitiesB = systemA.queries.entities.results;
    const entitiesRemovedA = systemA.queries.entities.removed;
    const entitiesRemovedB = systemB.queries.entities.removed;

    // Sync standard remove invalid loop
    expect(entitiesA.length).toBe(10);

    systemA.run();

    // Just removed half because of the sync update of the array that throws an exception
    expect(entitiesA.length).toBe(5);
    expect(entitiesRemovedA.length).toBe(5);

    // Sync standard remove with stored length on invalid loop
    expect(entitiesB.length).toBe(5);

    expect(() => {
      systemB.run();
    })
      .toThrowError('Cannot read property \'remove\' of undefined');

    // Just removed half because of the sync update of the array that throws an exception
    expect(entitiesB.length).toBe(2);
    expect(entitiesRemovedB.length).toBe(8);
  });

  it('Queries with deferred removal', () => {
    const world = new World();

    world.registerComponent(FooComponent).registerComponent(BarComponent);

    for (let i = 0; i < 6; i++) {
      const entity = world.createEntity();
      if (i < 4) { entity.addComponent(FooComponent); }
      if (i >= 2) { entity.addComponent(BarComponent); }
    }

    class SystemF extends SystemBase {
      static systemData = {
        entities: {
          components: [FooComponent],
          listen: {
            removed: true
          }
        }
      };

      run() {
        this.queries.entities.results[1].remove();
        this.queries.entities.results[0].remove();
      }
    }

    class SystemFB extends SystemBase {
      static systemData = {
        entities: {
          components: [FooComponent, BarComponent],
          listen: {
            removed: true
          }
        }
      };

      run() {
        // @todo Instead of removing backward should it work also forward?
        const entities = this.queries.entities.results;
        for (let i = entities.length - 1; i >= 0; i--) {
          entities[i].remove();
        }
      }
    }

    class SystemB extends SystemBase {
      static systemData = {
        entities: {
          components: [BarComponent],
          listen: {
            removed: true
          }
        }
      };
    }

    world
      .registerSystem(SystemF)
      .registerSystem(SystemFB)
      .registerSystem(SystemB);

    const systemF = world.systemManager.getSystem(SystemF);
    const systemFB = world.systemManager.getSystem(SystemFB);
    const systemB = world.systemManager.getSystem(SystemB);

    const entitiesF = systemF.queries.entities.results;
    const entitiesFB = systemFB.queries.entities.results;
    const entitiesB = systemB.queries.entities.results;
    const entitiesRemovedF = systemF.queries.entities.removed;
    const entitiesRemovedFB = systemFB.queries.entities.removed;
    const entitiesRemovedB = systemB.queries.entities.removed;

    // [F,F,FB,FB,B,B]
    expect(entitiesF.length).toBe(4);
    expect(entitiesFB.length).toBe(2);
    expect(entitiesB.length).toBe(4);

    // world.run();
    systemF.run();

    // [-F,-F,FB,FB,B,B]
    // [FB,FB,B, B]
    expect(entitiesF.length).toBe(2);
    expect(entitiesFB.length).toBe(2);
    expect(entitiesB.length).toBe(4);
    expect(entitiesRemovedF.length).toBe(2);
    expect(entitiesRemovedFB.length).toBe(0);
    expect(entitiesRemovedB.length).toBe(0);

    // Clear the previously removed Fs
    clearEvents(systemF);
    expect(entitiesRemovedF.length).toBe(0);

    // Force remove on systemB
    // [-FB,-FB, B, B]
    // [B, B]
    systemFB.run();
    expect(entitiesF.length).toBe(0);
    expect(entitiesFB.length).toBe(0);
    expect(entitiesB.length).toBe(2);
    expect(entitiesRemovedF.length).toBe(2);
    expect(entitiesRemovedFB.length).toBe(2);
    expect(entitiesRemovedB.length).toBe(2);

    // Process the deferred removals of entities
    expect(world.entityManager.entities.length).toBe(6);
    expect(world.entityManager.entityPool.totalUsed()).toBe(6);
    world.entityManager.processDeferredRemoval();
    expect(world.entityManager.entityPool.totalUsed()).toBe(2);
    expect(world.entityManager.entities.length).toBe(2);
  });

  it('Queries removing multiple components', () => {
    const world = new World();

    world
      .registerComponent(FooComponent)
      .registerComponent(BarComponent)
      .registerComponent(EmptyComponent);

    for (let i = 0; i < 6; i++) {
      const entity = world.createEntity();
      entity
        .addComponent(FooComponent)
        .addComponent(BarComponent);
    }

    class SystemA extends SystemBase {
      static systemData = {
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

      run() {
        this.queries.entities.removed.forEach(entity => {
          expect(entity.hasComponent(FooComponent)).toBeFalsy();
          expect(entity.hasRemovedComponent(FooComponent)).toBeTruthy();
        });

        // this query should never match
        expect(this.queries.notTest.results.length).toBe(0);
      }
    }

    world.registerSystem(SystemA);

    const systemA = world.systemManager.getSystem(SystemA);
    const query = systemA.queries.entities;
    const entitiesA = query.results;
    const entitiesRemovedA = query.removed;

    // Remove one entity => entityRemoved x1
    expect(entitiesA.length).toBe(6);
    world.entityManager.entities[0].remove();
    expect(entitiesA.length).toBe(5);
    expect(entitiesRemovedA.length).toBe(1);
    systemA.run();
    clearEvents(systemA);

    // Remove both components => entityRemoved x1
    world.entityManager.entities[1].removeComponent(FooComponent);
    expect(entitiesA.length).toBe(4);
    expect(entitiesRemovedA.length).toBe(1);
    systemA.run();
    // Remove second component => It will be the same result
    world.entityManager.entities[1].removeComponent(BarComponent);
    expect(entitiesA.length).toBe(4);
    expect(entitiesRemovedA.length).toBe(1);
    systemA.run();
    clearEvents(systemA);

    // Remove entity and component deferred
    world.entityManager.entities[2].remove();
    world.entityManager.entities[2].removeComponent(FooComponent);
    world.entityManager.entities[2].removeComponent(BarComponent);
    expect(entitiesA.length).toBe(3);
    expect(entitiesRemovedA.length).toBe(1);
    systemA.run();
    clearEvents(systemA);

    // Check deferred queues
    expect(world.entityManager.entities.length).toBe(6);
    expect(world.entityManager.entitiesToRemove.length).toBe(2);
    expect(world.entityManager.entitiesWithComponentsToRemove.size).toBe(3);

    expect(world.entityManager.entityPool.totalUsed()).toBe(6);
    world.entityManager.processDeferredRemoval();
    expect(world.entityManager.entitiesWithComponentsToRemove.size).toBe(0);
    expect(world.entityManager.entityPool.totalUsed()).toBe(4);
    expect(world.entityManager.entities.length).toBe(4);
    expect(world.entityManager.entitiesToRemove.length).toBe(0);
  });

  it('Querries removing deferred components', () => {
    const world = new World();

    world.registerComponent(FooComponent).registerComponent(BarComponent);

    for (let i = 0; i < 6; i++) {
      const entity = world.createEntity();
      if (i < 4) { entity.addComponent(FooComponent); }
      if (i >= 2) { entity.addComponent(BarComponent); }
    }

    class SystemF extends SystemBase {
      static systemData = {
        entities: {
          components: [FooComponent],
          listen: {
            removed: true
          }
        }
      };

      run() {
        this.queries.entities.results[0].removeComponent(FooComponent);
      }
    }


    class SystemFB extends SystemBase {
      static systemData = {
        entities: {
          components: [FooComponent, BarComponent],
          listen: {
            removed: true
          }
        }
      };

      run() {
        // @todo Instead of removing backward should it work also forward?
        const entities = this.queries.entities.results;
        for (let i = entities.length - 1; i >= 0; i--) {
          entities[i].removeComponent(BarComponent);
        }
      }
    }


    class SystemB extends SystemBase {
      static systemData = {
        entities: {
          components: [BarComponent],
          listen: {
            removed: true
          }
        }
      };
    }


    world
      .registerSystem(SystemF)
      .registerSystem(SystemFB)
      .registerSystem(SystemB);

    const systemF = world.systemManager.getSystems().get(SystemF);
    const systemFB = world.systemManager.getSystems().get(SystemFB);
    const systemB = world.systemManager.getSystems().get(SystemB);

    const entitiesF = systemF.queries.entities.results;
    const entitiesFB = systemFB.queries.entities.results;
    const entitiesB = systemB.queries.entities.results;
    const entitiesRemovedF = systemF.queries.entities.removed;
    const entitiesRemovedFB = systemFB.queries.entities.removed;
    const entitiesRemovedB = systemB.queries.entities.removed;

    // [F,F,FB,FB,B,B]
    expect(entitiesF.length).toBe(4);
    expect(entitiesFB.length).toBe(2);
    expect(entitiesB.length).toBe(4);

    // world.run();
    systemF.run();

    // [-F,F,FB,FB,B,B]
    // [F, FB,FB,B, B]
    expect(entitiesF.length).toBe(3);
    expect(entitiesFB.length).toBe(2);
    expect(entitiesB.length).toBe(4);

    expect(entitiesRemovedF.length).toBe(1);
    expect(entitiesRemovedFB.length).toBe(0);
    expect(entitiesRemovedB.length).toBe(0);

    // Clear the previously removed Fs
    clearEvents(systemF);
    clearEvents(systemF);
    expect(entitiesRemovedF.length).toBe(0);

    // Force remove on systemB
    // [F, F-B,F-B, B, B]
    // [F, F, F]
    systemFB.run();

    expect(entitiesF.length).toBe(3);
    expect(entitiesFB.length).toBe(0);
    expect(entitiesB.length).toBe(2);

    expect(entitiesRemovedF.length).toBe(0);
    expect(entitiesRemovedFB.length).toBe(2);
    expect(entitiesRemovedB.length).toBe(2);

    // Process the deferred removals of components
    expect(world.entityManager.entitiesWithComponentsToRemove.size).toBe(3);
    world.entityManager.processDeferredRemoval();
    expect(world.entityManager.entitiesWithComponentsToRemove.size).toBe(0);
  });

  it('Reactive', () => {
    const world = new World();

    class ReactiveSystem extends SystemBase {
      static systemData = {
        entities: {
          components: [FooComponent, BarComponent],
          listen: {
            added: true,
            removed: true,
            changed: [FooComponent, BarComponent]
          }
        }
      };

      run() {}
    }


    // Register empty system
    world
      .registerSystem(ReactiveSystem);

    world
      .registerComponent(FooComponent)
      .registerComponent(BarComponent);

    for (let i = 0; i < 15; i++) {
      world
        .createEntity()
        .addComponent(FooComponent)
        .addComponent(BarComponent);
    }

    const system = world.systemManager.getSystems().get(ReactiveSystem);
    const query = system.queries.entities;
    let entity0 = world.entityManager.entities[0];

    // Entities from the standard query
    expect(query.results.length).toBe(15);

    // Added entities
    expect(query.added.length).toBe(15);
    world.run(); // After run, events should be cleared
    expect(query.added.length).toBe(0);
    clearEvents(system);

    // Add a new one
    world
      .createEntity()
      .addComponent(FooComponent)
      .addComponent(BarComponent);

    expect(query.added.length).toBe(1);
    world.run(); // After run, events should be cleared
    expect(query.added.length).toBe(0);

    // Changing
    entity0.getMutableComponent(FooComponent);
    expect(query.changed.length).toBe(1);
    world.run(); // After run, events should be cleared

    entity0.getMutableComponent(BarComponent);
    expect(query.changed.length).toBe(1);


    world.run(); // After run, events should be cleared
    expect(query.changed.length).toBe(0);

    // Check if the entity is already on the list?
    entity0.getMutableComponent(FooComponent);
    entity0.getMutableComponent(BarComponent);
    expect(query.changed.length).toBe(1);


    world.run(); // After run, events should be cleared
    expect(query.changed.length).toBe(0);


    // remove an entity
    entity0.remove();
    expect(query.removed.length).toBe(1);
    world.run(); // After run, events should be cleared
    expect(query.removed.length).toBe(0);

    // Removed
    entity0 = world.entityManager.entities[0];
    entity0.removeComponent(FooComponent);
    expect(query.removed.length).toBe(1);
    world.run(); // After run, events should be cleared
    expect(query.removed.length).toBe(0);

    // Added componets to the previous one
    entity0.addComponent(FooComponent);
    expect(query.added.length).toBe(1);
    world.run(); // After run, events should be cleared
    expect(query.added.length).toBe(0);

    // Remove all components from the first 5 entities
    for (let i = 0; i < 5; i++) {
      world.entityManager.entities[i].removeAllComponents();
    }
    expect(query.removed.length).toBe(5);
    world.run(); // After run, events should be cleared
    expect(query.removed.length).toBe(0);

    // remove all entities
    world.entityManager.removeAllEntities();
    expect(query.removed.length).toBe(10);
    world.run(); // After run, events should be cleared
    expect(query.removed.length).toBe(0);
  });

  it('Queries with \'mandatory\' parameter', () => {
    const counter = {
      a: 0,
      b: 0,
      c: 0
    };

    class SystemA extends SystemBase {
      static systemData = {
        entities: { components: [FooComponent], mandatory: false }
      };

      run() {
        counter.a++;
      }
    }


    class SystemB extends SystemBase {
      static systemData = {
        entities: { components: [FooComponent], mandatory: true }
      };

      run() {
        counter.b++;
      }
    }


    class SystemC extends SystemBase {
      static systemData = {
        entities: { components: [BarComponent], mandatory: true }
      };

      run() {
        counter.c++;
      }
    }


    // -------
    const world = new World();
    const entity = world.createEntity();

    world
      .registerSystem(SystemA) // FooComponent
      .registerSystem(SystemB) // Mandatory FooComponent
      .registerSystem(SystemC); // Mandatory BarComponent

    world.run();
    expect(counter).toEqual({ a: 1, b: 0, c: 0 });

    entity.addComponent(FooComponent);

    world.run();
    expect(counter).toEqual({ a: 2, b: 1, c: 0 });

    entity.addComponent(BarComponent);

    world.run();
    expect(counter).toEqual({ a: 3, b: 2, c: 1 });

    entity.removeComponent(FooComponent);

    world.run();
    expect(counter).toEqual({ a: 4, b: 2, c: 2 });
  });

  it('Get Systems', () => {
    const world = new World();

    class SystemA extends SystemBase {}
    class SystemB extends SystemBase {}
    class SystemC extends SystemBase {}

    // Register empty system
    world.registerSystem(SystemA).registerSystem(SystemB);

    expect(world.getSystem(SystemA) instanceof SystemA).toBeTruthy();
    expect(world.getSystem(SystemB) instanceof SystemB).toBeTruthy();
    expect(typeof world.getSystem(SystemC) === 'undefined').toBeTruthy();

    const systems = world.getSystems();
    expect(systems).toEqual(world.systemManager.systems);
  });

  it('Systems without queries', () => {
    const world = new World();

    let counter = 0;
    class SystemA extends SystemBase {
      run() {
        counter++;
      }
    }

    // Register empty system
    world.registerSystem(SystemA);

    expect(counter).toBe(0);
    for (let i = 0; i < 10; i++) {
      world.run();
    }
    expect(counter).toBe(10);
  });

  it('Systems with component case sensitive', () => {
    const world = new World();

    class A {}
    // tslint:disable-next-line:class-name
    class a {}

    const counter = { a: 0, A: 0 };

    // tslint:disable-next-line:class-name
    class System_A extends SystemBase {
      static systemData = { A: { components: [A] } };
      run() {
        this.queries.A.results.forEach(() => counter.A++);
      }
    }

    // tslint:disable-next-line:class-name
    class System_a extends SystemBase {
      static systemData = { a: { components: [a] } };
      run() {
        this.queries.a.results.forEach(() => counter.a++);
      }
    }

    // Register empty system
    world.registerSystem(System_A);
    world.registerSystem(System_a);

    world.run();
    expect(counter).toEqual({ a: 0, A: 0 });
    // tslint:disable-next-line:variable-name
    const entity_A = world.createEntity();
    entity_A.addComponent(A);
    world.run();
    expect(counter).toEqual({ a: 0, A: 1 });

    // tslint:disable-next-line:variable-name
    const entity_a = world.createEntity();
    entity_a.addComponent(a);
    world.run();
    expect(counter).toEqual({ a: 1, A: 2 });

    entity_A.removeComponent(A);
    world.run();
    expect(counter).toEqual({ a: 2, A: 2 });
  });
});

export class FooComponent {
  variableFoo = 0;

  copy(src) {
    this.variableFoo = src.variableFoo;
  }
}

export class BarComponent {
  variableBar = 0;

  copy(src) {
    this.variableBar = src.variableBar;
  }
}

export class NoCopyComponent {
  variable = 0;
}

export class EmptyComponent {}
