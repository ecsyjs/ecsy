import { World } from "../src";
import { Component3 } from "./helpers/components.js";

export function init(benchmarks) {
  benchmarks
    .group("components")
    .add({
      name: "Entity::addComponent(Component3)",
      prepare: ctx => {
        ctx.world = new World();
        ctx.world.registerComponent(Component3);
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity();
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].addComponent(Component3);
        }
      }
    })
    .add({
      name: "Entity::addComponent(Component3)",
      prepare: ctx => {
        ctx.world = new World();
        ctx.world.registerComponent(Component3);
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity();
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].addComponent(Component3);
        }
      }
    })
    .add({
      name: "Entity::removeComponent(Component3)",
      prepare: ctx => {
        ctx.world = new World();
        ctx.world.registerComponent(Component3);
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity().addComponent(Component3);
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].removeComponent(
            Component3
          );
        }
      }
    })
    .add({
      name: "Entity::removeComponent(Component3)",
      prepare: ctx => {
        ctx.world = new World();
        ctx.world.registerComponent(Component3);
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity().addComponent(Component3);
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].removeComponent(
            Component3
          );
        }
      }
    })
    .add({
      name: "Entity::removeComponent(Component3) sync",
      prepare: ctx => {
        ctx.world = new World();
        ctx.world.registerComponent(Component3);
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity().addComponent(Component3);
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].removeComponent(
            Component3,
            true
          );
        }
      }
    })
    .add({
      name: "Entity::removeComponent(Component3) sync",
      prepare: ctx => {
        ctx.world = new World();
        ctx.world.registerComponent(Component3);
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity().addComponent(Component3);
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].removeComponent(
            Component3,
            true
          );
        }
      }
    });

  /*
    .add({
      name: "Entity::addComponent(Component3) poolsize = entities",
      prepare: ctx => {
        ctx.world = new World();
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity();
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].addComponent(Component3);
        }
      }
    });
    */
}
