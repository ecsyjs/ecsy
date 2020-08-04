# ECSY Architecture

![ECSY architecture](https://ecsy.io/docs/manual/images/ECSY%20Architecture.svg)

## Overview
The following glossary is extracted from the [Getting started guide](/manual/Getting-started), it is recommended to read the whole section to get an overview on how the framework works.

Some common terms within ECS engines are:
- [entities](/manual/Architecture?id=entities): an object with an unique ID that can have multiple components attached to it.
- [components](/manual/Architecture?id=components): different facets of an entity. ex: geometry, physics, hit points.   Data is only stored in components.
- [systems](/manual/Architecture?id=systems): do the actual work with in an application by processing entities and modifying their components.
- [queries](/manual/Architecture?id=queries): used by systems to determine which entities they are interested in, based on the components the entities own.
- [world](/manual/Architecture?id=world): a container for entities, components, systems and queries.

The usual workflow when building an ECS based application is:
- Create the `components` that shape the data you need to use in your application.
- Create `entities` and attach `components` to them.
- Create the `systems` that will use these `components` to read and transform the data of these entities.
- Execute all the systems each frame.

## Example

Let's say we want to create a game where the player fights with wolves and dragons.
We will start by defining components that will be attached to entities:
- `Walker` and `Flyer` for entities that will walk and fly (resp.).
- `Enemy` for enemy entities.
- `Model3D` for all the entities that will have a 3d Model.

Then we use these components to define our main entities:
- `wolf`: It's an `Enemy`, can `walk` and has a `model3D`.
- `dragon`: It's an `Enemy`, can `fly` and has a `model3D`.
- `player`: It's an `Player`, can `walk` and has a `model3D`.

And finally we define the systems that will add the logic to the game:
- `Walk`: It will modify the `Walker` entities (`Player` and `Wolf`) moving them around.
- `Fly`: It will modify the `Flyer` entities (`Dragon`) moving them around in the sky.
- `AI_Walk`: It will modify the `Enemy` and `Walker` entities (`Wolf`) using AI techniques to compute the path they will follow.
- `Attack`: It will implement all the logic for attacks between `Enemy` and `Player` entities.
- `Draw`: It will draw all the entities that has `Model3D` component on the screen.

![Wolves and dragons example](https://ecsy.io/docs/manual/images/dragons.svg)

## World
By default your application should have at least one `world`. A world is basically a container for `entities`, `components` and `systems`.  Even so, you can have multiple worlds running at the same time and enable or disable them as you need.
[API Reference](/api/classes/world).

```javascript
world = new World();
```

The `World` constructor accepts an option object with the following parameters:
- ***entityClass***: Provide the base class for entities that implements or extends `Entity`.
- ***entityPoolSize***: Define the initial entity pool size for entities. It can help to avoid GC during execution if the application expands the pool dynamically at execution time.

```javascript
// We know we will initially have around 10k enemies in our game so let's allocate 10k enemies initially and expand the pool as needed.
world = new World({ entityPoolSize: 10000 });
```

## Components
A `Component` ([API Reference](/api/classes/component)) is an object that can store data but should have not behaviour (As that should be handled by systems). There is not a mandatory way to define a component.

To create a component you must extend the `Component` class and define a schema:
```javascript
import { Component, Types } from 'ecsy';

class ComponentA extends Component {}

ComponentA.schema = {
  number: { type: Types.Number, default: 10 },
  string: { type: Types.String, default: "Hello" }
}
```

The schema is used to set the default values of a component. ECSY also uses it to implement the default `.copy()`, `.clone()`, and `.reset()` methods. Setting the initial values of a component, and resetting them via `.reset()` are necessary for pooling. When you define a schema, you get this for free! Schemas can also be used for tooling and serialization, something we plan on covering in the future.

Each property in a schema represents a property on the component:

```javascript
const component = new ComponentA();
console.log(component.number === 10); // true
```

The `type` field must be set for each property. Each type has a default value as well as `.copy()` and `.clone()` functions.

ECSY comes with a few primitive types:
- `Types.Number`: Defaults to `0`.
- `Types.Boolean`: Defaults to `false`.
- `Types.String`: Defaults to `""`.
- `Types.Ref`: Defaults to `undefined`. Copies by reference, not a deep clone.
- `Types.JSON`: Defaults to `null`. Copies/clones via `JSON.parse(JSON.stringify(src))`, this is somewhat expensive but sometimes useful.
- `Types.Array`: Defaults to `[]`. Copies/clones each item by value.

You can also define your own types with `createType()`[API Reference](/api#createType).

```javascript
import { createType, copyCopyable, cloneClonable } from "ecsy";

class Vector2 {
  constructor() {
    this.x = 0;
    this.y = 0;
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(source) {
    this.x = source.x;
    this.y = source.y;
    return this;
  }

  clone() {
    return new Vector2().set(this.x, this.y);
  }
}

export const Vector2Type = createType({
  name: "Vector2",
  default: new Vector2(),
  copy: copyCopyable,
  clone: cloneClonable
});
```

### Tag Components

Some components don't store data and are used just as tags. In these cases it is recommended to extend `TagComponent` ([API Reference](/api/classes/tagcomponent) so the engine could, eventually, optimize the usage of this component.

```javascript
class Enemy extends TagComponent {}

entity.addComponent(Enemy);
```

### Single value components

Components could be made of multiple attributes, but sometimes they just contain a single attribute.
In these cases using the attribute's name to match the component's name may seem handy:
```javascript
class Acceleration extends Component {}

Acceleration.schema = {
  acceleration: { type: Types.Number, default: 0.1 }
};
```

But when accessing the value it seems redundant to use two `acceleration` references:

```javascript
let acceleration = entity.getComponent(Acceleration).acceleration;
```

We suggest to use `value` as the attribute name for these components as:
```javascript
class Acceleration extends Component {}

Acceleration.schema = {
  value: { type: Types.Number, default: 0.1 }
};

let acceleration = entity.getComponent(Acceleration).value;
```

Eventually we could end up adding some syntactic sugar for these type of components returning directly the `value` attribute:
```javascript
let acceleration = entity.getComponentValue(Acceleration);
```

### Component pooling

Usually an ECSY application will involve adding and removing components in real time. Allocating resources in a performance sensitive application is considered a bad pattern because the garbage collector will get called often and may impact performance.
In order to minimize it, ECSY includes pooling for components.
This means that every time a component is added to an entity:
```javascript
entity.addComponent(ComponentA)
```
the engine will try to reuse a `ComponentA` instance, from the pool of components previously created, and it won't allocate a new one instead.
When releasing that component, by calling `entity.removeComponent(ComponentA)`, it will get returned to the pool, ready to be used by another entity.

ECSY should know how to reset a component to its original state, if your component has the proper schema defined, ECSY will do this for you.

#### Custom Components

Sometimes it's not possible to define a component with a schema. If you still want to get the benefits of object pooling or redefine how `.copy()` or `.clone()` work, you can override any or all of the methods on the `Component` class.

```javascript
class ColorArray extends Component {
  /**
   * The constructor should set the initial values for a component.
   * Override this method to set your own initial values.
   **/
  constructor(props) {
    // Pass false to disable using the schema for default values.
    super(false);

    // Set your own default values instead
    this.value = [];
  }

  /**
   * The copy method is used when copying properties from one component to another.
   * Copy is used when copying/cloning entities/components, it is not used in component pooling.
   * You can re-implement this method to increase performance or deal with complex data structures.
   **/
  copy(src) {
    this.value.length = src.value.length;

    for (let i = 0; i < src.value.length; i++) {
      const srcColor = src.value[i];
      const destColor = this.value[i];

      destColor.r = srcColor.r;
      destColor.g = srcColor.g;
      destColor.b = srcColor.b;
    }

    return this;
  }

  /**
   * Clone returns a new, identical instance of a component.
   * We don't need to override clone in this case. However, if you needed to pass an argument
   * to the constructor, you could override clone to do so.
   * 
   * clone() {
   *  return new this.constructor().copy(this);
   * }
   **/

  /**
   * The reset method is used to reset the component back to it's initial state.
   * It's used in component pools when a component is disposed. It can be called fairly often so it is a common method
   * to optimize when you are adding/removing a lot of this type of component. You'll want to avoid memory allocation
   * as much as possible in the reset method. Try to reuse existing data structures whenever possible.
   **/
  reset() {
    this.value.forEach(color => {
      color.r = 0;
      color.g = 0;
      color.b = 0;
    });
  }
}
```

In extreme cases, you may experience performance bottlenecks due to the default implementation of the `Component` class. If you experience this, you can override that specific component with your own faster implementation.

#### Disable Component Pooling

In other cases you may want to disable component pooling altogether. Some components can't be copied or cloned properly.

In this case you can disable component pooling when you first register a component:

```javascript
class AudioListener extends Component {
  constructor(props) {
    super(false);
    this.listener = props.listener;
  }

  clone() {
    throw new Error("unimplemented");
  }

  copy() {
    throw new Error("unimplemented");
  }

  reset() {
    throw new Error("unimplemented");
  }
}

// Pass false to registerComponent to disable component pooling
world.registerComponent(AudioListener, false);
```

#### Custom Component Pooling

Additionally, you can implement your own component pool or configure component pool settings by passing an instance of `ObjectPool` as the second argument to `registerComponent`

```javascript
import { ObjectPool } from 'ecsy';

// Register MyComponent with an ObjectPool that has 1000 initial instances of MyComponent
world.registerComponent(MyComponent, new ObjectPool(MyComponent, 1000));

// Use your own custom ObjectPool implementation
class MyObjectPool extends ObjectPool {
  acquire() {
    // Your implementation
  }

  release(item) {
    // Your implementation
  }

  expand(count) {
    // Your implementation
  }
}

world.registerComponent(MyComponent, new MyObjectPool(MyComponent, 1000));
```

### System State Components

System State Components (SSC) are components used by a system to hold internal resources for an entity. They are not removed when you delete the entity, you must explicitly remove them when you are done with them.
They can be used to detect when an entity has been added or removed from a query.

SSC can be defined by extending `SystemStateComponent` [API Reference](/api/classes/systemstatecomponent) instead of `Component`. Once the SSC is defined, it can be used as any other component.
```javascript
class StateComponentGeometry extends SystemStateComponent {}

StateComponentGeometry.schema = {
  meshReference: { type: Types.Ref }
};

class Geometry extends Component {}

Geometry.schema = {
  primitive: { type: Types.String, default: "box" }
};
```

In this example `StateComponentGeometry` is used to store the mesh resources created as defined in the `Geometry` component.
If any other system removes that entity, the `Geometry` component will get removed but the `StateComponentGeometry` will remain "alive" so this system can detect it and free the mesh resources:

```javascript
class GeometrySystem extends System {
  init() {
    return {
      queries: {
        added: { components: [Geometry, Not(StateComponentGeometry)] },
        remove: { components: [Not(Geometry), StateComponentGeometry] },
        normal: { components: [Geometry, StateComponentGeometry] },
      }
    };
  },
  execute() {
    added.forEach(entity => {
      var mesh = new Mesh(entity.getComponent(Geometry).primitive);
      entity.addComponent(StateComponentGeometry, {mesh: mesh});
    });

    remove.forEach(entity => {
      var component = entity.getComponent(StateComponentGeometry);
      // free resources for the mesh
      component.mesh.dispose();

      entity.removeComponent(StateComponentGeometry);
    });

    normal.forEach(entity => {
      // use entity and its components (Geometry and StateComponentGeometry) if needed
    });
  }
}

MySystem.queries = {
  added: { components: [Geometry, Not(StateComponentGeometry)] },
  remove: { components: [Not(Geometry), StateComponentGeometry] },
  normal: { components: [Geometry, StateComponentGeometry] },
};
```

## Entities
An entity is an object that has a unique ID. Its purpose is to group components together. [API Reference](/api/classes/entity).

![Entities](https://ecsy.io/docs/manual/images/entities.svg)

Entities should be created within a `World` context:

```javascript
let entity = world.createEntity();
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
Components can be accessed from an entity in two ways:
- `getComponent(Component)`: Get the component for read only operations.
- `getMutableComponent(Component)`: Get the component to modify its values.

If `development` mode is enabled it will throw an error if you try to modify a component accessed by `getComponent`, but that error will not be thrown on release mode because of performance reasons.

These two access modes help to implement `reactive queries`([more info](/manual/Architecture?id=reactive-queries)), which are basically lists of entities populated with components that have mutated somehow, without much overhead on the execution as we avoid using custom setters or proxies.
This means every time you request a mutable component, it will get marked as modified and systems listening for that will get notified accordingly.
It's important to notice that the component will get marked as modified even if you don't change any attribute on it, so try to use `getMutableComponent` only when you know you will actually modify the component and use `getComponent` otherwise.

Other positive side effects of these two modes are allowing automatic schedulers to analyze the code to parallelize it and making the code easily readable as we could understand how the system is acting on the components.

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
      let component = entity.getRemovedComponent(Box);
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

let entity = world.createEntity().addComponent(Box);
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

Systems are used to transform data stored on the components. Usually each system defines one or more queries of entities and iterates through these lists per frame. [API Reference](/api/classes/system)

![Wolves and dragons](https://ecsy.io/docs/manual/images/systems.svg)

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
  boxes: { components: [ Box ] },
  spheres: { components: [ Sphere ] }
};
```

If a `queries` attribute is defined, is it possible to access the entities matching these queries on the `execute` method:

```javascript
class SystemName extends System {
  execute(delta, time) {
    this.queries.boxes.results.forEach(entity => {
      let box = entity.getComponent(Box);
      // Do whatever you want with box
    });

    this.queries.Spheres.results.forEach(entity => {
      let sphere = entity.getComponent(Sphere);
      // Do whatever you want with Sphere
    });
  }
}
```

If there is a `reactive query` (A query that *listens* for entities added or removed to it or which components has changed, [more info](/manual/Architecture?id=reactive-queries)) on the list of queries defined by a system, this system is called `reactive system` as it will react to changes on the entities and its components.

If you plan to mutate the results of a query while you are iterating it (eg: adding or removing components that will not match the query structure anymore, or removing the entity itself) you should traverse the results in reverse order:
```javascript
let results = this.queries.queryA.results;
for (var i = 0; i < results.length; i++) {
  let entity = results[i];
  if (i === 1) {
    // This will cause the results list to be mutated, results.length will be decremented and you won't reach the end elements.
    entity.remove();
  }
}

// The correct way to do it
let results = this.queries.queryA.results;
for (var i = results.length - 1; i >= 0; i++) {
  let entity = results[i];
  if (i === 1) {
    // This will modify the length of the results but as we are moving backward it won't affect us
    entity.remove();
  }
}
```

### Registering a system

Systems should be registered in a world in order to initialize them and add them to the default scheduler that will execute them on each frame.
```javascript
world.registerSystem(SystemClass);
```

### Unregistering a system

Systems can be unregistered, and they will get removed from the execution queue and the world. So if you want to use them again you need to register them again.
If you just want to temporaly disable its execution, you must use `System.stop()/play()` instead.
```javascript
world.unregisterSystem(SystemClass);
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

You can also control the order of execution by adding a `priority: Number` attribute when registering them.
By default systems have `priority=0` and they are sorted in ascending order. The lower the number the earlier the system will be executed.

```javascript
world
  .registerSystem(SystemA)
  .registerSystem(SystemB, { priority: 2 })
  .registerSystem(SystemC, { priority: -1 })
  .registerSystem(SystemD)
  .registerSystem(SystemE);
```

This will result in the execution order: `SystemC > SystemA > SystemD > SystemE > SystemB`.

## Queries

A query is a collection of entities that match some conditions based on the components they own.
The most common use case for queries is to define them in systems. This is also the recommended way as the engine could use that information to organize and optimize the execution of the systems and queries. Also if several queries are created with the same components, the `QueryManager` will just create a single query under the hood and reference it everywhere saving memory and computation.

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

For example, defining a query containing all the entities that have both the components `Position` and `Velocity`:
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

This operator could be very useful as a factory pattern ([example](https://fernandojsg.github.io/ecsy/examples/factory/index.html)):
```javascript
SystemTest.queries = {
  playerUninitialized: {
    components: [ Player, Not(Name) ]
  }
};
```
The `playerUnitialized` query will have all the players that don't have a `Name` component yet, a system could get this list and add a random name to them:
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

To avoid callbacks and asynchrony, which is a bad thing for cache and predictability reasons, entities are queued on the `added` and `removed` lists but the system owning these lists will be able to process them just whenever the `execute` method will get called.
So every time you call `execute` you will have the list of all the entities added or removed since the last call. After the call has been executed these lists will be cleared.

#### Changed
Sometimes is interesting to detect that an entity or a specific component has changed. This means that any of the components from the entity that are part of the query have changed.
Detecting these changes is tricky to do performantly. That is why we rely on the `entity.getMutableComponent` function that marks the component as modified.
The syntax to detect if an entity has changed, is similar to the ones for `added` or `removed`:

```javascript
SystemTest.queries = {
  boxes: {
    components: [ Box, Transform ],
    listen: {
      added: true,
      removed: true,
      changed: true  // Detect that any of the components on the query (Box, Transform) has changed
    }
  }
};
```

Similar to the previous example, we now can iterate on the `changed` list of entities:
```javascript
class SystemTest extends System {
  execute() {
    let boxesQuery = this.queries.boxes;

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

Defining `changed: true` will populate the list if **any** of the components in the query have been modified. If you are just interested just in some specific components instead, you can define an array of components instead of the boolean value:
```javascript
SystemTest.queries = {
  boxes: {
    components: [ Box, Transform ],
    listen: {
      added: true,
      removed: true,
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

It is possible to override that behaviour and remove the component and entity immediately by passing `true` as an additional parameter to both functions. However this is not recommended behaviour as it could lead to side effects, so it should be used with caution:
```javascript
// Remove component immediately
entity.removeComponent(Player, true);

// Remove entity immediately
entity.remove(true);
```

When a component or an entity is removed, one `to be removed` flag is activated and the `reactive queries` ([more info](/manual/Architecture?id=reactive-queries)) listening for `removed` events will get populated by them.
```javascript
// Component to identify a wolf
class Wolf extends TagComponent {}

// Component to store how long the wolf is sleeping 
class Sleeping extends Component {}

Sleeping.schema = {
  startSleepingTime: { type: Types.Number }
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
        let sleeping = wolf.getRemovedComponent(Sleeping);
        let duration = elapsedTime - sleeping.startSleepingTime;
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
Please notice that if immediate removal was used, instead of the default deferred method, the component will not be accessible to any systems after it.

This flow is exactly the same when removing entities instead of components. The entities and its components will still be available on the rest of the systems reacting to these deletions.

### Clearing removal queues

When using deferred removal the entities and components are deallocated at the end of the frame.
After all the systems' `execute` method have been called, the components and entities are truly removed and returned to their pools.
Is important to notice that if an application has a running order as: `SystemA > SystemB > SystemC` and `SystemA` removes an entity, `SystemB` and `SystemC` will be able to read it and its components.
But if `SystemB` does the same, just `SystemC` will be able to react to it, as the entity and components data will get cleared at the end of the frame, so `SystemA` will not be able to read that data.
Because of that is important that you define an appropriate execution order based on the needs for your reactive systems.

There is one special use case when removing components and entities. When using `System State Components` they should be removed explicitly and they will not get removed if `entity.remove` is being called. [More info](/manual/Architecture?id=system-state-components)

## Extending core functionality

It is possible to provide a custom `Entity` class to modify the default behaviour.
To do so you need to import `_Entity` from `ecsy` and extend it in your class definition:
```javascript
import { _Entity, World } from "entity";

class MyEntity extends _Entity {
  customMethod() {}
}

// Use the new entity class
let world = new World({ entityClass: MyEntity });
let entity = world.createEntity();

// Call our custom method on our entity class
entity.customMethod();
```
You can see an example of this extensibility in `ecsy-three`. In `ecsy-three` we extend both the entity class: https://github.com/MozillaReality/ecsy-three/blob/dev/src/core/entity.js and also the world class: https://github.com/MozillaReality/ecsy-three/blob/dev/src/core/world.js

## Developing

### Debug mode
ECSY will output some debug messages when in development mode. Development mode is active depending on the environment you are running ECSY in.

In CommonJS environments it is controlled by the value of the `NODE_ENV` environment variable. This means Webpack and similar tools can change the value for development and production builds. This ensures you get helpful messages during development and a smaller bundle size in production.

When using the UMD or ES Module builds then the unminified builds will have development mode on and the minified builds will have it turned off.

### Benchmarks

ECSY includes benchmarks (https://github.com/MozillaReality/ecsy/tree/dev/benchmarks) to test the performance and detect regressions.
To run the benchmarks locally you need to execute `npm run benchmarks`:
It will dump a JSON with the results of all the benchmarks and it will write a `benchmark_result.json` file.

You can use that file to compare against other executions by using `benchmarker` (`https://github.com/fernandojsg/benchmarker`):
```
# Install benchmarker globally
> npm install -g benchmarker-js

> benchmarker compare results1.json results2.json
```
It will dump a table with a summary comparing all the executions. This can be useful when doing big refactors to compare across different branches to make sure that there is not regression in performance.
