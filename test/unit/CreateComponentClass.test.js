import test from "ava";
import { createComponentClass } from "../../src/CreateComponentClass";
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

  var ComponentA = createComponentClass(schema, "ComponentA");
  var c1 = new ComponentA();

  t.deepEqual(c1.vector3.toArray(), [4, 5, 6]);
  let error = t.throws(() => {
    c1.clear();
  }, Error);
  t.is(error.message, "c1.clear is not a function");

  t.deepEqual(c1.vector3.toArray(), [4, 5, 6]);

  t.deepEqual(c1.vector3.toArray(), [4, 5, 6]);
  error = t.throws(() => {
    c1.reset();
  }, Error);
  t.is(error.message, "c1.reset is not a function");
  t.deepEqual(c1.vector3.toArray(), [4, 5, 6]);

  c1.vector3.set(1, 2, 3);
  t.deepEqual(c1.vector3.toArray(), [1, 2, 3]);

  error = t.throws(() => {
    c1.clear();
  }, Error);
  t.is(error.message, "c1.clear is not a function");

  t.deepEqual(c1.vector3.toArray(), [1, 2, 3]);
  error = t.throws(() => {
    c1.reset();
  }, Error);
  t.is(error.message, "c1.reset is not a function");

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

  var ComponentA = createComponentClass(schema, "ComponentA");
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

  var ComponentA = createComponentClass(schema, "ComponentA");

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

test("Array of vector3 type", t => {
  var Vector3Array = createType({
    create: defaultValue => {
      var v = [];
      if (typeof defaultValue !== "undefined") {
        for (var i = 0; i < defaultValue.length; i++) {
          var value = defaultValue[i];
          v.push(new Vector3(value.x, value.y, value.z));
        }
      }
      return v;
    },
    reset: (src, key, defaultValue) => {
      if (typeof defaultValue !== "undefined") {
        for (var i = 0; i < defaultValue.length; i++) {
          if (i < src[key].length) {
            src[key][i].copy(defaultValue[i]);
          } else {
            var value = defaultValue[i];
            src[key].push(new Vector3(value.x, value.y, value.z));
          }
        }

        // Remove if the number of elements on the default value is lower than the current value
        var diff = src[key].length - defaultValue.length;
        src[key].splice(defaultValue.length - diff + 1, diff);
      } else {
        src[key].length = 0;
      }
    },
    clear: (src, key) => {
      src[key].length = 0;
    }
  });

  var schema = {
    v3array: {
      default: [new Vector3(1, 2, 3), new Vector3(4, 5, 6)],
      type: Vector3Array
    }
  };

  var ComponentA = createComponentClass(schema, "ComponentA");

  var c1 = new ComponentA();
  var c2 = new ComponentA();

  t.is(c1.v3array.length, 2);
  t.deepEqual(c1.v3array, [new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);
  t.is(c2.v3array.length, 2);
  t.deepEqual(c2.v3array, [new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);

  c1.v3array[0].x = 10;
  c1.v3array[1].y = 20;

  t.deepEqual(c1.v3array, [new Vector3(10, 2, 3), new Vector3(4, 20, 6)]);
  t.deepEqual(c2.v3array, [new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);

  c1.reset();

  t.deepEqual(c1.v3array, [new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);
  t.deepEqual(c2.v3array, [new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);

  c1.v3array.push(new Vector3(7, 8, 9));
  t.deepEqual(c1.v3array, [
    new Vector3(1, 2, 3),
    new Vector3(4, 5, 6),
    new Vector3(7, 8, 9)
  ]);

  c1.reset();
  t.deepEqual(c1.v3array, [new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);

  c1.v3array.splice(1, 1);
  c1.reset();
  t.deepEqual(c1.v3array, [new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);

  c1.clear();
  t.is(c1.v3array.length, 0);
});

test("Copy with different number of parameters", t => {
  var schema = {
    value1: { default: 1 },
    value2: { default: 2 },
    value3: { default: 3 }
  };

  var ComponentA = createComponentClass(schema, "ComponentA");
  var c1 = new ComponentA();

  t.is(c1.value1, 1);
  t.is(c1.value2, 2);
  t.is(c1.value3, 3);

  c1.copy({ value1: 11, value2: 22 });

  t.is(c1.value1, 11);
  t.is(c1.value2, 22);
  t.is(c1.value3, 3);

  c1.copy({ value1: 11, value2: 22, value3: 33, value4: 44 });

  t.is(c1.value1, 11);
  t.is(c1.value2, 22);
  t.is(c1.value3, 33);
  t.is(c1.value4, undefined);
});
