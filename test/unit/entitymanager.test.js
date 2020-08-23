import test from "ava";
import { Component, World } from "../../src";

test("entity id", (t) => {
  var world = new World();

  for (var i = 0; i < 10; i++) {
    world.createEntity();
  }

  t.is(world.entityManager.count(), 10);

  // @todo Check ids
});

test("deferred entity remove", (t) => {
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

test("remove entity clears and reset components first ", (t) => {
  class MyComponent extends Component {
    constructor() {
      super();
      this.isReset = false;
    }
    dispose() {
      this.isReset = true;
      super.dispose();
    }
  }
  const world = new World();
  world.registerComponent(MyComponent, false);

  let entity = world.createEntity();
  entity.addComponent(MyComponent);

  let component = entity.getComponent(MyComponent);
  t.is(component.isReset, false);

  // Deletes component immeditatly.
  entity.remove(true);
  t.is(component.isReset, true);

  // Deletes component is a deferred manner.

  entity = world.createEntity();
  entity.addComponent(MyComponent);
  component = entity.getComponent(MyComponent);
  t.is(component.isReset, false);

  entity.remove();
  world.entityManager.processDeferredRemoval();
  t.is(component.isReset, true);
});
