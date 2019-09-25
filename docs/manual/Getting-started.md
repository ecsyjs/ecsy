# Getting started

## ECS principles
ECSY (Pronounced as "eksi") is an Entity Component System (ECS) engine for web applications.
The basic idea of this pattern is to move from defining the entities in our application using composition in a Data Oriented Programming paradigm. ([More info on wikipedia](https://en.wikipedia.org/wiki/Entity_component_system))
Some common terminology of the elements needed to build an ECSY application are:
- [entities](/manual/Architecture?id=entities): Is an object that has an unique ID and can have multiple components attached to it.
- [components](/manual/Architecture?id=components): Is where the data is stored.
- [systems](/manual/Architecture?id=systems): Processes list of entities reading and modifying their components.
- [queries](/manual/Architecture?id=queries): Used by systems to determine which entities they are interested in, based on the components the entities own.
- [world](/manual/Architecture?id=world): Container for entities, components, systems and queries.

The usual workflow would be:
- Create the `components` that shape the data you need to use in your application.
- Create `entities` and attach `components` to them.
- Create the `systems` that will use these `components` to read and transform the data of these entities.
- Execute all the systems each frame.

## Creating a world
By default your application should have at least one `world`. A world is basically a container for `entities`, `components` and `systems`.  Although you can have multiple worlds running at the same time and enable or disable them as you need.

Let's start creating our first world:
```javascript
world = new World();
```

## Creating components
Components are just objects that hold data. So we can use any way to define them, for example using ES6 class syntax (recommended):
```javascript
class Acceleration {
  constructor() {
    this.value = 0.1;
  }
}

class Position {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }
}
```

[More info on how to create components](/manual/Architecture?id=components).

## Creating entities
Having our world and some components already defined, let's create [entities](/manual/Architecture?id=entities) and attach theses components to them:
```javascript
var entityA = world
  .createEntity()
  .addComponent(Position);

for (let i = 0; i < 10; i++) {
  world
    .createEntity();
    .addComponent(Acceleration)
    .addComponent(Position, { x: Math.random() * 10, y: Math.random() * 10, z: 0});
}
```
With that we have just created 11 entities. 10 with the `Acceleration` and `Position` components, and one just with the `Position` component.

## Creating a system
Now we are going to define a [system](/manual/Architecture?id=systems) to process the components we just created.
A system should extend the `System` interface and could implement the following methods:
- `init`: This will get called when the system is registered in a world.
- `execute(delta, time)`: This is called on every frame.

We could also define the [queries](/manual/Architecture?id=queries) of entities we are interested in based on the components they own. The `queries` attribute should be a static attribute of your system.

We will start creating a system that will just loop through all the entities that has a `Position` component (11 in our example) and log theirs position.

```javascript
class PositionLogSystem extends System {
  init() { /* Do whatever you need here */ }

  // This method will get called on every frame
  execute(delta, time) {
    // Iterate through all the entities on the query
    this.queries.position.forEach(entity => {
      // Access the component `Position` on the current entity
      var position = entity.getComponent(Position);

      console.log(`Entity with ID: ${entity.id} has component Position={x: ${position.x}, y: ${position.y}, z: ${position.z}}`);
    });
  }
}

// Define a query of entities that have the "Position" component
System.queries = {
  position: {
    components: [Position]
  }
}
```

```javascript
class MovableSystem extends System {
  init() { /* Do whatever you need here */ }

  // This method will get called on every frame by default
  execute(delta, time) {

    // Iterate through all the entities on the query
    this.queries.moving.forEach(entity => {

      // Get the `Acceleration` component as Read-only
      var acceleration = entity.getComponent(Acceleration).value;

      // Get the `Position` component as Writable
      var position = entity.getMutableComponent(Position);
      position.x += acceleration * delta;
      position.y += acceleration * delta;
      position.z += acceleration * delta;
    });
  }
}

Please note that we are accessing components on an entity by calling:
- `getComponent(Component)`: If the component will be used as read-only.
- `getMutableComponent(Component)`: If we plan to modify the values on the component.

// Define a query of entities that have "Acceleration" and "Position" components
System.queries = {
  moving: {
    components: [Acceleration, Position]
  }
}
```

This system's query `moving` hold a list to the entities that has both `Acceleration` and `Position`, 10 in total in our example.

Please notice also that we could create an arbitrary number of queries if needed and process them in  `execute`, eg:
```javascript
class SystemDemo extends System {
  execute() {
    this.queries.boxes.forEach(entity => { /* do things */});
    this.queries.balls.forEach(entity => { /* do things */});
  }
}

SystemDemo.queries = {
  boxes: { components: [Box] },
  balls: { components: [Ball] },
};
```

Once we are done defining our systems it is time to register them in one world so they get initialized and added to the default scheduler to execute them on each frame.
```javascript
world
  .registerSystem(MovableSystem)
  .registerSystem(PositionLogSystem);
```

For more information this please check the architecture documentation: [Accessing and modifying components](/manual/Architecture?id=accessing-components-and-modify-components) and [Reactive Queries](/manual/Architecture?id=reactive-queries)


## Start!
Now you just need to invoke `world.execute()` per frame. Currently ECSY doesn't provide a default scheduler so you must do it yourself. eg:
```javascript
function  run() {
  // Compute delta and elapsed time
  var  time = performance.now();
  var  delta = time - lastTime;

  // Run all the systems
  world.execute(delta, time);

  lastTime = time;
  requestAnimationFrame(animate);
}

var  lastTime = performance.now();
run();
```

## Putting everything together
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

## What's next?
This was just a quick overview on how things are structured using ECSY, but we encourage you to [read the architecture documentation](/manual/Architecture) for more detailed information.