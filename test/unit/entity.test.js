import test from "ava";
import { World } from "../../src/index.js";
import { FooComponent, BarComponent } from "../helpers/components";

/**
 * TODO
 * - IDs
 */

test("reset", t => {
  var world = new World();

  var entity = world.createEntity();
  var prevId = entity.id;
  entity.reset();

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
  var world, entity;

  // Component with no constructor

  class BazComponent {}

  world = new World();

  entity = world.createEntity();
  entity.addComponent(BazComponent, { spam: "eggs" });
  t.is(
    entity.getComponent(BazComponent).spam,
    "eggs",
    "property should be taken from addComponent args"
  );

  entity.remove();
  world.entityManager.processDeferredRemoval();

  entity = world.createEntity();
  entity.addComponent(BazComponent);

  t.is(
    entity.getComponent(BazComponent).spam,
    undefined,
    "property should be cleared since it is not specified in addComponent args"
  );

  // Component with constructor that sets property

  class PimComponent {
    constructor() {
      this.spam = "bacon";
    }
  }

  world = new World();

  entity = world.createEntity();
  entity.addComponent(PimComponent, { spam: "eggs" });
  t.is(
    entity.getComponent(PimComponent).spam,
    "eggs",
    "property value should be taken from addComponent args"
  );

  entity.remove();
  world.entityManager.processDeferredRemoval();

  entity = world.createEntity();
  entity.addComponent(PimComponent);

  t.is(
    entity.getComponent(PimComponent).spam,
    "bacon",
    "property should be reset to value initialized in constructor"
  );

  world = new World();

  entity = world.createEntity();
  entity.addComponent(PimComponent, { spam: "eggs" });

  entity.remove();
  world.entityManager.processDeferredRemoval();

  entity = world.createEntity();
  entity.addComponent(PimComponent, { spam: null });

  t.is(
    entity.getComponent(PimComponent).spam,
    null,
    "property value should be taken from addComponent args"
  );
});

test("removing components deferred", async t => {
  var world = new World();

  var entity = world.createEntity();

  // Add a new component and check it exist
  entity.addComponent(FooComponent);

  entity.removeComponent(FooComponent); // Deferred remove
  t.is(entity.getComponentTypes().length, 0);
  t.true(entity.hasRemovedComponent(FooComponent));
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.deepEqual(Object.keys(entity.getComponents()), []);
  t.deepEqual(Object.keys(entity.getComponentsToRemove()), ["FooComponent"]);

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

test("get component includeRemoved", async t => {
  var world = new World();

  // Sync
  var entity = world.createEntity();
  entity.addComponent(FooComponent);
  const component = entity.getComponent(FooComponent);
  entity.removeComponent(FooComponent);

  t.is(entity.hasComponent(FooComponent), false);
  t.is(entity.getComponent(FooComponent), undefined);

  t.is(entity.hasRemovedComponent(FooComponent), true);
  t.deepEqual(entity.getRemovedComponent(FooComponent), component);

  t.is(entity.hasComponent(FooComponent, true), true);
  t.deepEqual(entity.getComponent(FooComponent, true), component);
});

test("Delete entity from entitiesByNames", async t => {
  var world = new World();

  // Sync
  let entityA = world.createEntity("entityA");
  let entityB = world.createEntity("entityB");

  t.deepEqual(
    { entityA: entityA, entityB: entityB },
    world.entityManager._entitiesByNames
  );

  // Immediate remove
  entityA.remove(true);

  t.deepEqual({ entityB: entityB }, world.entityManager._entitiesByNames);

  // Deferred remove
  entityB.remove();

  t.deepEqual({ entityB: entityB }, world.entityManager._entitiesByNames);
  world.execute(); // Deferred remove happens

  t.deepEqual({}, world.entityManager._entitiesByNames);
});
