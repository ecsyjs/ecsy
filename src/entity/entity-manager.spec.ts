import { World } from '../world';

describe('entity-manager', () => {

  it('entity id', () => {
    const world = new World();

    for (let j = 0; j < 10; j++) {
      world.createEntity();
    }

    expect(world.entityManager.count()).toBe(10);

    // @todo Check ids
  });

  it('deferred entity remove', () => {
    const world = new World();

    for (let j = 0; j < 10; j++) {
      world.createEntity();
    }

    // Force remove
    let i = 5;
    while (i-- > 0) {
      world.entityManager.entities[i].remove(true);
    }

    expect(world.entityManager.count()).toBe(5);
    expect(world.entityManager.entitiesToRemove.length).toBe(0);

    // Deferred remove
    i = 5;
    while (i-- > 0) {
      world.entityManager.entities[i].remove();
    }

    expect(world.entityManager.count()).toBe(5);
    expect(world.entityManager.entitiesToRemove.length).toBe(5);

    world.entityManager.processDeferredRemoval();

    expect(world.entityManager.count()).toBe(0);
    expect(world.entityManager.entitiesToRemove.length).toBe(0);
  });
});
