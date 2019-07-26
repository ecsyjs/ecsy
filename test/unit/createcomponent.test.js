import test from "ava";
import { createComponent, inferType } from "../../src/CreateComponent";

test("inferType", t => {
  t.is(inferType(2), "number");
  t.is(inferType(2.3), "number");
  t.is(inferType("hello"), "string");
  t.is(inferType([]), "array");
  t.is(inferType({}), "object");
  t.is(inferType(null), "object");
  t.is(inferType(undefined), "undefined");
});

test("resetClear", t => {
  var schema = {
    number: { default: 0.5 },
    array: { default: [1, 2, 3] }
  };

  var ComponentA = createComponent(schema, "ComponentA");
  var c1 = new ComponentA();

  t.deepEqual(c1.array, [1, 2, 3]);
  t.deepEqual(c1.number, 0.5);

  c1.clear();
  t.deepEqual(c1.array, []);
  t.deepEqual(c1.number, 0);

  c1.reset();
  t.deepEqual(c1.array, [1, 2, 3]);
  t.deepEqual(c1.number, 0.5);
});

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
