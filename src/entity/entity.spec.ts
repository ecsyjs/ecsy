import { BarComponent, FooComponent } from '../helpers/components';
import { World } from '../world';

/**
 * TODO
 * - IDs
 */

describe('entity', () => {

  it('reset', () => {
    const world = new World();

    const entity = world.createEntity();
    const prevId = entity.id;
    entity.reset();

    expect(entity.id).not.toBe(prevId);
  });

  describe('adding/removing components sync', () => {
    const world = new World();

    const entity = world.createEntity();

    it('Add a new component and check it exist', () => {

      entity.addComponent(FooComponent);

      expect(entity.getComponentTypes().size).toBe(1);
      expect(entity.hasComponent(FooComponent)).toBeTruthy();
      expect(entity.hasComponent(BarComponent)).toBeFalsy();
      expect([...entity.getComponents().keys()]).toEqual(['FooComponent']);

    });

    it('should Entity doesn\'t contain BarComponent', () => {

      expect(entity.hasAllComponents([FooComponent, BarComponent])).toBeFalsy();
    });

    it('should addComponent', () => {
      entity.addComponent(BarComponent);

      expect(entity.getComponentTypes().size).toBe(2);
      expect(entity.hasComponent(FooComponent)).toBeTruthy();
      expect(entity.hasComponent(BarComponent)).toBeTruthy();
      expect(entity.hasAllComponents([FooComponent, BarComponent])).toBeTruthy();
      expect([...entity.getComponents().keys()]).toEqual([
        'FooComponent',
        'BarComponent'
      ]);
    });

    it('should removeComponent', () => {
      entity.removeComponent(FooComponent, true);

      expect(entity.getComponentTypes().size).toBe(1);
      expect(entity.hasComponent(FooComponent)).toBeFalsy();
      expect(entity.hasComponent(BarComponent)).toBeTruthy();
      expect(entity.hasAllComponents([FooComponent, BarComponent])).toBeFalsy();
      expect([...entity.getComponents().keys()]).toEqual(['BarComponent']);
    });

    it('should removeAllComponents', () => {

      entity.addComponent(FooComponent);
      entity.removeAllComponents(true);

      expect(entity.getComponentTypes().size).toBe(0);
      expect(entity.hasComponent(FooComponent)).toBeFalsy();
      expect(entity.hasComponent(BarComponent)).toBeFalsy();
      expect(entity.hasAllComponents([FooComponent, BarComponent])).toBeFalsy();
      expect(entity.getComponents()).toEqual(new Map());
    });
  });

  describe('clearing pooled components', () => {

    it('property should be taken from addComponent args', () => {
      // Component with no constructor
      class BazComponent {
        spam?: string;
      }

      const world = new World();

      const entity = world.createEntity();
      entity.addComponent(BazComponent, { spam: 'eggs' });

      expect(entity.getComponent(BazComponent).spam).toBe('eggs');
    });


    it('property should be cleared since it is not specified in addComponent args', () => {

      class BazComponent {
        spam?: string;
      }

      const world = new World();

      const entity = world.createEntity();
      entity.addComponent(BazComponent);

      expect(entity.getComponent(BazComponent).spam).toBe(undefined);
    });

    it('property value should be taken from addComponent args', () => {
      // Component with constructor that sets property
      class PimComponent {
        spam = 'bacon';
      }

      const world = new World();

      const entity = world.createEntity();

      entity.addComponent(PimComponent, { spam: 'eggs' });

      expect(entity.getComponent(PimComponent).spam).toBe('eggs');
    });

    it('property should be reset to value initialized in constructor', () => {
      // Component with constructor that sets property
      class PimComponent {
        spam = 'bacon';
      }

      const world = new World();

      const entity = world.createEntity();
      entity.addComponent(PimComponent);

      expect(entity.getComponent(PimComponent).spam).toBe('bacon');
    });

    it('property value should be taken from addComponent args', () => {

      // Component with constructor that sets property
      class PimComponent {
        spam = 'bacon';
      }

      const world = new World();

      let entity = world.createEntity();
      entity.addComponent(PimComponent, { spam: 'eggs' });

      entity.remove();
      world.entityManager.processDeferredRemoval();

      entity = world.createEntity();
      entity.addComponent(PimComponent, { spam: null });
      expect(entity.getComponent(PimComponent).spam).toBe(null);
    });
  });

  it('removing components deferred', async () => {
    const world = new World();

    const entity = world.createEntity();

    // Add a new component and check it exist
    entity.addComponent(FooComponent);

    entity.removeComponent(FooComponent); // Deferred remove
    expect(entity.getComponentTypes().size).toBe(0);
    expect(entity.hasRemovedComponent(FooComponent)).toBeTruthy();
    expect(entity.hasComponent(FooComponent)).toBeFalsy();
    expect(entity.hasComponent(FooComponent)).toBeFalsy();
    expect(entity.hasComponent(BarComponent)).toBeFalsy();
    expect(entity.getComponents()).toEqual(new Map());
    expect([...entity.getComponentsToRemove().keys()]).toEqual(['FooComponent']);

    world.entityManager.processDeferredRemoval();
    expect(entity.getComponentTypes().size).toBe(0);
    expect(entity.hasComponent(FooComponent)).toBeFalsy();
    expect(entity.getComponents()).toEqual(new Map());
  });

  it('remove entity', async () => {
    const world = new World();

    // Sync
    world.createEntity().remove(true);
    expect(world.entityManager.count()).toBe(0);

    // Deferred
    world.createEntity().remove();
    expect(world.entityManager.count()).toBe(1);
    world.entityManager.processDeferredRemoval();
    expect(world.entityManager.count()).toBe(0);
  });

  it('get component includeRemoved', async () => {
    const world = new World();

    // Sync
    const entity = world.createEntity();
    entity.addComponent(FooComponent);
    const component = entity.getComponent(FooComponent);
    entity.removeComponent(FooComponent);

    expect(entity.hasComponent(FooComponent)).toBe(false);
    expect(entity.getComponent(FooComponent)).toBe(undefined);

    expect(entity.hasRemovedComponent(FooComponent)).toBe(true);
    expect(entity.getRemovedComponent(FooComponent)).toEqual(component);

    expect(entity.hasComponent(FooComponent, true)).toBe(true);
    expect(entity.getComponent(FooComponent, true)).toEqual(component);
  });

});
