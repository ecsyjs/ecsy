import test from "ava";
import Entity from "../../src/Entity";
import { World } from "../../src/index.js";
import { FooComponent, BarComponent } from "../helpers/components";

test("entity id", t => {
  var entities = [];
  for (var i = 0; i < 10; i++) {
    entities.push(new Entity());
  }

  for (var i = 0; i < 10; i++) {
    t.is(entities[i].id, i);
  }
});

test("adding components", async t => {
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

/*
// Entity created directly without using entityManager.createEntity()
test("dispose entity", async t => {
  var world = new World();

  var entity = world.createEntity();
  t.is(world.entityManager._entities.length, 1);
  entity.addComponent(FooComponent);
  //entity.dispose();
  //t.is(world.entityManager._entities.length, 0);

  //entity.dispose();

  //t.is(error.message, "Tried to remove entity not in list");
});
*/
