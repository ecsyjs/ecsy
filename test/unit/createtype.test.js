import test from "ava";
import { createType } from "../../src/CreateType";
import { Vector3 } from "../helpers/customtypes";

test("Create simple type", t => {
  // Empty
  const error1 = t.throws(() => {
    createType({});
  }, Error);
  t.is(
    error1.message,
    "createType expect type definition to implements the following functions: create, reset, clear"
  );

  // Just create
  const error2 = t.throws(() => {
    createType({ create: {} });
  }, Error);
  t.is(
    error2.message,
    "createType expect type definition to implements the following functions: reset, clear"
  );

  // create and reset
  const error3 = t.throws(() => {
    createType({ create: {}, reset: {} });
  }, Error);
  t.is(
    error3.message,
    "createType expect type definition to implements the following functions: clear"
  );

  // all of them
  var type = createType({ create: {}, reset: {}, clear: {} });
  t.not(type, null);
  t.true(type.isType);
});

test("Create vector3 type", t => {
  var CustomVector3 = createType({
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

  t.true(CustomVector3.isType);
});
