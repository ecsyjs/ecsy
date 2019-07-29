import test from "ava";
import DummyObjectPool from "../../src/DummyObjectPool";
import ObjectPool from "../../src/ObjectPool";
import { ComponentManager } from "../../src/ComponentManager";
import { TagComponent } from "../../src/TagComponent";

test("dummypool", t => {
  var id = 0;

  class T {
    constructor() {
      this.id = id++;
    }
  }

  var pool = new DummyObjectPool(T);
  var components = [];

  // Create 10 components

  for (let i = 0; i < 10; i++) {
    components.push(pool.aquire());
  }

  t.is(pool.totalSize(), 10);
  t.is(pool.totalFree(), Infinity);
  t.is(pool.totalUsed(), 10);

  for (let i = 0; i < 10; i++) {
    t.is(components[i].id, i);
  }

  // Release 3 components

  pool.release(components[0]);
  pool.release(components[1]);
  pool.release(components[2]);

  t.is(pool.totalSize(), 10);
  t.is(pool.totalFree(), Infinity);
  t.is(pool.totalUsed(), 7);

  // Create new components
  for (let i = 0; i < 5; i++) {
    var component = pool.aquire();
    t.is(component.id, i + 10);
  }

  t.is(pool.totalSize(), 15);
  t.is(pool.totalFree(), Infinity);
  t.is(pool.totalUsed(), 12);
});

test("Detecting Pool", t => {
  var componentManager = new ComponentManager();

  class NoPoolComponent {}
  class PoolComponent {
    constructor() {
      this.num = Math.random();
    }

    reset() {
      this.num = Math.random();
    }
  }
  class PoolTagComponent extends TagComponent {}

  t.true(
    componentManager.getComponentsPool(NoPoolComponent) instanceof DummyObjectPool
  );
  t.true(
    componentManager.getComponentsPool(PoolComponent) instanceof ObjectPool
  );
  t.true(
    componentManager.getComponentsPool(PoolTagComponent) instanceof ObjectPool
  );
});
