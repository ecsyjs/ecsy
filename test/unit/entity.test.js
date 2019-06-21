import test from "ava";
import { World } from "../../src/index.js";
import { FooComponent, BarComponent } from "../helpers/components";

/**
 * TODO
 * - IDs
 * - tags
 */

test("init", t => {
  var world = new World();

  var entity = world.createEntity();
  var prevId = entity.id;
  entity.__init();

  t.not(entity.id, prevId);
});

test("adding/removing components sync", async t => {
  var world = new World();

  var entity = world.createEntity();

  // Add a new component and check it exist
  entity.addComponent(FooComponent);
  t.is(entity.getComponentTypes().length, 1);
  t.true(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.deepEqual(Object.keys(entity.getComponents()), ["FooComponent"]);

  // Entity doesn't contain BarComponent
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));

  entity.addComponent(BarComponent);
  t.is(entity.getComponentTypes().length, 2);
  t.true(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(BarComponent));
  t.true(entity.hasAllComponents([FooComponent, BarComponent]));
  t.deepEqual(Object.keys(entity.getComponents()), [
    "FooComponent",
    "BarComponent"
  ]);
  entity.removeComponent(FooComponent, true);
  t.is(entity.getComponentTypes().length, 1);
  t.false(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(BarComponent));
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));
  t.deepEqual(Object.keys(entity.getComponents()), ["BarComponent"]);

  entity.addComponent(FooComponent);
  entity.removeAllComponents(true);
  t.is(entity.getComponentTypes().length, 0);
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));
  t.deepEqual(Object.keys(entity.getComponents()), []);
});

test("clearing pooled components", async t => {
  class BazComponent {}

  var world = new World();

  var entity = world.createEntity();
  entity.addComponent(BazComponent, { spam: "eggs" });
  entity.remove();

  t.is(entity.getComponent(BazComponent).spam, "eggs");

  world.entityManager.processDeferredRemoval();

  entity = world.createEntity();
  entity.addComponent(BazComponent);
  entity.remove();

  t.is(entity.getComponent(BazComponent).spam, undefined);
});

test("removing components deferred", async t => {
  var world = new World();

  var entity = world.createEntity();

  // Add a new component and check it exist
  entity.addComponent(FooComponent);

  entity.removeComponent(FooComponent); // Deferred remove
  t.is(entity.getComponentTypes().length, 1);
  t.true(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.deepEqual(Object.keys(entity.getComponents()), ["FooComponent"]);

  world.entityManager.processDeferredRemoval();
  t.is(entity.getComponentTypes().length, 0);
  t.false(entity.hasComponent(FooComponent));
  t.deepEqual(Object.keys(entity.getComponents()), []);
});

test("remove entity", async t => {
  var world = new World();

  // Sync
  world.createEntity().remove(true);
  t.is(world.entityManager.count(), 0);

  // Deferred
  world.createEntity().remove();
  t.is(world.entityManager.count(), 1);
  world.entityManager.processDeferredRemoval();
  t.is(world.entityManager.count(), 0);
});
