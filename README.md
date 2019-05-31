# ecsy
An highly experimental Entity Component System written in Javascript.

[![NPM package][npm]][npm-url]
[![Build Size][build-size]][build-size-url]
[![Dev Dependencies][dev-dependencies]][dev-dependencies-url]
[![Build Status][build-status]][build-status-url]
<!--[![Language Grade][lgtm]][lgtm-url]
[![Dependencies][dependencies]][dependencies-url]-->



Designed aiming to achieve a "pure" ECS implementation, following two main rules:
- Components are just data, and do not have behaviour.
- Systems have just behaviour, without storing state.

# Examples
- Ball example:
  - three.js: https://fernandojsg.github.io/ecsy/examples/ball-example/three
  - babylon: https://fernandojsg.github.io/ecsy/examples/ball-example/babylon/ (WIP)
- 2D Canvas https://fernandojsg.github.io/ecsy/examples/canvas

# Features
- Framework agnostic
- Focused on providing a simple but yet efficient API
- Designed to avoid garbage collection as possible
- Systems, entities and components are scoped in a `world` instance
- Singleton components can be registered per `world`
- Multiple queries per system
- Reactive support:
  - Support for reactive behaviour on systems (React to changes on entities and components)
  - System can query mutable or immutable components
- Predictable:
  - Systems will run on the order they were registered or based on the priority defined when registering them
  - Reactive events will not generate a random callback when emited but queued and be processed in order
- Modern Javascript: ES6, classes, modules,...
- Pool for components and entities

# Roadmap

# Getting started
```
npm install --save ecsy
```

# Complete example
**Warning: Highly experimental API subject to change every day :)**

```javascript
import {World, System, ReactiveSystem} from 'ecs';

// Rotating component
class Rotating {
  constructor() {
    this.rotatingSpeed = 0.1;
    this.decreasingSpeed = 0.001;
  }
}

// Transform component
class Transform {
  constructor() {
    this.rotation = { x: 0, y: 0, z: 0 };
    this.position = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
  }
}

// Mouse component (to be used as singleton)
class MouseState {
  constructor() {
    this.mouseDown = false;
  }
}

// Create a TestSystem to modify Transform components
class RotatingSystem extends System {
  init() {
    return {
      queries: {
        entities: { components: [Rotating, Transform] }
      }
    };
  }

  execute(delta) {
    let entities = this.queries.entities;
    for (var i = 0; i < entities.length; i++) {
      var entity = entities[i];

      var rotating = entity.getComponent(Rotating);
      var rotatingSpeed = rotating.rotatingSpeed;

      var transform = entity.getMutableComponent(Transform);
      transform.rotation.x += rotatingSpeed;
    }
  }
}

// Create a TestSystem
class MouseSystem extends System {
  init() {
    var mouseState = this.world.components.mouseState;
    window.addEventListener('mousedown', () => {
      mouseState.mouseDown = true;
    });

    window.addEventListener('mouseup', () => {
      mouseState.mouseDown = false;
    });
  }
}

// Create a reactive system
class ReactiveSystem extends System {
  init() {
    return {
      queries: {
        entities: {
          components: [Rotating, Transform]
          events: {
            added: {
              event: "EntityAdded"
            },
            removed: {
              event: "EntityRemoved"
            },
            changed: {
              event: "EntityChanged"
            },
            rotatingChanged: {
              event: "ComponentChanged",
              components: [Rotating]
            },
            transformChanged: {
              event: "ComponentChanged",
              components: [Transform]
            }
          }
        }
      }
    };
  }

  execute() {
    console.log('OnAdded', this.events.entities.added);
    console.log('OnRemoved', this.events.entities.removed);
    console.log('OnChanged entities', this.events.entities.changed);
    console.log('OnChanged Rotating Component', this.events.entities.rotatingChanged);
    console.log('OnChanged Transform Component', this.events.entities.transformChanged);
  }
}

// Create a world and register all the elements on it
var world = new World();
world
  .registerComponent(Rotating)
  .registerComponent(Transform)
  .registerSingletonComponent(MouseState);

world
  .registerSystem(RotatingSystem)
  .registerSystem(MouseSystem);

var entity = world.createEntity();
entity
  .addComponent(Rotating, {rotationSpeed: 0.2})
  .addComponent(Transform);

// Update systems per frame
var previousTime = performance.now();

function update() {
  var time = performance.now();
  var delta = time - previousTime;
  previousTime = time;

  world.execute(delta, time);
  requestAnimationFrame(update);
}

requestAnimationFrame(update);
```

[npm]: https://img.shields.io/npm/v/ecsy.svg
[npm-url]: https://www.npmjs.com/package/ecsy
[build-size]: https://badgen.net/bundlephobia/minzip/ecsy
[build-size-url]: https://bundlephobia.com/result?p=ecsy
[dependencies]: https://img.shields.io/david/fernandojsg/ecsy.svg
[dependencies-url]: https://david-dm.org/fernandojsg/ecsy
[dev-dependencies]: https://img.shields.io/david/dev/fernandojsg/ecsy.svg
[dev-dependencies-url]: https://david-dm.org/fernandojsg/ecsy#info=devDependencies
[lgtm]: https://img.shields.io/lgtm/grade/javascript/g/fernandojsg/ecsy.svg?label=code%20quality
[lgtm-url]: https://lgtm.com/projects/g/fernandojsg/ecsy/
[build-status]: https://travis-ci.org/fernandojsg/ecsy.svg?branch=master
[build-status-url]: https://travis-ci.org/fernandojsg/ecsy
