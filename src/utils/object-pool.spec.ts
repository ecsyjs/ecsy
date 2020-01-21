import { ComponentManager } from '../component';
import { DummyObjectPool } from '../component/dummy-object-pool';
import { TagComponent } from '../tag-component';
import { ObjectPool } from './object-pool';

describe('object-pool', () => {
  it('Detecting Pool', () => {
    const componentManager = new ComponentManager();

    class NoPoolComponent {}
    class PoolComponent {
      num = Math.random();
      reset() {
        this.num = Math.random();
      }
    }
    class PoolTagComponent extends TagComponent {}

    expect(
      componentManager.getComponentsPool(NoPoolComponent) instanceof DummyObjectPool
    ).toBeTruthy();

    expect(
      componentManager.getComponentsPool(PoolComponent) instanceof ObjectPool
    ).toBeTruthy();

    expect(
      componentManager.getComponentsPool(PoolTagComponent) instanceof ObjectPool
    ).toBeTruthy();
  });

  it('DummyPool', () => {
    let id = 0;

    class T {
      id = id++;

      reset() {}
    }

    const pool = new DummyObjectPool(T);
    const components = [];

    // Create 10 components

    for (let i = 0; i < 10; i++) {
      components.push(pool.aquire());
    }

    expect(pool.totalSize()).toBe(10);
    expect(pool.totalFree()).toBe(Infinity);
    expect(pool.totalUsed()).toBe(10);

    for (let i = 0; i < 10; i++) {
      expect(components[i].id).toBe(i);
    }

    // Release 3 components

    // !  Release? DummyPool?

    pool.release();
    pool.release();
    pool.release();

    expect(pool.totalSize()).toBe(10);
    expect(pool.totalFree()).toBe(Infinity);
    expect(pool.totalUsed()).toBe(7);

    // Create new components
    for (let i = 0; i < 5; i++) {
      const component = pool.aquire();
      expect(component.id).toBe(i + 10);
    }

    expect(pool.totalSize()).toBe(15);
    expect(pool.totalFree()).toBe(Infinity);
    expect(pool.totalUsed()).toBe(12);
  });

  it('ObjectPool', () => {
    let id = 0;

    class T {
      id = id++;

      reset() {
        this.id = id++;
      }
    }

    const pool = new ObjectPool(T);
    const components = [];

    // Create 10 components

    for (let i = 0; i < 10; i++) {
      components.push(pool.aquire());
    }

    expect(pool.totalSize()).toBe(12);
    expect(pool.totalFree()).toBe(2);
    expect(pool.totalUsed()).toBe(10);

    // Object Pool doesn't guarantee the order of the retrieved components
    // But each attribute should be different, so we check all against all
    for (let i = 0; i < 10; i++) {
      for (let j = i + 1; j < 10; j++) {
        expect(components[i].id).not.toBe(components[j].id);
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

    expect(pool.totalSize()).toBe(12);
    expect(pool.totalFree()).toBe(5);
    expect(pool.totalUsed()).toBe(7);

    // Create new components
    for (let i = 0; i < 3; i++) {
      components.push(pool.aquire());
    }

    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        expect(components[i].id).not.toBe(components[j].id);
      }
    }

    expect(pool.totalSize()).toBe(12);
    expect(pool.totalFree()).toBe(2);
    expect(pool.totalUsed()).toBe(10);
  });
});
