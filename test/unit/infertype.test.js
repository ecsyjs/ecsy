import test from "ava";
import { inferType } from "../../src/InferType";
import { Types } from "../../src/StandardTypes";

test("inferType", t => {
  t.is(inferType(2), Types.Number);
  t.is(inferType(2.3), Types.Number);
  t.is(inferType("hello"), Types.String);
  t.is(inferType([]), Types.Array);
  t.is(inferType({}), null);
  t.is(inferType(null), null);
  t.is(inferType(undefined), null);

  // @todo Include user defined types
});
