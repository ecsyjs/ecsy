import test from "ava";
import { World, Component, Types } from "../../src/index.js";
import { FooComponent, BarComponent } from "../helpers/components";

/**
 * TODO
 * - IDs
 */

test("adding/removing components sync", async t => {
  var world = new World();

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  var entity = world.createEntity();

  // Add a new component and check it exist
  entity.addComponent(FooComponent);
  t.is(entity.getComponentTypes().length, 1);
  t.true(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.deepEqual(
    Object.values(entity.getComponents()).map(comp => comp.constructor),
    [FooComponent]
  );

  // Entity doesn't contain BarComponent
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));

  entity.addComponent(BarComponent);
  t.is(entity.getComponentTypes().length, 2);
  t.true(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(BarComponent));
  t.true(entity.hasAllComponents([FooComponent, BarComponent]));
  t.deepEqual(
    Object.values(entity.getComponents()).map(comp => comp.constructor),
    [FooComponent, BarComponent]
  );

  entity.removeComponent(FooComponent, true);
  t.is(entity.getComponentTypes().length, 1);
  t.false(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(BarComponent));
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));
  t.deepEqual(
    Object.values(entity.getComponents()).map(comp => comp.constructor),
    [BarComponent]
  );

  entity.addComponent(FooComponent);
  entity.removeAllComponents(true);
  t.is(entity.getComponentTypes().length, 0);
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));
  t.deepEqual(
    Object.values(entity.getComponents()).map(comp => comp.constructor),
    []
  );
});

test("clearing pooled components", async t => {
  var world, entity;

  // Component with no constructor

  class BazComponent extends Component {}

  BazComponent.schema = {
    spam: { type: Types.String }
  };

  world = new World();
  world.registerComponent(BazComponent);
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
    "",
    "property should be cleared since it is not specified in addComponent args"
  );

  // Component with constructor that sets property

  class PimComponent extends Component {
    constructor(props) {
      super(props);
      this.spam = props && props.spam !== undefined ? props.spam : "bacon";
    }
  }

  world = new World();

  world.registerComponent(PimComponent, false);

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

  world.registerComponent(PimComponent, false);

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

  world.registerComponent(FooComponent).registerComponent(BarComponent);

  var entity = world.createEntity();

  // Add a new component and check it exist
  entity.addComponent(FooComponent);

  entity.removeComponent(FooComponent); // Deferred remove
  t.is(entity.getComponentTypes().length, 0);
  t.true(entity.hasRemovedComponent(FooComponent));
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.deepEqual(
    Object.values(entity.getComponents()).map(comp => comp.constructor),
    []
  );
  t.deepEqual(
    Object.values(entity.getComponentsToRemove()).map(comp => comp.constructor),
    [FooComponent]
  );

  world.entityManager.processDeferredRemoval();
  t.is(entity.getComponentTypes().length, 0);
  t.false(entity.hasComponent(FooComponent));
  t.deepEqual(
    Object.values(entity.getComponents()).map(comp => comp.constructor),
    []
  );
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

test("get component development", async t => {
  var world = new World();

  world.registerComponent(FooComponent);

  // Sync
  var entity = world.createEntity();
  entity.addComponent(FooComponent);
  const component = entity.getComponent(FooComponent);

  t.throws(() => (component.variableFoo = 4));

  entity.removeComponent(FooComponent);

  t.is(entity.hasComponent(FooComponent), false);
  t.is(entity.getComponent(FooComponent), undefined);

  const removedComponent = entity.getComponent(FooComponent, true);

  t.throws(() => (removedComponent.variableFoo = 14));
});

test("get component production", async t => {
  const oldNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  var world = new World();

  world.registerComponent(FooComponent);

  // Sync
  var entity = world.createEntity();
  entity.addComponent(FooComponent);
  const component = entity.getComponent(FooComponent);

  t.notThrows(() => (component.variableFoo = 4));

  entity.removeComponent(FooComponent);

  t.is(entity.hasComponent(FooComponent), false);
  t.is(entity.getComponent(FooComponent), undefined);

  const removedComponent = entity.getComponent(FooComponent, true);

  t.notThrows(() => (removedComponent.variableFoo = 14));

  process.env.NODE_ENV = oldNodeEnv;
});

test("get mutable component", async t => {
  var world = new World();

  world.registerComponent(FooComponent);

  // Sync
  var entity = world.createEntity();
  entity.addComponent(FooComponent);
  const component = entity.getMutableComponent(FooComponent);

  t.notThrows(() => (component.variableFoo = 4));

  t.deepEqual(entity.getMutableComponent(BarComponent), undefined);
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
