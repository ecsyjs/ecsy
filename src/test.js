// ----------------------

let schemaB = {
  v: { default: false },
  unknown: { type: "Object3D" } // @todo Type instead of string?
};

var ComponentB = createComponent(schemaB, "ComponentB");

// -----------------------
let schema = {
  //mesh: { type: THREE.Mesh },
  //vector: { default: new THREE.Vector3(1,2,3), type: THREE.Vector3 }
  v: { default: 0.5, min: 10, max: 20 },
  array: { default: [] }
};


// components.jsm
var ComponentA = createComponent(schema, "ComponentA");
var ComponentB = createComponent(schema, "ComponentB");

var a = new ComponentA();
var b = new ComponentA();

console.log(ComponentA, a, b);

a.v = 10;
a.array = [1, 2, 3, 4];

console.log(a.v, a.array);
console.log(b.v, b.array);

b.copy(a);
console.log("after");
console.log(a.v, a.array);
console.log(b.v, b.array);
