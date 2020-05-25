import test from "ava";
import "../helpers/common.js";
import {
  Component,
  TagComponent,
  World,
  Types,
  ObjectPool
} from "../../src/index";

test("Detecting Pool", t => {
  var world = new World();

  class NoPoolComponent extends Component {}
  class PoolComponent extends Component {}
  PoolComponent.schema = {
    num: { type: Types.Number }
  };
  class PoolTagComponent extends TagComponent {}
  class CustomPoolComponent extends Component {}

  world.registerComponent(PoolComponent);
  world.registerComponent(PoolTagComponent);
  world.registerComponent(NoPoolComponent, false);

  var customPool = new ObjectPool(new CustomPoolComponent(), 10);
  world.registerComponent(CustomPoolComponent, customPool);

  t.true(
    world.componentsManager.getComponentsPool(NoPoolComponent) === undefined
  );
  t.true(
    world.componentsManager.getComponentsPool(PoolComponent) instanceof
      ObjectPool
  );
  t.true(
    world.componentsManager.getComponentsPool(PoolTagComponent) instanceof
      ObjectPool
  );
  t.is(
    world.componentsManager.getComponentsPool(CustomPoolComponent),
    customPool
  );
});

test("ObjectPool", t => {
  var id = 0;

  class T extends Component {
    constructor() {
      super();
      this.id = id++;
    }
  }

  var pool = new ObjectPool(new T());
  var components = [];

  // Create 10 components

  for (let i = 0; i < 10; i++) {
    components.push(pool.acquire());
  }

  t.is(pool.totalSize(), 12);
  t.is(pool.totalFree(), 2);
  t.is(pool.totalUsed(), 10);

  // Object Pool doesn't guarantee the order of the retrieved components
  // But each attribute should be different, so we check all against all
  for (let i = 0; i < 10; i++) {
    for (let j = i + 1; j < 10; j++) {
      t.not(components[i].id, components[j].id);
    }
  }

  // Release 3 components
  function removeElement(pos) {
    pool.release(components[pos]);
    components.splice(pos, 1);
  }

  removeElement(0);
  removeElement(1);
  removeElement(2);

  t.is(pool.totalSize(), 12);
  t.is(pool.totalFree(), 5);
  t.is(pool.totalUsed(), 7);

  // Create new components
  for (let i = 0; i < 3; i++) {
    components.push(pool.acquire());
  }

  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      t.not(components[i].id, components[j].id);
    }
  }

  t.is(pool.totalSize(), 12);
  t.is(pool.totalFree(), 2);
  t.is(pool.totalUsed(), 10);
});
