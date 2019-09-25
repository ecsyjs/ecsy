# ecsy

[![NPM package][npm]][npm-url]
[![Build Size][build-size]][build-size-url]
[![Dev Dependencies][dev-dependencies]][dev-dependencies-url]
[![Build Status][build-status]][build-status-url]
<!--[![Language Grade][lgtm]][lgtm-url]
[![Dependencies][dependencies]][dependencies-url]-->

ECSY (pronounced as "eksi") is an highly experimental Entity Component System framework implemented in javascript, aiming to be lightweight, easy to use and with good performance.

For detailed information on the architecture and API please visit the [documentation page](https://ecsy.io/docs/#/)

## Features
- Framework agnostic
- Focused on providing a simple but yet efficient API
- Designed to avoid garbage collection as possible
- Systems, entities and components are scoped in a `world` instance
- Multiple queries per system
- Reactive support:
  - Support for reactive behaviour on systems (React to changes on entities and components)
  - System can query mutable or immutable components
- Predictable:
  - Systems will run on the order they were registered or based on the priority defined when registering them
  - Reactive events will not generate a random callback when emited but queued and be processed in order
- Modern Javascript: ES6, classes, modules,...
- Pool for components and entities

# Examples
- Ball example:
  - three.js: https://ecsy.io/examples/ball-example/three
  - babylon: https://ecsy.io/examples/ball-example/babylon
- 2D Canvas https://ecsy.io/examples/canvas
- Factory pattern with `Not` operator: https://ecsy.io/examples/factory
- System state component example: https://ecsy.io/examples/systemstate

# Usage

Installing the package via `npm`:

```
npm install --save ecsy
```

```javascript
import {World, System} from 'ecsy';

// Acceleration component
class Acceleration {
  constructor() {
    this.value = 0.1;
  }
}

// Position component
class Position {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }
}

// Create world
var world = new World();

var entityA = world
  .createEntity()
  .addComponent(Position);

for (let i = 0; i < 10; i++) {
  world
    .createEntity();
    .addComponent(Acceleration)
    .addComponent(Position, { x: Math.random() * 10, y: Math.random() * 10, z: 0});
}

// Systems
class MovableSystem extends System {
  init() { // Do whatever you need here }
  // This method will get called on every frame by default
  execute(delta, time) {
    // Iterate through all the entities on the query
    this.queries.moving.forEach(entity => {
      var acceleration = entity.getComponent(Acceleration).value;
      var position = entity.getMutableComponent(Position);
      position.x += acceleration * delta;
      position.y += acceleration * delta;
      position.z += acceleration * delta;
    });
  }
}

// Define a query of entities that have "Acceleration" and "Position" components
System.queries = {
  moving: {
    components: [Acceleration, Position]
  }
}

// Initialize entities
var entityA = world
  .createEntity()
  .addComponent(Position);

for (let i = 0; i < 10; i++) {
  world
    .createEntity();
    .addComponent(Acceleration)
    .addComponent(Position, { x: Math.random() * 10, y: Math.random() * 10, z: 0});
}

// Run!
function run() {
  // Compute delta and elapsed time
  var time = performance.now();
  var delta = time - lastTime;

  // Run all the systems
  world.execute(delta, time);

  lastTime = time;
  requestAnimationFrame(animate);
}

var lastTime = performance.now();
run();
```

You can also include the hosted javascript directly on your HTML:

```html
<!-- Using UMD (It will expose a global ECSY namespace) -->
<script src="https://ecsy.io/build/ecsy.js"></script>

<!-- Using ES6 modules -->
<script src="https://ecsy.io/build/ecsy.module.js"></script>
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
[build-status]: https://travis-ci.com/fernandojsg/ecsy.svg?branch=master
[build-status-url]: https://travis-ci.com/fernandojsg/ecsy

