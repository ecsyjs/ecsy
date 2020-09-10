# Getting started

## ECS principles
ECSY (Pronounced as "eksi") is an Entity Component System (ECS) engine for web applications.
The basic idea of this pattern is to move from defining application entities using a class hierarchy to using composition in a Data Oriented Programming paradigm. ([More info on wikipedia](https://en.wikipedia.org/wiki/Entity_component_system)). Programming with an ECS can result in code that is more efficient and easier to extend over time.
Some common terms within ECS engines are:
- [entities](/manual/Architecture?id=entities): an object with a unique ID that can have multiple components attached to it.
- [components](/manual/Architecture?id=components): different facets of an entity. ex: geometry, physics, hit points.   Data is only stored in components.
- [systems](/manual/Architecture?id=systems): do the actual work with in an application by processing entities and modifying their components.
- [queries](/manual/Architecture?id=queries): used by systems to determine which entities they are interested in, based on the components the entities own.
- [world](/manual/Architecture?id=world): a container for entities, components, systems and queries.

The usual workflow when building an ECS based program:
- Create the `components` that shape the data you need to use in your application.
- Create `entities` and attach `components` to them.
- Create the `systems` that will use these `components` to read and transform the data of these entities.
- Execute all the systems each frame.

## Creating a world
A world is a container for `entities`, `components` and `systems`. Most applications have only one `world`, 
however you can have multiple worlds running at the same time and enable or disable them as you need.

Let's start creating our first world:
```javascript
world = new World();
```

## Creating components
Components are just objects that hold data. We can use any way to define them, for example using ES6 class syntax (recommended):
```javascript
class Acceleration extends Component {}

Acceleration.schema = {
  value: { type: Types.Number, default: 0.1 }
};

class Position extends Component {}

Position.schema = {
  x: { type: Types.Number },
  y: { type: Types.Number },
  z: { type: Types.Number }
};

```

Then we need to register components with the world to use them.

```javascript
  world
    .registerComponent(Acceleration)
    .registerComponent(Position);
```

[More info on how to create components](/manual/Architecture?id=components).

## Creating entities
Having our world and some components already defined, let's create [entities](/manual/Architecture?id=entities) and attach these components to them:
```javascript
var entityA = world
  .createEntity()
  .addComponent(Position);

for (let i = 0; i < 10; i++) {
  world
    .createEntity()
    .addComponent(Acceleration)
    .addComponent(Position, { x: Math.random() * 10, y: Math.random() * 10, z: 0});
}
```

With that, we have just created 11 entities. 10 with the `Acceleration` and `Position` components, and one with just the `Position` component.
Notice that the `Position` component is added using custom parameters. If we didn't use the parameters then the
component would use the default values declared in the `Position` class.

## Creating a system
Now we are going to define a [system](/manual/Architecture?id=systems) to process the components we just created.
A system should extend the `System` interface and can implement the following methods:
- `init`: This will get called when the system is registered in a world.
- `execute(delta, time)`: This is called on every frame.

We could also define the [queries](/manual/Architecture?id=queries) of entities we are interested in based on the components they own. The `queries` attribute should be a static attribute of your system.

We will start by creating a system that will loop through all the entities that have a `Position` component (11 in our example) and log their positions.

```javascript
class PositionLogSystem extends System {
  init() { /* Do whatever you need here */ }

  // This method will get called on every frame
  execute(delta, time) {
    // Iterate through all the entities on the query
    this.queries.position.results.forEach(entity => {
      // Access the component `Position` on the current entity
      let pos = entity.getComponent(Position);

      console.log(`Entity with ID: ${entity.id} has component Position={x: ${pos.x}, y: ${pos.y}, z: ${pos.z}}`);
    });
  }
}

// Define a query of entities that have the "Position" component
PositionLogSystem.queries = {
  position: {
    components: [Position]
  }
}
```

The next system moves each entity that has both a Position and an Acceleration.

```javascript
class MovableSystem extends System {
  init() { /* Do whatever you need here */ }

  // This method will get called on every frame by default
  execute(delta, time) {

    // Iterate through all the entities on the query
    this.queries.moving.results.forEach(entity => {

      // Get the `Acceleration` component as Read-only
      let acceleration = entity.getComponent(Acceleration).value;

      // Get the `Position` component as Writable
      let position = entity.getMutableComponent(Position);
      position.x += acceleration * delta;
      position.y += acceleration * delta;
      position.z += acceleration * delta;
    });
  }
}
```

Please note that we are accessing components on an entity by calling:
- `getComponent(Component)`: If the component will be used as read-only.
- `getMutableComponent(Component)`: If we plan to modify the values on the component.

```javascript
// Define a query of entities that have "Acceleration" and "Position" components
MovableSystem.queries = {
  moving: {
    components: [Acceleration, Position]
  }
}
```

This system's query `moving` holds a list of entities that have both `Acceleration` and `Position`; 10 in total in our example.

Please notice that we could create an arbitrary number of queries if needed and process them in `execute`, ex:
```javascript
class SystemDemo extends System {
  execute() {
    this.queries.boxes.results.forEach(entity => { /* do things */});
    this.queries.balls.results.forEach(entity => { /* do things */});
  }
}

SystemDemo.queries = {
  boxes: { components: [Box] },
  balls: { components: [Ball] },
};
```

Now let's register them in the world so they get initialized and added to the default scheduler to execute them on each frame.

```javascript
world
  .registerSystem(MovableSystem)
  .registerSystem(PositionLogSystem);
```

For more information this please check the architecture documentation: [Accessing and modifying components](/manual/Architecture?id=accessing-components-and-modify-components) and [Reactive Queries](/manual/Architecture?id=reactive-queries)


## Start!
Now you just need to invoke `world.execute(delta, time)` per frame. Currently ECSY doesn't provide a default scheduler, so you must do it yourself. eg:
```javascript
let  lastTime = performance.now();
function  run() {
  // Compute delta and elapsed time
  let time = performance.now();
  let delta = time - lastTime;

  // Run all the systems
  world.execute(delta, time);

  lastTime = time;
  requestAnimationFrame(run);
}

run();
```

## Putting everything together
```javascript
import { World, System } from 'ecsy';

let world = new World();

class Acceleration extends Component {}

Acceleration.schema = {
  value: { type: Types.Number, default: 0.1 }
};

class Position extends Component {}

Position.schema = {
  x: { type: Types.Number },
  y: { type: Types.Number },
  z: { type: Types.Number }
};

world
  .registerComponent(Acceleration)
  .registerComponent(Position);

class PositionLogSystem extends System {
  init() {}
  execute(delta, time) {
    this.queries.position.results.forEach(entity => {
      let pos = entity.getComponent(Position);
      console.log(`Entity with ID: ${entity.id} has component Position={x: ${pos.x}, y: ${pos.y}, z: ${pos.z}}`);
    });
  }
}

PositionLogSystem.queries = {
  position: {
    components: [Position]
  }
}

class MovableSystem extends System {
  init() {}
  execute(delta, time) {
    this.queries.moving.results.forEach(entity => {
      let acceleration = entity.getComponent(Acceleration).value;
      let position = entity.getMutableComponent(Position);
      position.x += acceleration * delta;
      position.y += acceleration * delta;
      position.z += acceleration * delta;
    });
  }
}

MovableSystem.queries = {
  moving: {
    components: [Acceleration, Position]
  }
}

world
  .registerSystem(MovableSystem)
  .registerSystem(PositionLogSystem)

world
  .createEntity()
  .addComponent(Position);

for (let i = 0; i < 10; i++) {
  world
    .createEntity()
    .addComponent(Acceleration)
    .addComponent(Position, { x: Math.random() * 10, y: Math.random() * 10, z: 0});
}

let lastTime = performance.now();
function run() {
  let time = performance.now();
  let delta = time - lastTime;

  world.execute(delta, time);

  lastTime = time;
  requestAnimationFrame(run);
}

run();
```

## What's next?
This was a quick overview on how things are structured using ECSY, but we encourage you to [read the architecture documentation](/manual/Architecture) for more detailed information.
