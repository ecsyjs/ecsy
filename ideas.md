Events:
- Add 'alive' attribute on components?
- Limit number of components to 1 on events/queries
- What to do with the Group/Mesh/Object3D if several systems wants to share the same entity
- onEvent attribute on a component to be used for example to trigger the paint/teleport action, how to define it
- this.component inside systems
- Component that doesn't need reset() but want to benefit from Pool?

```js

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

```
