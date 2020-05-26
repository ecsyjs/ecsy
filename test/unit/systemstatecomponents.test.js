// @todo Define this globally for all the test?
import test from "ava";
import { World, Not, System, SystemStateComponent } from "../../src/index.js";
import { FooComponent } from "../helpers/components";

test("reset", t => {
  var world = new World();

  class StateComponentA extends SystemStateComponent {}

  class SystemA extends System {
    execute() {
      this.queries.added.results.forEach(entity => {
        entity.addComponent(StateComponentA);
      });

      this.queries.remove.results.forEach(entity => {
        entity.removeComponent(StateComponentA);
      });

      this.queries.normal.results.forEach(() => {
        // use entity and its components
      });
    }
  }

  SystemA.queries = {
    added: { components: [FooComponent, Not(StateComponentA)] },
    remove: { components: [Not(FooComponent), StateComponentA] },
    normal: { components: [FooComponent, StateComponentA] }
  };

  world.registerSystem(SystemA);
  var entityManager = world.entityManager;
  var systemA = world.getSystem(SystemA);
  var entity = world.createEntity();
  entity.addComponent(FooComponent);

  t.true(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(StateComponentA));

  world.execute();

  t.true(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(StateComponentA));

  entity.removeComponent(FooComponent);

  world.execute();

  entity.removeComponent(FooComponent);

  t.true(entity.alive);
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(StateComponentA));

  // reset
  entity.addComponent(FooComponent);
  world.execute();
  t.true(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(StateComponentA));

  entity.removeAllComponents();
  t.false(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(StateComponentA));

  world.execute();
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(StateComponentA));

  entity.addComponent(FooComponent);
  world.execute();
  t.true(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(StateComponentA));

  t.true(entity.alive);
  t.is(entity._world, entityManager);

  entity.remove(true);
  t.false(entity.alive);
  t.false(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(StateComponentA));
  t.is(entity._world, entityManager);

  entityManager.processDeferredRemoval();
  t.is(entity._world, entityManager);

  t.is(entityManager._entities.length, 1);
  t.false(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(StateComponentA));

  entity.removeComponent(FooComponent);
  t.is(entityManager._entities.length, 1);

  entity.removeComponent(StateComponentA);
  t.is(entityManager.entitiesToRemove.length, 1);
  t.is(entityManager._entities.length, 1);
  entityManager.processDeferredRemoval();
  t.is(entityManager.entitiesToRemove.length, 0);
  t.is(entityManager._entities.length, 0);

  // Immediate remove component
  entity = world.createEntity().addComponent(FooComponent);
  t.is(systemA.queries.added.results.length, 1);
  t.is(systemA.queries.remove.results.length, 0);
  t.is(systemA.queries.normal.results.length, 0);
  world.execute();
  t.is(systemA.queries.added.results.length, 0);
  t.is(systemA.queries.remove.results.length, 0);
  t.is(systemA.queries.normal.results.length, 1);

  entity.removeComponent(FooComponent, true);
  t.is(systemA.queries.added.results.length, 0);
  t.is(systemA.queries.remove.results.length, 1);
  t.is(systemA.queries.normal.results.length, 0);

  world.execute();
  t.is(systemA.queries.added.results.length, 0);
  t.is(systemA.queries.remove.results.length, 0);
  t.is(systemA.queries.normal.results.length, 0);
  entity.remove(true); // Cleaning up

  // Immediate remove entity
  entity = world
    .createEntity()
    .addComponent(FooComponent)
    .addComponent(StateComponentA);

  entity.remove(true);
  t.is(entityManager.entitiesToRemove.length, 0); // It's not deferred just a ghost
  t.is(entityManager._entities.length, 1); // It's still alive waiting for SCA to be removed

  t.is(systemA.queries.added.results.length, 0);
  t.is(systemA.queries.remove.results.length, 1);
  t.is(systemA.queries.normal.results.length, 0);
  world.execute();
  t.is(systemA.queries.added.results.length, 0);
  t.is(systemA.queries.remove.results.length, 0);
  t.is(systemA.queries.normal.results.length, 0);

  // The entity get removed when SCA is removed too as it was a ghost
  t.is(entityManager._entities.length, 0);
});
