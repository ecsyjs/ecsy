import test from "ava";
import { World } from "../../src";

test("entity id", t => {
  var world = new World();

  for (var i = 0; i < 10; i++) {
    world.createEntity();
  }

  t.is(world.entityManager.count(), 10);

  // @todo Check ids
});

test("deferred entity remove", t => {
  var world = new World();

  for (let i = 0; i < 10; i++) {
    world.createEntity();
  }

  // Force remove
  let i = 5;
  while (i-- > 0) {
    world.entityManager._entities[i].remove(true);
  }

  t.is(world.entityManager.count(), 5);
  t.is(world.entityManager.entitiesToRemove.length, 0);

  // Deferred remove
  i = 5;
  while (i-- > 0) {
    world.entityManager._entities[i].remove();
  }

  t.is(world.entityManager.count(), 5);
  t.is(world.entityManager.entitiesToRemove.length, 5);

  world.entityManager.processDeferredRemoval();

  t.is(world.entityManager.count(), 0);
  t.is(world.entityManager.entitiesToRemove.length, 0);
});
