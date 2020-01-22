import { SystemStateComponent } from './system-state-component';
import { Not } from '../not';
import { World } from '../world';
import { System } from '../system';

describe('system-state-components', () => {
  it('reset', () => {
    const world = new World();

    class StateComponentA extends SystemStateComponent {}

    class SystemA extends System {

      static queries = {
        added: { components: [FooComponent, Not(StateComponentA)] },
        remove: { components: [Not(FooComponent), StateComponentA] },
        normal: { components: [FooComponent, StateComponentA] }
      };

      queries: any = {};

      run() {
        this.queries.added.results.forEach((e) => {
          e.addComponent(StateComponentA);
        });

        this.queries.remove.results.forEach((e) => {
          e.removeComponent(StateComponentA);
        });

        this.queries.normal.results.forEach(() => {
          // use entity and its components
        });
      }
    }



    world.registerSystem(SystemA);
    const entityManager = world.entityManager;
    const systemA = world.getSystem(SystemA);
    let entity = world.createEntity();

    entity
      .addComponent(FooComponent);

    expect(entity.hasComponent(FooComponent)).toBeTruthy();
    expect(entity.hasComponent(StateComponentA)).toBeFalsy();

    world.run();

    expect(entity.hasComponent(FooComponent)).toBeTruthy();
    expect(entity.hasComponent(StateComponentA)).toBeTruthy();

    entity.removeComponent(FooComponent);

    world.run();

    entity.removeComponent(FooComponent);

    expect(entity.alive).toBeTruthy();
    expect(entity.hasComponent(FooComponent)).toBeFalsy();
    expect(entity.hasComponent(StateComponentA)).toBeFalsy();

    // reset
    entity.addComponent(FooComponent);
    world.run();
    expect(entity.hasComponent(FooComponent)).toBeTruthy();
    expect(entity.hasComponent(StateComponentA)).toBeTruthy();

    entity.removeAllComponents();
    expect(entity.hasComponent(FooComponent)).toBeFalsy();
    expect(entity.hasComponent(StateComponentA)).toBeTruthy();

    world.run();
    expect(entity.hasComponent(FooComponent)).toBeFalsy();
    expect(entity.hasComponent(StateComponentA)).toBeFalsy();

    entity.addComponent(FooComponent);
    world.run();
    expect(entity.hasComponent(FooComponent)).toBeTruthy();
    expect(entity.hasComponent(StateComponentA)).toBeTruthy();

    expect(entity.alive).toBeTruthy();
    expect(entity.entityManager).toBe(entityManager);

    entity.remove(true);
    expect(entity.alive).toBeFalsy();
    expect(entity.hasComponent(FooComponent)).toBeFalsy();
    expect(entity.hasComponent(StateComponentA)).toBeTruthy();
    expect(entity.entityManager).toBe(entityManager);

    entityManager.processDeferredRemoval();
    expect(entity.entityManager).toBe(entityManager); // like it will ever change

    expect(entityManager.entities.length).toBe(1);
    expect(entity.hasComponent(FooComponent)).toBeFalsy();
    expect(entity.hasComponent(StateComponentA)).toBeTruthy();

    entity.removeComponent(FooComponent);
    expect(entityManager.entities.length).toBe(1);

    entity.removeComponent(StateComponentA);
    expect(entityManager.entitiesToRemove.length).toBe(1);
    expect(entityManager.entities.length).toBe(1);
    entityManager.processDeferredRemoval();
    expect(entityManager.entitiesToRemove.length).toBe(0);
    expect(entityManager.entities.length).toBe(0);

    // Immediate remove component
    entity = world.createEntity().addComponent(FooComponent);
    expect(systemA.queries.added.results.length).toBe(1);
    expect(systemA.queries.remove.results.length).toBe(0);
    expect(systemA.queries.normal.results.length).toBe(0);
    world.run();
    expect(systemA.queries.added.results.length).toBe(0);
    expect(systemA.queries.remove.results.length).toBe(0);
    expect(systemA.queries.normal.results.length).toBe(1);

    entity.removeComponent(FooComponent, true);
    expect(systemA.queries.added.results.length).toBe(0);
    expect(systemA.queries.remove.results.length).toBe(1);
    expect(systemA.queries.normal.results.length).toBe(0);

    world.run();
    expect(systemA.queries.added.results.length).toBe(0);
    expect(systemA.queries.remove.results.length).toBe(0);
    expect(systemA.queries.normal.results.length).toBe(0);
    entity.remove(true); // Cleaning up

    // Immediate remove entity
    entity = world
      .createEntity()
      .addComponent(FooComponent)
      .addComponent(StateComponentA);

    entity.remove(true);
    expect(entityManager.entitiesToRemove.length).toBe(0); // It's not deferred just a ghost
    expect(entityManager.entities.length).toBe(1); // It's still alive waiting for SCA to be removed

    expect(systemA.queries.added.results.length).toBe(0);
    expect(systemA.queries.remove.results.length).toBe(1);
    expect(systemA.queries.normal.results.length).toBe(0);
    world.run();
    expect(systemA.queries.added.results.length).toBe(0);
    expect(systemA.queries.remove.results.length).toBe(0);
    expect(systemA.queries.normal.results.length).toBe(0);

    // The entity get removed when SCA is removed too as it was a ghost
    expect(entityManager.entities.length).toBe(0);
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
