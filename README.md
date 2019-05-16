# ecsy
Highly experimental Entity Component System

# Create a new world
A `world` is a container of `entities`,  `components` and `systems`. You can have multiple instances of `world` running at the same time.

```javascript
import {World} from 'ecsy';

var world = new World();
```

# Add entities to the world
An `entity` is just a reference to a group of components.

```javascript
var entity = world.createEntity();
```

# Creating and registering components
Creating a component is basically creating a class with some attributes initialized on its contructor:
```javascript
export class PulsatingColor {
  constructor() {
    this.offset = 0;
    this.amplitude = 10;
  }
}
```

In order to use this component in our `world` we must register it:
```javascript
world.registerComponent(PulsatingColor);
```

After registering a component we can add it to the entities we created:
```javascript
entity.addComponent(PulsatingColor);
```

We can pass attributes to change the default values:
```javascript
entity.addComponent(PulsatingColor, {offset: 2, amplitude: 5});
```

To access a component from an entity we could use two functions:
- `getComponent(Component)`: This will return a reference that should not mutate, basically you will just use the component as read-only.
- `getMutableComponent(Component)`: You should use this function when you expect to modify the values of the components. (See #ReactiveSystems)

# Creating a system
