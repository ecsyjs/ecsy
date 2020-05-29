import { World } from "../src";
import { Component3, Component3NoReset } from "./helpers/components.js";

export function init(benchmarks) {
  benchmarks
    .add({
      name: "Entity::addComponent(Component3NoReset)",
      prepare: ctx => {
        ctx.world = new World();
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity();
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].addComponent(Component3NoReset);
        }
      },
      iterations: 10
    })
    .add({
      name: "Entity::addComponent(Component3NoReset)",
      prepare: ctx => {
        ctx.world = new World();
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity();
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].addComponent(Component3NoReset);
        }
      },
      iterations: 10
    })
    .add({
      name: "Entity::removeComponent(Component3NoReset)",
      prepare: ctx => {
        ctx.world = new World();
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity().addComponent(Component3NoReset);
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].removeComponent(
            Component3NoReset
          );
        }
      },
      iterations: 10
    })
    .add({
      name: "Entity::removeComponent(Component3NoReset)",
      prepare: ctx => {
        ctx.world = new World();
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity().addComponent(Component3NoReset);
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].removeComponent(
            Component3NoReset
          );
        }
      },
      iterations: 10
    })
    .add({
      name: "Entity::removeComponent(Component3NoReset) sync",
      prepare: ctx => {
        ctx.world = new World();
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity().addComponent(Component3NoReset);
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].removeComponent(
            Component3NoReset,
            true
          );
        }
      },
      iterations: 10
    })
    .add({
      name: "Entity::removeComponent(Component3NoReset) sync",
      prepare: ctx => {
        ctx.world = new World();
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity().addComponent(Component3NoReset);
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].removeComponent(
            Component3NoReset,
            true
          );
        }
      },
      iterations: 10
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
      },
      iterations: 10
    });
    */
}
