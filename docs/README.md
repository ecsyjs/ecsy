# ecsy

[![NPM package][npm]][npm-url]
[![Build Size][build-size]][build-size-url]
[![Dev Dependencies][dev-dependencies]][dev-dependencies-url]
[![Build Status][build-status]][build-status-url]
<!--[![Language Grade][lgtm]][lgtm-url]
[![Dependencies][dependencies]][dependencies-url]-->

ECSY (pronounced as "eck-see") is an highly experimental Entity Component System framework implemented in javascript, aiming to be lightweight, easy to use and with good performance.

For detailed information on the architecture and API please visit the [documentation page](https://ecsy.io/docs/#/)

* discourse forum: https://discourse.mozilla.org/c/mixed-reality/ecsy
* discord: https://discord.gg/cFnrQ2v

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

## Goals
Our goal is for ECSY to be a lightweight, simple, and performant ECS library that can be easily extended and encoruages open source collaboration.

ECSY will not ship with features that bind it to a rendering engine or framework. Instead, we encourage the community to build framework specific projects like [ecsy-three](https://github.com/MozillaReality/ecsy-three), [ecsy-babylon](https://github.com/kaliber5/ecsy-babylon), and [ecsy-two](https://github.com/joshmarinacci/ecsy-two).

ECSY does not adhere strictly to "pure ECS design". We focus on APIs that push users towards good ECS design like putting their logic in systems and data in components. However, we will sometimes break the rules for API ergonomics, performance in a JS context, or integration with non-ECS frameworks.

ECSY is designed for a community driven ecosystem. We encourage users to come up with modular components and systems that can be composed into larger games, apps, and engines.

# Examples
- Ball example:
  - three.js: https://ecsy.io/examples/ball-example/three
  - babylon: https://ecsy.io/examples/ball-example/babylon
- 2D Canvas https://ecsy.io/examples/canvas
- Factory pattern with `Not` operator: https://ecsy.io/examples/factory
- System state component example: https://ecsy.io/examples/systemstatecomponents

# Usage

Installing the package via `npm`:

```
npm install --save ecsy
```

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Hello!</title>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      html, body: {
        margin: 0;
        padding: 0;
      }
    </style>
    
    <script type="module">
      import { World, System, Component, TagComponent, Types } from "https://ecsy.io/build/ecsy.module.js";

      const NUM_ELEMENTS = 50;
      const SPEED_MULTIPLIER = 0.3;
      const SHAPE_SIZE = 50;
      const SHAPE_HALF_SIZE = SHAPE_SIZE / 2;
      
      // Initialize canvas
      let canvas = document.querySelector("canvas");
      let canvasWidth = canvas.width = window.innerWidth;
      let canvasHeight = canvas.height = window.innerHeight;
      let ctx = canvas.getContext("2d");

      //----------------------
      // Components
      //----------------------
      
      // Velocity component
      class Velocity extends Component {}

      Velocity.schema = {
        x: { type: Types.Number },
        y: { type: Types.Number }
      };

      // Position component
      class Position extends Component {}

      Position.schema = {
        x: { type: Types.Number },
        y: { type: Types.Number }
      };
      
      // Shape component
      class Shape extends Component {}

      Shape.schema = {
        primitive: { type: Types.String, default: 'box' }
      };
      
      // Renderable component
      class Renderable extends TagComponent {}
      
      //----------------------
      // Systems
      //----------------------
      
      // MovableSystem
      class MovableSystem extends System {
        // This method will get called on every frame by default
        execute(delta, time) {
          // Iterate through all the entities on the query
          this.queries.moving.results.forEach(entity => {
            var velocity = entity.getComponent(Velocity);
            var position = entity.getMutableComponent(Position);
            position.x += velocity.x * delta;
            position.y += velocity.y * delta;
            
            if (position.x > canvasWidth + SHAPE_HALF_SIZE) position.x = - SHAPE_HALF_SIZE;
            if (position.x < - SHAPE_HALF_SIZE) position.x = canvasWidth + SHAPE_HALF_SIZE;
            if (position.y > canvasHeight + SHAPE_HALF_SIZE) position.y = - SHAPE_HALF_SIZE;
            if (position.y < - SHAPE_HALF_SIZE) position.y = canvasHeight + SHAPE_HALF_SIZE;
          });
        }
      }

      // Define a query of entities that have "Velocity" and "Position" components
      MovableSystem.queries = {
        moving: {
          components: [Velocity, Position]
        }
      }

      // RendererSystem
      class RendererSystem extends System {
        // This method will get called on every frame by default
        execute(delta, time) {
          
          ctx.fillStyle = "#d4d4d4";
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          
          // Iterate through all the entities on the query
          this.queries.renderables.results.forEach(entity => {
            var shape = entity.getComponent(Shape);
            var position = entity.getComponent(Position);
            if (shape.primitive === 'box') {
              this.drawBox(position);
            } else {
              this.drawCircle(position);
            }
          });
        }
        
        drawCircle(position) {
          ctx.beginPath();
          ctx.arc(position.x, position.y, SHAPE_HALF_SIZE, 0, 2 * Math.PI, false);
          ctx.fillStyle= "#39c495";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#0b845b";
          ctx.stroke();          
        }
        
        drawBox(position) {
          ctx.beginPath();
          ctx.rect(position.x - SHAPE_HALF_SIZE, position.y - SHAPE_HALF_SIZE, SHAPE_SIZE, SHAPE_SIZE);
          ctx.fillStyle= "#e2736e";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#b74843";
          ctx.stroke();                      
        }
      }

      // Define a query of entities that have "Renderable" and "Shape" components
      RendererSystem.queries = {
        renderables: { components: [Renderable, Shape] }
      }
      
      // Create world and register the components and systems on it
      var world = new World();
      world
        .registerComponent(Velocity)
        .registerComponent(Position)
        .registerComponent(Shape)
        .registerComponent(Renderable)
        .registerSystem(MovableSystem)
        .registerSystem(RendererSystem);

      // Some helper functions when creating the components
      function getRandomVelocity() {
        return {
          x: SPEED_MULTIPLIER * (2 * Math.random() - 1), 
          y: SPEED_MULTIPLIER * (2 * Math.random() - 1)
        };
      }
      
      function getRandomPosition() {
        return { 
          x: Math.random() * canvasWidth, 
          y: Math.random() * canvasHeight
        };
      }
      
      function getRandomShape() {
         return {
           primitive: Math.random() >= 0.5 ? 'circle' : 'box'
         };
      }
      
      for (let i = 0; i < NUM_ELEMENTS; i++) {
        world
          .createEntity()
          .addComponent(Velocity, getRandomVelocity())
          .addComponent(Shape, getRandomShape())
          .addComponent(Position, getRandomPosition())
          .addComponent(Renderable)        
      }
            
      // Run!
      function run() {
        // Compute delta and elapsed time
        var time = performance.now();
        var delta = time - lastTime;

        // Run all the systems
        world.execute(delta, time);

        lastTime = time;
        requestAnimationFrame(run);
      }

      var lastTime = performance.now();
      run();      
    </script>
  </head>  
  <body>
    <canvas width="500" height="500"></canvas>
  </body>
</html>
```
[Try it on glitch](https://glitch.com/~ecsy-0-3-0-boxes-and-circles)


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

