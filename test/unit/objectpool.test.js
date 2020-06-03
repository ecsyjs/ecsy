import test from "ava";
import DummyObjectPool from "../../src/DummyObjectPool";
import ObjectPool from "../../src/ObjectPool";
import { ComponentManager } from "../../src/ComponentManager";
import { TagComponent } from "../../src/TagComponent";

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
    componentManager.getComponentsPool(NoPoolComponent) instanceof
      DummyObjectPool
  );
  t.true(
    componentManager.getComponentsPool(PoolComponent) instanceof ObjectPool
  );
  t.true(
    componentManager.getComponentsPool(PoolTagComponent) instanceof ObjectPool
  );
});

test("DummyPool", t => {
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
    components.push(pool.acquire());
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
    var component = pool.acquire();
    t.is(component.id, i + 10);
  }

  t.is(pool.totalSize(), 15);
  t.is(pool.totalFree(), Infinity);
  t.is(pool.totalUsed(), 12);
});

test("ObjectPool", t => {
  var id = 0;

  class T {
    constructor() {
      this.id = id++;
    }

    reset() {
      this.id = id++;
    }
  }

  var pool = new ObjectPool(T);
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
