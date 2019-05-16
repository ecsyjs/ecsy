import test from "ava";
import { World } from "../../src";

test("entity id", t => {
  var world = new World();

  for (var i = 0; i < 10; i++) {
    world.createEntity();
  }

  t.is(world.entityManager.count(), 10);

  // @todo Check ids
});
