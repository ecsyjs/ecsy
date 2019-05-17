# ecsy
An highly experimental Entity Component System written in Javascript.

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
  - Support for reactive systems (React to changes on entities and components)
  - System can query mutable or immutable components
- Predictable:
  - Systems will run on the order they were registered
  - Reactive events will not generate a random callback when emited but queued
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
      entities: [Rotating, Transform]
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
      entities: [Transform]
    };
  }

  onEntitiesAdded(entities) {
    console.log('OnAdded', this.queries.entities.added);
  }
  onEntitiesRemoved(entities) {
    console.log('OnRemoved', this.queries.entities.removed);
  }
  onEntitiesChanged(entities) {
    console.log('OnChanged entities', this.queries.entities.changed);
  }
  onComponentChanged(entities, component) {
    console.log('OnChanged components', entities, component);
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
