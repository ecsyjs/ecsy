Events:
- Add 'alive' attribute on components?
- Extend "Component" class for all components
- Limit number of components to 1 on events/queries
- What to do with the Group/Mesh/Object3D if several systems wants to share the same entity
- onEvent attribute on a component to be used for example to trigger the paint/teleport action, how to define it
- this.component inside systems
- Component that doesn't need reset() but want to benefit from Pool?

```js
class ComponentA {
  constructor() {
    this.value1 = 0;
    this.value3 = 0;
  }
}

//
world.registerComponent(CA);

entity.addComponent(CA);
entity.addComponent(CA, {value: 1});

c = new CA(1);

c = new CA();
c.value = 1;

entity.addComponent(c);

//

var c = entity.addComponent(CA);
c.value = 1;

//

world.registerComponent(ComponentA);

// 0


class ComponentA {
  constructor() {
    this.v = new THREE.Vector3();
    this.value = 0;
  }

  auxConvertDegrees(value) {
    this.value = balblabla(value);
  }
}

==>

import {World, Component, System, CreateComponent} from 'ecsy';

var world = new World();


CreateComponent(Schema) {
  var component = createComponentDefinition(Schema);
  Component.schemas[component.id] = Schema;
  return component;
}

var ComponentA = CreateComponent({
  v: { type: 'vector3', default: [0,0,0]},
  value: { type: 'float', default: 0},
});

class ComponentA {
  constructor() {
    this.v = [0,0,0];
    this.value = 0;
  },
  copy(src) {
    this.v.copy(src.v);
    this.value = src.value;
  }
}

world.registerComponent(ComponentA);



component = entity.addComponent(ComponentA);

component.v.set(0,1,0);
component.value = 10;

component = {
  v: 1,
  value: Vector3
}

// mycomponent.js
import CreateComponent from 'ecsy';
import Mesh, Float from 'ecsy-types';

ComponentA = CreateComponent({
  schema: {
    v: { type: Mesh},
    value: { type: Float, default: 0},
  }
});

export ComponentA;

//

Mesh = CreateType({
  create: () => {return new THREE.Mesh();},
  copy: (src,dst) => {src.copy(dst)},
  default: () => {},
  toJSON()
  toTypedArray()
});

export Mesh;

// mysystem.js

import System from 'ecsy';

export class System2 extends System {
}
...
...
...









ComponentA.propTypes = {
  v: { type: 'vector3', default: [0,0,0]},
  value: { type: 'float', default: 0},
};


world.registerComponent(ComponentA, ComponentManager);

entity.addComponent(ComponentA, {value1: 2, value3: 4});

// 1
var component = entity.addComponent(ComponentA);

// 2
var component = world.createComponent(ComponentA)
component.value1 = 3;
entity.addComponent(component);

// 2b XXXX
component = new ComponentA(3,2);
component.value1 = 3;

entity.addComponent(component);

// 3
world.getComponentManager(ComponentA).create();
entity.addComponent(component);


// -----------
world.registerComponent(ComponentA, ComponentManagerA);

// 1
var component = entity.addComponent(ComponentA);


```