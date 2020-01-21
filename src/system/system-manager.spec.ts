import { World } from '../world';


describe('system-manager', () => {

  it('registerSystems', () => {
    const world = new World();

    class SystemA {}
    class SystemB {}

    world.registerSystem(SystemA as any);
    expect(world.systemManager.systems.size).toBe(1);
    world.registerSystem(SystemB as any);
    expect(world.systemManager.systems.size).toBe( 2);

    // Can't register twice the same system
    world.registerSystem(SystemA as any);
    expect(world.systemManager.systems.size).toBe(2);
  });
});
