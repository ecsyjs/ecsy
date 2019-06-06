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

test("adding/removing components", async t => {
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

  entity.removeComponent(FooComponent);
  t.is(entity.getComponentTypes().length, 1);
  t.false(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(BarComponent));
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));
  t.deepEqual(Object.keys(entity.getComponents()), ["BarComponent"]);

  entity.addComponent(FooComponent);
  entity.removeAllComponents();
  t.is(entity.getComponentTypes().length, 0);
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));
  t.deepEqual(Object.keys(entity.getComponents()), []);
});

test("remove entity", async t => {
  var world = new World();

  var entity = world.createEntity();
  entity.addComponent(FooComponent).addComponent(BarComponent);

  entity.remove();
  t.is(world.entityManager.count(), 0);
});
