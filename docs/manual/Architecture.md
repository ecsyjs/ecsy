# ECSY Architecture

## Entities
An entity is an object that has an unique ID which purpose is to group components together.

Entities are always created within a `World` context:

```
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

### Accessing components and mutability

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

### Create component helper

### Reset, Copy, Clear

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

## System State Components

## System

Systems are stateless processors of groups of entities.

### Reactive systems

### Life cycle

## Queries

### Not operator

### Reactive queries

## Pooling

### Entity pooling

### Component pooling

### Prefab pooling

## Deferred removal

## Life cycle






## Queries
