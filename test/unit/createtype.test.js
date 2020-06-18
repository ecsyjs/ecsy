import test from "ava";
import { createType, copyCopyable, cloneClonable } from "../../src/Types";
import { Vector3 } from "../helpers/customtypes";

test("Create simple type", t => {
  // Empty
  const error1 = t.throws(() => {
    createType({});
  });
  t.is(
    error1.message,
    "createType expects a type definition with the following properties: name, default, copy, clone"
  );

  // Just name
  const error2 = t.throws(() => {
    createType({ name: "test" });
  });
  t.is(
    error2.message,
    "createType expects a type definition with the following properties: default, copy, clone"
  );

  // copy and clone
  const error3 = t.throws(() => {
    createType({ copy: {}, clone: {} });
  });
  t.is(
    error3.message,
    "createType expects a type definition with the following properties: name, default"
  );

  // all of them
  var type = createType({
    name: "test",
    default: undefined,
    copy: () => {},
    clone: () => {}
  });
  t.not(type, null);
  t.true(type.isType);
});

test("Create vector3 type", t => {
  var CustomVector3 = createType({
    name: "Vector3",
    default: new Vector3(),
    copy: copyCopyable,
    clone: cloneClonable
  });

  t.true(CustomVector3.isType);
});
