# ECSY Architecture

![ECSY architecture](http://ecsy.io/docs/manual/images/ECSY%20Architecture.svg)

## Overview
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

![Wolves and dragons example](http://ecsy.io/docs/manual/images/dragons.svg)

## World
By default your application should have at least one `world`. A world is basically a container for `entities`, `components` and `systems`.  Even so, you can have multiple worlds running at the same time and enable or disable them as you need.
[API Reference](/api/classes/world).

```javascript
world = new World();
```

## Components
A `Component` ([API Reference](/api/classes/component)) is an object that can store data but should have not behaviour (As that should be handled on systems). There is not a mandatory way to define a component.
It could just be a function:
```javascript
function ComponentA() {
  this.number = 10;
  this.string = "Hello";
}
```

The recommended way is using ES6 classes and extending the `Component` class:
```javascript
import { Component } from 'ecsy';

class ComponentA extends Component {
  constructor() {
    super();
    this.number = 10;
    this.string = "Hello";
  }
}
```

It is also recommended to implement the following functions on every component class:
- `copy(src)`: Copy the values from the `src` component.
- `reset()`: Reset the component's attributes to their default values.

### Tag Components

Some components don't store data and are used just as tags. In these cases it is recommended to extends `TagComponent` ([API Reference](/api/classes/tagcomponent) so the engine could, eventually, optimize the usage of this component.

```javascript
class Enemy extends TagComponent {}

entity.addComponent(Enemy);
```

### Single value components

Components could be made of multiple attributes, but sometimes they just contain a single attribute.
It these cases using the attribute's name to match the component's name may seem handy:
```javascript
class Acceleration {
  constructor() {
    this.acceleration = 0.1;
  }
}
```

But when accesing the value it seems reduntant to use two `acceleration` references:

```javascript
var acceleration = entity.getComponent(Acceleration).acceleration;
```

We suggest to use `value` as the attribute name for these components as:
```javascript
class Acceleration {
  constructor() {
    this.value = 0.1;
  }
}

var acceleration = entity.getComponent(Acceleration).value;
```

Eventually we could end up adding some syntactic sugar for these type of components returning directly the `value` attribute:
```javascript
var acceleration = entity.getComponentValue(Acceleration);
```

### Components pooling

Usually an ECSY application will involve adding and removing components in real time. Allocating resources in a performance sensitive application is considered a bad pattern as the garbage collector will get called often and it will impact the performance.
In order to minimize it, ECSY includes pooling for components.
This means that everytime a component is added to an entity as:
```javascript
entity.addComponent(ComponentA)
```
the engine will try to reuse a `ComponentA` instance, from the pool of components previously created, and it won't allocate a new one instead.
When releasing that component, by calling `entity.removeComponent(ComponentA)`, it will get returned to the pool, ready to be used by other entity.

ECSY should know how to reset a component to its original state, that's why it's highly recommended that components implements a `reset` method to get the benefits from pooling.

```javascript
// Example of components with `reset` methods implemented

class List extends Component {
  constructor() {
    this.value = [];
  }

  reset() {
    this.value.length = 0;
  }
}

class Position extends Component {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }
}
```

It is possible to use the helper function `createComponentClass` to ease the creation of components as it will implement the `reset` and `copy` functions automatically.

### System State Components

System State Components (SSC) are components used by a system to hold internal resources for an entity, they are not removed when you delete the entity, you must remove them from once you are done with them.
It can be used to detect whenever an entity has been added or removed from a query.

SSC can be defined by extending `SystemStateComponent` [API Reference](/api/classes/systemstatecomponent) instead of `Component`:
```javascript
class StateComponentA extends SystemStateComponent {
  constructor() {
    super();
    this.value = 10;
  }
}
```

Once the SSC is defined, it can be used as any other component:

```javascript
class MySystem extends System {
  init() {
    return {
      queries: {
        added: { components: [ComponentA, Not(StateComponentA)] },
        remove: { components: [Not(ComponentA), StateComponentA] },
        normal: { components: [ComponentA, StateComponentA] },
      }
    };
  },
  execute() {
    added.forEach(entity => {
      entity.addComponent(StateComponentA, {data});
    });

    remove.forEach(entity => {
      var component = entity.getComponent(StateComponentA);
      // free resources for `component`
      entity.removeComponent(StateComponentA);
    });

    normal.forEach(entity => {
      // use entity and its components
    });
  }
}

MySystem.queries = {
  added: { components: [ComponentA, Not(StateComponentA)] },
  remove: { components: [Not(ComponentA), StateComponentA] },
  normal: { components: [ComponentA, StateComponentA] },
};
```

## Create component helper
Creating a component and implementing its `reset` function can be a repetitive task specially when we are working with simple data types.
At the same time it could lead to side effects errors, specially when pooling components, if there is some bug on one of the components' `reset` function for example.
In order to ease this task, it is possible to use a helper function called `createComponentClass(schema, className)` which takes a JSON schema with the definition of the component and generate the class accordanly, implementing the `reset`, `copy` and `clear` functions.

The JSON defines the number of the attributes of the components, its default value and type.

```javascript
var ExampleComponent = createComponentClass({
  number: { default: 0.5 },
  string: { default: "foo" },
  bool: { default: true },
  array: { default: [1, 2, 3] }
  vector3: { default: new Vector3(4, 5, 6), type: CustomTypes.Vector3 }
}, "ExampleComponent");
```

Basic types (number, boolean, string and arrays) are infered by the default value. It is possible to use custom type defined by `createType` (explained in the next section).
The second parameter for `createComponentClass` is the class name for the component and even so is not mandatory is strongly recommended as it will ease the debug and trace.

The previous example will create a `ExampleComponent` component that could be already used to add to entities as if it were created manually:
```javascript
entity.addComponent(ExampleComponent);
```

In fact the equivalent of that code could be something like:
```javascript
class ExampleComponent extends Component {
  constructor() {
    super();
    this.reset();
  }

  clear() {
    this.number = 0;
    this.string = "";
    this.bool = false;
    this.array.length = 0;
    this.vector3.set(0, 0, 0);
  }

  copy(src) {
    this.number = src.number;
    this.string = src.string;
    this.bool = src.bool;
    this.array = src.array.splice();;
    this.vector3.copy(src.vector3);
  }

  reset() {
    this.number = 0.5;
    this.string = "foo";
    this.bool = true;
    this.array = [1, 2, 3];
    this.vector3 = new Vector3(4, 5, 6);
  }
}
```

Even using such a simple example, without complex data types, is easy to understand that implementing all the functions `clear`, `copy` and `reset` could lead to small bugs that could have unexpected side effects that should not be present when using the `createComponentClass`.

It is important to notice that when defining an schema every attribute must have a known type, if no data type is provided for complex types, `createComponentClass` will not implement `clear`, `copy` and `reset` and it will just return the component class with the attributes defined.

### Data types

It is possible to use custom types, to be used in the schema definition when calling `createComponentClass`, by defining them with `createType`:

```javascript
createType({
  baseType: T,
  create: defaultValue => {},
  reset (src, key, defaultValue) => {},
  clear: (src, key) => {};
})
```

Where:
- `create(defaultValue)`: Return a value of type `baseType` using a default value.
- `reset(src, key, defaultValue)`: Reset the `key` attribute on the object `src` with the default value.
- `clear(src, key)`: Clear the `key` attribute on the object `src`.
- `copy(src, dst, key)`: Copy the `key` attribute from the object `src` to the object `src`.

Type definition for basic standard types are [already defined](https://github.com/MozillaReality/ecsy/blob/dev/src/StandardTypes.js) in the library: `number`, `boolean`, `string` and `array`.

The following code implements a custom type for a `Vector3` imported from an external library:

```javascript
  var CustomVector3 = createType({
    baseType: Vector3,
    create: defaultValue => {
      var v = new Vector3(0, 0, 0);
      if (typeof defaultValue !== "undefined") {
        v.copy(defaultValue);
      }
      return v;
    },
    reset: (src, key, defaultValue) => {
      if (typeof defaultValue !== "undefined") {
        src[key].copy(defaultValue);
      } else {
        src[key].set(0, 0, 0);
      }
    },
    clear: (src, key) => {
      src[key].set(0, 0, 0);
    }
  });
```

As the type for `Vector3` has been already defined, it is possible to use it to define a component:
```javascript
var ExampleComponent = createComponentClass({
  vector3: { default: new Vector3(4, 5, 6), type: CustomVector3 }
}, "ExampleComponent");
```

## Entities
An entity is an object that has an unique ID which purpose is to group components together. [API Reference](/api/classes/entity).

![Entities](http://ecsy.io/docs/manual/images/entities.svg)

Entities should be created within a `World` context:

```javascript
var entity = world.createEntity();
```

### Adding components
Once an entity is created, it is possible to add [components](/manual/Architecture?id=components) to it:
```javascript
class ComponentA {
  constructor() {
    this.number = 10;
    this.string = "Hello";
  }
}

// Add the component with the default values
entity.addComponent(ComponentA);

// Add the component replacing the default values
entity.addComponent(ComponentA, {number: 20, string: "Hi"});
```

### Accessing components and modify components
Component can be accessed from an entity in two ways:
- `getComponent(Component`: Get the component for read only operations.
- `getMutableComponent(Component)`: Get the components to modify its values.

If `DEBUG` mode is enabled it will throw an error if you try to modify a component accessed by `getComponent`, but that error will not be thrown on release mode because of performance reasons.

These two access modes help to implement `reactive queries`([more info](/manual/Architecture?id=reactive-queries)), which are basically lists of entities populated with components that has mutated somehow, without much overhead on the execution as we avoid using custom setters or proxies.
This means everytime you request a mutable component, it will get marked as modified and systems listening for that will get notified accordanly.
It's important to notice that the component will get marked as modified even if you don't change any attribute on it, so try to use `getMutableComponent` only when you know you will actually modify the component and use `getComponent` otherwise.

Other positive side effects of these two modes are allowing automatic schedulers to analyze the code to paralellize it and making the code easily readable as we could understand how the system is acting on the components.

### Removing components
Another common operation on entities is to remove components:

```javascript
entity.removeComponent(ComponentA);
```

This will mark the component to be removed and will populate all the queues from the systems that are listening to that event, but the component itself won't be disposed until the end of the frame, we call it `deferred removal`.
This is done so systems that need to react to it can still access the data of the components.

Once a component is removed from an entity, it is possible to access its contents, by calling `getRemovedComponent(Component)`:

```javascript
class SystemFoo extends System {
  execute() {
    this.queries.boxes.removed.forEach(entity => {
      var component = entity.getRemovedComponent(Box);
      console.log('Component removed:', component, 'on entity: ', entity.id);
    });

    this.queries.boxes.results.forEach(entity => {
      console.log('Iterating on entity: ', entity.id);
    });
  }
}

SystemFoo.queries = {
  boxes: {
    components: [ Box ],
    removed: true // To listen for removed entities from the query
  }
}

var entity = world.createEntity().addComponent(Box);
world.execute(); // Execute frame 1
entity.removeComponent(Box);
world.execute(); // Execute frame 2
```

This example will output:

```
Frame 1:
  - Iterating on entity: 1
Frame 2:
  - Component removed: box on entity: 1
```

Any further `execute()` will not log anything, since none of the queries are satisfied after the component `Box` was removed from the entity.

Even if the deferred removal is the default behaviour, it is possible to remove a component immediately if needed, by passing a second parameter to `removeComponent(Component, forceImmediate)`.
Although this is not the recommended behaviour because it could lead to side effect if other systems need to access the removed component:
```javascript
// The component will get removed immediately
entity.removeComponent(ComponentA, true);
```

## Systems

Systems are used to transform data stored on the components. Usually each system defines one or more queries of entities and it iterate through these lists per frame. [API Reference](/api/classes/system)

![Wolves and dragons](http://ecsy.io/docs/manual/images/systems.svg)

Every frame systems are executed and they create, remove or modify entities and components.

The system interface is as follows:

```javascript
class SystemName extends System {
  init() {}
  execute(delta, time) {}
}
```

A system should always extends from the `System` class and it can implement two functions:
- `init()`: This function is called when the system is registered in a world (Calling `world.registerSystem`) and can be used to initialize anything the system needs.
- `execute(deltaTime, elapsedTime)`: It will get called each frame by default (unless a custom scheduler is being used). Usually it will be used to loop through the lists of entities from each query and process the value of theirs components.

Systems could define one or more [queries](/manual/Architecture?id=queries) by setting the static `queries` attribute:

```javascript
SystemName.queries = {
  boxes: { components: [ Box ] }
  spheres: { components: [ Sphere ] }
};
```

If a `queries` attribute is defined, is it possible to access the entities matching these queries on the `execute` method:

```javascript
class SystemName extends System {
  execute(delta, time) {
    this.queries.boxes.results.forEach(entity => {
      var box = entity.getComponent(Box);
      // Do whatever you want with box
    });

    this.queries.Spheres.results.forEach(entity => {
      var sphere = entity.getComponent(Sphere);
      // Do whatever you want with Sphere
    });
  }
}
```

If there is a `reactive query` (A query that *listen* for entities added or removed to it or which components has changed, [more info](/manual/Architecture?id=reactive-queries)) on the list of queries defined by a system, this system is called `reactive system` as it will react to changes on the entities and its components.

### Registering a system

Systems should be registered in a world in order to initialize them and add them to the default scheduler that will execute them on each frame.
```javascript
world.registerSystem(SystemName);
```

### Execution order
By default systems are executed on the same order they are registered in the world:
```javascript
world
  .registerSystem(SystemA)
  .registerSystem(SystemB)
  .registerSystem(SystemC);
```
This will execute `SystemA > SystemB > SystemC`.

It is also possible to define the priority on which the systems will get executed by adding a `priority: Number` attribute when registering them.
By default systems have `priority=0` and they are sorted ascendingly, it means the lower the number the earlier the system will be executed.

```javascript
world
  .registerSystem(SystemA)
  .registerSystem(SystemB, { priority: 2 })
  .registerSystem(SystemC, { priority: -1 })
  .registerSystem(SystemD)
  .registerSystem(SystemE);
```

This will results on an execution order as: `SystemC > SystemA > SystemD > SystemE > SystemB`.

## Queries

A query is a collection of entities that match some conditions based on the components they own.
The most common use case for queries is to define them in systems. This is also the recommended way as the engine could use that information to organize and optimize the execution of the systems and queries. Also if several queries are created with the same components, the `QueryManager` will just create a single query under the hood and referece it everywhere saving memory and computation.

A query is always updated with the entities that match the components' condition. Once the query is initialized it traverses the components groups to determine which entities should be added to it. But after that, entities will get added or removed from the query as components are being added or removed from them.

### Query syntax

The only mandatory field in a query is `components` attribute which defines the list of components that an entity must have to be included in this query.

```json
{
  QueryName: {
    components: ArrayOfComponents,
    listen: {
      added: Boolean,
      removed: Boolean,
      changed: Boolean | ArrayOfComponents
    }
  }
}
```

For example, defining a query containing all the entities that has the component `Position` and `Velocity`:
```javascript
var query = {
  positions: {
    components: [ Position, Velocity ]
  }
};
```

### Not operator

It is also possible to include a `Not` operator when defining a query:
```javascript
SystemTest.queries = {
  activeEnemies: {
    components: [ Enemy, Not(Dead) ]
  }
};
```
This will return all the entities that **have** a `Enemy` component but **do have not** the `Dead` component.

This operator could be very useful as a factory pattern ([ex`am`ple](https://fernandojsg.github.io/ecsy/examples/factory/index.html)):
```javascript
SystemTest.queries = {
  playerUninitialized: {
    components: [ Player, Not(Name) ]
  }
};
```
The `playerUnitialized` query will have all the players that don't have a `Name` component yet, a system could get that list and add a random name to them:
```javascript
queries.playerUnitialized.results.forEach(entity => {
  entity.addComponent(Name, {value: getRandomName()});
});
```
And as soon as the component `Name` is added to the player entity, that entity will disappear from the query.

### Reactive queries

Using reactive queries make it possible to react to changes on entities and its components.

#### Added and removed
One common use case is to detect whenever an entity has been added or removed from a query. This can be done by just setting `added` and `removed` attributes to `true` on the query:

```javascript
SystemTest.queries = {
  boxes: {
    components: [ Box, Transform ],
    listen: {
      added: true,
      removed: true
    }
  }
};
```

With that definition it will be possible to iterate through them on the `execute` function:
```javascript
class SystemTest extends System {
  execute() {
    var boxesQuery = this.queries.boxes;

    // All the entities with `Box` and `Transform` components
    boxesQuery.results.forEach(entity => {});

    // All the entities added to the query since the last call
    boxesQuery.added.forEach(entity => {});

    // All the entities removed from the query since the last call
    boxesQuery.removed.forEach(entity => {});
  }
}
```

To avoid callbacks and asynchrony, which is a bad thing for cache and predictability on the execution, entities are queued on the `added` and `removed` lists but the system owning these lists will be able to process them just whenever the `execute` method will get called.
So everytime you call `execute` you will have the list of all the entities added or removed since the last call. After the call has been executed these lists will get cleared.

#### Changed
Sometimes is also interesting to detect that an entity or a specific component has changed, , this means that any of the components from the entity that are part of the query have changed.
Detecting these changes trickier to do it performantly, that is why we rely on the `entity.getMutableComponent` function that basically marks the component as modified.
The syntax to detect if an entity has changed, is similar to the ones for `added` or `removed`:

```javascript
SystemTest.queries = {
  boxes: {
    components: [ Box, Transform ],
    listen: {
      added: true,
      removed: true
      changed: true  // Detect that any of the components on the query (Box, Transform) has changed
    }
  }
};
```

Similar to the previous example, we now can iterate on the `changed` list of entities:
```javascript
class SystemTest extends System {
  execute() {
    var boxesQuery = this.queries.boxes;

    // All the entities with `Box` component
    boxesQuery.results.forEach(entity => {});

    // All the entities added to the query since the last call
    boxesQuery.added.forEach(entity => {});

    // All the entities removed from the query since the last call
    boxesQuery.removed.forEach(entity => {});

    // All the entities which Box or Transform components have changed since the last call
    boxesQuery.changed.forEach(entity => {});
  }
}
```

Defining `changed: true` will populate the list if **any** of the components on the query has been modified. If you are just interested just in some specific components instead, you can define an array of components instead of the boolean value:
```javascript
SystemTest.queries = {
  boxes: {
    components: [ Box, Transform ],
    listen: {
      added: true,
      removed: true
      changed: [ Box ]  // Detect that the Box component has changed
    }
  }
};

// ...
  boxesQuery.changed.forEach(entity => {}); // Box component has changed
// ...
```

## Entities and components life cycle

By default ECSY uses deferred removal when removing an entity or a component:
```javascript
// Deferred remove component
entity.removeComponent(Player);

// Deferred remove entity
entity.remove();
```

It is possible to override that behaviour and remove the component and entity immediately by passing `true` as aditional parameter to both functions. Although this is not the recommended behaviour as it could lead to side effects, so it should be used with caution:
```javascript
// Remove component inmediately
entity.removeComponent(Player, true);

// Remove entity inmediately
entity.remove(true);
```

When a component or an entity is removed, one `to be removed` flag is activated and the `reactive queries` ([more info](/manual/Architecture?id=reactive-queries)) listening for `removed` events will get populated by them.
```javascript
// Component to identify a wolf
class Wolf extends TagComponent {}

// Component to store how long is sleeping the wolf
class Sleeping extends Component {
  constructor() {
    super();
    this.startSleepingTime = 0;
  }
}

// This system will wake up sleeping wolves randomly
class SystemAwakeWolves extends System {
  execute() {
    this.queries.sleepingWolves.results.forEach(wolf => {
      if (Math.random() > 0.5) {
        wolf.removeComponent(Sleeping);
      }
    });
  }
}
SystemAwakeWolves.queries = {
  sleepingWolves: { components: [ Wolf, Sleeping ]}
};

// This system will implements wolf reactions after just being awake
class SystemWolfReactions extends System {
  execute(delta, elapsedTime) {
    this.queries.sleepingWolves.removed.forEach(wolf => {
      // We have to check if the "Sleeping" component has been removed
      // because if the "Wolf" component is removed instead, it will trigger
      // also ths "removed" event as is not fulfilling the query anymore either
      if (wolf.hasRemovedComponent(Sleeping)) {
        var sleeping = wolf.getRemovedComponent(Sleeping);
        var duration = elapsedTime - sleeping.startSleepingTime;
        // Do whatever with the `duration` value
        // eg: Make the wolf move slower if its was sleeping for so long
      }
    });
  }
}
SystemWolfReactions.queries = {
  sleepingWolves: {
    components: [ Wolf, Sleeping ],
    listen: {
      removed: true
    }
  }
};
```

In the previous example, the `SystemAwakeWolves` randomly wakes up wolves by removing the `Sleeping` component from them. The entities representing these wolves will get removed from its `sleepingWolves` query.
As the `SystemWolfReactions` has the same query as the `SystemAwakeWolves`, the entity will also get removed from its query. Because the query is also [reactive](/manual/Architecture?id=reactive-queries) (`removed: true`), the `sleepingWolves.removed` will get populated with the wolves that were awake in the previous system.
When iterating these removed entities, it is possible to access the removed `Sleeping` component by using `getRemovedComponent`.
Please notice that if immediate removal were used, instead of the default deferred method, the component will not be accessible to any systems after it.

This flow is exactly the same when removing entities instead of components. The entities and its components will still be available on the rest of the systems reacting to these deletions.

### Clearing removal queues

When using deferred removal, it is needed to deallocate the entities and components at some point, and this is happening at the end of the frame.
After all the systems' execute method are being called, the components and entities are truly removed and returned to their pools.
Is important to notice that if an applicatio has a running order as: `SystemA > SystemB > SystemC` and `SystemA` removes an entity, `SystemB` and `SystemC` will be able to read it and its components.
But if `SystemB` does the same, just `SystemC` will be able to react to it, as the entity and components data will get cleared at the end of the frame, so `SystemA` will not be able to read that data.
Because of that is important that you define an appropiate execution order based on the needs for your reactive systems.

There is one special use case when removing components and entities and is when using `System State Components` as they should be removed explicitly and they will not get removed if `entity.remove` is being called. [More info](/manual/Architecture?id=system-state-components)
