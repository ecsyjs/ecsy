import test from "ava";
import { createComponent } from "../../src/CreateComponent";
import { createType } from "../../src/CreateType";
import { Vector3 } from "../helpers/customtypes";

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

test("Unknown types", t => {
  var schema = {
    vector3: { default: new Vector3(4, 5, 6) } /* unknown type */
  };

  var ComponentA = createComponent(schema, "ComponentA");
  var c1 = new ComponentA();

  t.deepEqual(c1.vector3.toArray(), [4, 5, 6]);
  c1.clear(); /* nop */
  t.deepEqual(c1.vector3.toArray(), [4, 5, 6]);
  c1.reset(); /* nop */
  t.deepEqual(c1.vector3.toArray(), [4, 5, 6]);

  c1.vector3.set(1, 2, 3);
  t.deepEqual(c1.vector3.toArray(), [1, 2, 3]);
  c1.clear(); /* nop */
  t.deepEqual(c1.vector3.toArray(), [1, 2, 3]);
  c1.reset(); /* nop */
  t.deepEqual(c1.vector3.toArray(), [1, 2, 3]);
});

test("resetClear", t => {
  var schema = {
    number: { default: 0.5 },
    string: { default: "foo" },
    bool: { default: true },
    array: { default: [1, 2, 3] },
    vector3: { default: new Vector3(4, 5, 6), type: CustomTypes.Vector3 }
  };

  var ComponentA = createComponent(schema, "ComponentA");
  var c1 = new ComponentA();

  t.is(c1.number, 0.5);
  t.is(c1.string, "foo");
  t.true(c1.bool);
  t.deepEqual(c1.array, [1, 2, 3]);
  t.deepEqual(c1.vector3.toArray(), [4, 5, 6]);

  // clear
  c1.clear();

  t.deepEqual(c1.number, 0);
  t.is(c1.string, "");
  t.false(c1.bool);
  t.deepEqual(c1.array, []);
  t.deepEqual(c1.vector3.toArray(), [0, 0, 0]);

  // reset
  c1.reset();

  t.is(c1.number, 0.5);
  t.is(c1.string, "foo");
  t.true(c1.bool);
  t.deepEqual(c1.array, [1, 2, 3]);
  t.deepEqual(c1.vector3.toArray(), [4, 5, 6]);

  // custom set
  c1.number = 2;
  c1.string = "bar";
  c1.bool = false;
  c1.array = [7, 8, 9];
  c1.vector3.set(10, 11, 12);

  t.is(c1.number, 2);
  t.is(c1.string, "bar");
  t.false(c1.bool);
  t.deepEqual(c1.array, [7, 8, 9]);
  t.deepEqual(c1.vector3.toArray(), [10, 11, 12]);

  // reset
  c1.reset();

  t.is(c1.number, 0.5);
  t.is(c1.string, "foo");
  t.true(c1.bool);
  t.deepEqual(c1.array, [1, 2, 3]);
  t.deepEqual(c1.vector3.toArray(), [4, 5, 6]);
});

test("copy", t => {
  var schema = {
    value: { default: 0.5 },
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
