# ECSY Architecture

## World
By default your application should have at least one `world`. A world is basically a container for `entities`, `components` and `systems`.  Even so, you can have multiple worlds running at the same time and enable or disable them as you need.

```javascript
world = new World();
```

## Entities
An entity is an object that has an unique ID which purpose is to group components together.

Entities are always created within a `World` context:

```javascript
var entity = world.createEntity();
```

### Adding components
Once you have created an entity you can add components to it:
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

### Accessing components and mutability
You can access a component from an entity with two modes:
- `getComponent(Component`: Get the component for read only operations.
- `getMutableComponent(Component)`: Get the components to modify its values.

> Please notice that if you are in ()[debug mode] it will throw an error if you try to modify a component accessed by `getComponent` but that error won't be available on release mode because of performance reasons.

These two access mode help us to implement `reactive systems`(**LINK**) without much overhead on the execution (We avoid using custom setters or proxies). This means everytime you request a mutable component, it will get marked as modified and systems listening for that will get notified accordanly.
> It's important to notice that the component will get marked as modified even if you don't change any attribute on it, so try to use `getMutableComponent` only when you know you will actually modify the component and use `getComponent` otherwise.

Side effects of these two modes are allowing automatic schedulers to analyze the code to paralellize it and making the code easily readable as we could understand how the system is acting on the components.

### Removing components
Another common operation on entities is to remove components:

```javascript
entity.removeComponent(ComponentA);
```

This will mark the component to be removed and will populate all the queues from the systems that are listening to that event, but the component itself won't be disposed until the end of the frame.
This is done so systems that need to react to it can still access the data of the components.

Once a component is removed from an entity using the default deferred mode, you can still access its contents, before the end of the frame, by calling `getRemovedComponent(Component)`:

```javascript
class SystemFoo extends System {
  execute() {
    this.queries.boxes.removed.forEach(entity => {
      var component = entity.getRemovedComponent(Box);
      console.log('Component removed:', component, 'on entity: ', entity.id);
    });

    this.queries.boxes.entities.forEach(entity => {
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
world.execute();
entity.removeComponent(Box);
world.execute();
```

This example will output:

```
- Iterating on entity: 1
- Component removed: box on entity: 1
```

And it will stop the execution there as the query won't get satisfied after the `Box` component is removed from the entity.

**MORE ON THIS ON LIFECYCLE**

You can still remove the component immediately if needed by passing a second parameter to `removeComponent(Component, forceImmediate)`, although is not the recommended behaviour because it could lead to side effect if other systems need to access the removed component:
```javascript
// The component will get removed immediately
entity.removeComponent(Component, A);
```

## Components
A `Component` is an object that can store data but should have not behaviour. There is not a mandatory way to define a component.
It could just be a function:
```javascript
function ComponentA() {
  this.number = 10;
  this.string = "Hello";
}
```

But the recommended way is using ES6 classes:
```javascript
class ComponentA {
  constructor() {
    this.number = 10;
    this.string = "Hello";
  }
}
```

Currently the `Component` class exporter by ECSY is a dummy class but eventually in the future we could use it for other purposes so we recommend extending the components from it:
```javascript
import { Component } from 'ecsy';

class ComponentA extends Component {
  constructor() {
    this.number = 10;
    this.string = "Hello";
  }
}
```

### clear

### copy

### Components pooling
Usually an ECSY application will involve adding and removing components in real time. Allocating resources in a performance sensitive application is considered a bad pattern as the garbage collector will get called often and it will hit the performance.
In order to minimize it ECSY includes automatic pooling for components.
This means that if we add component to an entity as:
```javascript
entity.addComponent(ComponentA)
```
the engine will try to reuse a `ComponentA` instance from a pool of components previously created, and it won't allocate a new one instead. Once we are done with that component and do `entity.removeComponent(ComponentA)`, it will get returned to the pool, ready to be used by other entity.

ECSY should know how to reset a component to its original state, that's why it's mandatory that components implements a `reset` method to get the benefits from pooling, otherwise you will get a warning message about it.

```javascript
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

Please notice that creating a component using the `createComponentClass` helper (**Link**) will include a `reset` implementation.

## Create component helper
Creating a component and implementing its `reset` function can be a repetitive task specially when we are working with simple data types.
At the same time it could lead to side effects errors, specially when pooling components, if there is some bug on one of the components' `reset` function for example.
In order to ease this task, it is possible to use a helper function called `createComponentClass(schema, className)` which takes a JSON schema with the definition of the component and generate the class accordanly, implementing the `reset`, `copy` and `clear` functions.



## Data types

### Tag Components

Some components don't store data and are used to tag some entities. It's recommended to extends `TagComponent` on these cases so the engine could, eventually, optimize the usage of this component.

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

### System State Components

System State Components are components used by a system to hold internal resources for an entity, they are not removed when you delete the entity, you must remove them from once you are done with them.
It can be used to detect whenever an entity has been added or removed from a query.

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
      entity.addStateComponent(StateComponentA, {data});
    });

    remove.forEach(entity => {
      var component = entity.getStateComponent(StateComponentA);
      // free resources for `component`
      entity.removeStateComponent(StateComponentA);
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

## System

Systems are stateless processors of groups of entities.
Usually each system defines one or more queries of entities and it iterate through these lists per frame.

```javascript
class SystemName extends System {
  init() {}
  execute(delta, time) {}
}

SystemName.queries = {};
```

A system should always extends from the `System` class and can implement two functions:
- `init()`: This function is called when the system is registered in a world (Calling `world.registerSystem` **link**) and can be used to initialize anything the system needs.
- `execute(deltaTime, elapsedTime)`: It will get called each frame by default (unless you are using a custom scheduler). Usually it will be used to loop through the lists of entities from each query and process the value of theirs components.

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
By default systes have `priority=0` and they are sorted ascendingly, it means the lower the number the earlier the system will be executed.

```javascript
world
  .registerSystem(SystemA)
  .registerSystem(SystemB, { priority: 2 })
  .registerSystem(SystemC, { priority: -1 })
  .registerSystem(SystemD)
  .registerSystem(SystemE);
```

This will results on an execution order as: `SystemC > SystemA > SystemD > SystemE > SystemB`.

### Reactive systems

### Life cycle

## Pooling

### Entity pooling

### Component pooling

### Prefab pooling

## Deferred removal

## Life cycle

## Queries

A query is a collection of entities that match some condition based on the components they own.
There are multiple ways to create a query:
* Creating an instance of `Query(Components, World)` (Not recommended)
* Getting the query directly from the `QueryManager` by calling `world.entityManager.queryComponents(Components)`
* Defining the queries on a `System`. This is also the recommended way as the engine could use that information to organize and optimize the execution of the systems and queries.

A query is always updated with the entities that matches the components' condition. One the query is initialized it traverse the components groups to determine which entities should get added to it. But after that entities will get added or removed from the query as components are being added or removed from them.
If we create several queries with the same components, the `QueryManager` will just create a single query under the hood and referece it everywhere saving memory and computation.

### Examples

For example, if we want a query with all the entities that has the component `Position` on a system called `SystemTest`, we should define the query as:
```javascript
SystemTest.queries = {
  positions: {
    components: [ Position ]
  }
};
```

The `components` attribute defines the list of components that an entity must have to be included in this query.

You can also define multiple queries;

```javascript
SystemTest.queries = {
  positions: {
    components: [ Position ]
  },
  physicsObjects: {
    components: [ PhysicBody, Transform ]
  }
};
```

In this example the `physicsObjects` query will get populated with the components that have both `PhysicsBody` **and** `Transform`.

### Not operator

It is also possible to include a `Not` operator when defining a query:
```javascript
SystemTest.queries = {
  activeEnemies: {
    components: [ Enemy, Not(Dead) ]
  }
};
```
This will return all the entities that have a `Enemy` component but have not the `Dead` component.

This operator could be very useful as a factory pattern (**See example link**):
```javascript
SystemTest.queries = {
  playerUninitialized: {
    components: [ Player, Not(Name) ]
  }
};
```
The `playerUnitialized` query will have all the players that don't have a `Name` component yet, a system could get that list and add a random name to them:
```javascript
queries.playerUnitialized.forEach(entity => {
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

To avoid callbacks and asynchronicity, which is a bad thing for cache and predictability on the execution, entities are queued on the `added` and `removed` lists but they system owning these lists will be able to process them just whenever the `execute` method will get called.
So everytime you call `execute` you will have the list of all the entities added or removed since the last call. After the call has been executed these lists will get cleared.

#### Changed
Sometimes is also interesting to detect that an entity or a specific component has changed. Detecting these changes is more tricky to do performantly that's why we rely on the `entity.getMutableComponent` function (More info **link**) that basically mark the component as modified.
The syntax to detect if an entity has changed, this means that any of the components from the entity that are part of the query have changed, is similar to the ones for `added` or `removed`:


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