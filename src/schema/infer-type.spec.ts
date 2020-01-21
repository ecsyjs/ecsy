import { inferType } from './infer-type';
import { standardTypes } from './standard-types';

describe('infer-type', () => {
  it('inferType', () => {
    expect(inferType(2)).toBe(standardTypes.number);
    expect(inferType(2.3)).toBe(standardTypes.number);
    expect(inferType('hello')).toBe(standardTypes.string);
    expect(inferType([])).toBe(standardTypes.array);
    expect(inferType({})).toBe(null);
    expect(inferType(null)).toBe(null);
    expect(inferType(undefined)).toBe(null);

    // @todo Include user defined types
  });
});
