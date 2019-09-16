# Getting started

## ECS principles
First of all, let's define the common terminology used in ECS:
- `entity`: An entity is an object that has an unique ID which purpose is to group components together.
- `component`: Is an object that just store data.
- `system`: Systems are stateless classes, than can define `queries` Stateless processors of list of entities that match specific condition.

## Creating a world
By default your application should have at least one `world`. A world is basically a container for `entities`, `components` and `systems`.  Even so, you can have multiple worlds running at the same time and enable or disable them as you need.

Let's start creating our first world:
```javascript
world = new World();
```

## Creating components
By definition components are just objects that hold data. So we can use any way to define them, for example ES6 syntax (recommended):
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

More on how to create components LINK

## Creating entities
Having our world and some components already defined lets us create entities and attach theses components to them:
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
Now we are going to define a system to process the components we just created.
A system should extend the `System` interface and could implement the following methods:
- `init`: This will get called when the system is registered on a world.
- `execute(delta, time)`: This is called on every frame (By default, but we could modify this eventually when using custom schedulers).

We could also define the queries of entities in which we are interested in processing. The `queries` attribute should be a static attribute of your system.

Let's first create a system that will just loop through all the entities that has a `Position` component (11 in our example) and log theirs position.
```javascript
class PositionLogSystem extends System {
	init() { /* Do whatever you need here */ }
	// This method will get called on every frame by default
	execute(delta, time) {
		// Iterate through all the entities on the query
		this.queries.position.forEach(entity => {
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
```

We should register each system we want to use in one world so it get initialised and added to the default scheduler.
```javascript
world.registerSystem(MovableSystem);
```

Please note that we are accessing components on an entity by calling:
- `getComponent(Component)`: If the component will be used as read-only.
- `getMutableComponent(Component)`: If we plan to modify the values on the components.

These two access mode could help us:
- Implement `reactive systems` without much overhead on the execution.
- Help automatic schedulers to analyze the code to paralellize it.
- Make the code easily readable as we could understand how the system is acting on the components.

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

// Components
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
This was just a quick overview on how things are structured using ECSY, but we encourage you to read the extended explainers for each feature ECSY provides:

- **TODO**