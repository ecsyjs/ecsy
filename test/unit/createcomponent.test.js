import test from "ava";
import { createComponent } from "../../src/CreateComponent";
import { createType } from "../../src/CreateType";

/*
test("inferType", t => {
  t.is(inferType(2), "number");
  t.is(inferType(2.3), "number");
  t.is(inferType("hello"), "string");
  t.is(inferType([]), "array");
  t.is(inferType({}), "object");
  t.is(inferType(null), "object");
  t.is(inferType(undefined), "undefined");
});
*/

class Vector3 {
  constructor(x, y, z) {
    this.set(x, y, z);
  }

  copy(src) {
    this.x = src.x;
    this.y = src.y;
    this.z = src.z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  toArray() {
    return [this.x, this.y, this.z];
  }
}

var CustomTypes = {};

CustomTypes.Vector3 = createType({
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

test("resetClear", t => {
  var schema = {
    number: { default: 0.5 },
    //array: { default: [1, 2, 3], type: Array },
    vector3: { default: new Vector3(1, 2, 3), type: CustomTypes.Vector3 }
  };

  var ComponentA = createComponent(schema, "ComponentA");
  var c1 = new ComponentA();

  //t.deepEqual(c1.vector3.toArray(), [1, 2, 3]);
  t.is(c1.number, 0.5);
  /*
  c1.clear();
  t.deepEqual(c1.array, []);
  t.deepEqual(c1.number, 0);

  c1.reset();
  t.deepEqual(c1.array, [1, 2, 3]);
  t.deepEqual(c1.number, 0.5);
  */
});

/*
test("copy", t => {
  var schema = {
    value: { default: 0.5, min: 10, max: 20 },
    array: { default: [] }
  };

  var ComponentA = createComponent(schema, "ComponentA");

  var c1 = new ComponentA();
  var c2 = new ComponentA();

  t.is(c1.value, 0.5);
  t.is(c2.value, 0.5);

  c1.value = 10;
  c1.array = [1, 2, 3];

  t.is(c1.value, 10);
  t.deepEqual(c1.array, [1, 2, 3]);

  t.is(c2.value, 0.5);
  t.deepEqual(c2.array, []);
  c2.copy(c1);
  t.is(c2.value, 10);
  t.deepEqual(c2.array, [1, 2, 3]);
});
*/
