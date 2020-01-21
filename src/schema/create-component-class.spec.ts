import { createType } from './create-type';
import { createComponentClass } from './create-component-class';

export class Vector3 {
  constructor(
    public x,
    public y,
    public z,
  ) {}

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

const CustomTypes = {
  Vector3: createType({
    baseType: Vector3,
    create: defaultValue => {
      const v = new Vector3(0, 0, 0);
      if (typeof defaultValue !== 'undefined') {
        v.copy(defaultValue);
      }
      return v;
    },
    reset: (src, key, defaultValue) => {
      if (typeof defaultValue !== 'undefined') {
        src[key].copy(defaultValue);
      } else {
        src[key].set(0, 0, 0);
      }
    },
    clear: (src, key) => {
      src[key].set(0, 0, 0);
    }
  }),
};

describe('create-component-class', () => {

  it('Unknown types', () => {
    const schema = {
      vector3: { default: new Vector3(4, 5, 6) } /* unknown type */
    };

    const ComponentA = createComponentClass(schema, 'ComponentA');
    const c1 = new ComponentA();

    expect(c1.vector3.toArray()).toEqual([4, 5, 6]);

    expect(() => {
      c1.clear();
    })
      .toThrowError('c1.clear is not a function');

    expect(c1.vector3.toArray()).toEqual([4, 5, 6]);

    expect(c1.vector3.toArray()).toEqual([4, 5, 6]);

    expect(() => {
      c1.reset();
    })
      .toThrowError('c1.reset is not a function');

    expect(c1.vector3.toArray()).toEqual([4, 5, 6]);

    c1.vector3.set(1, 2, 3);
    expect(c1.vector3.toArray()).toEqual([1, 2, 3]);

    expect(() => {
      c1.clear();
    })
      .toThrowError('c1.clear is not a function');

    expect(c1.vector3.toArray()).toEqual([1, 2, 3]);

    expect(() => {
      c1.reset();
    })
      .toThrowError('c1.reset is not a function');

    expect(c1.vector3.toArray()).toEqual([1, 2, 3]);
  });

  it('resetClear', () => {
    const schema = {
      number: { default: 0.5 },
      string: { default: 'foo' },
      bool: { default: true },
      array: { default: [1, 2, 3] },
      vector3: { default: new Vector3(4, 5, 6), type: CustomTypes.Vector3 }
    };

    const ComponentA = createComponentClass(schema, 'ComponentA');
    const c1 = new ComponentA();

    expect(c1.number).toBe(0.5);
    expect(c1.string).toBe('foo');
    expect(c1.bool).toBeTruthy();
    expect(c1.array).toEqual([1, 2, 3]);
    expect(c1.vector3.toArray()).toEqual([4, 5, 6]);

    // clear
    c1.clear();

    expect(c1.number).toEqual(0);
    expect(c1.string).toBe('');
    expect(c1.bool).toBeFalsy();
    expect(c1.array).toEqual([]);
    expect(c1.vector3.toArray()).toEqual([0, 0, 0]);

    // reset
    c1.reset();

    expect(c1.number).toBe(0.5);
    expect(c1.string).toBe('foo');
    expect(c1.bool).toBeTruthy();
    expect(c1.array).toEqual([1, 2, 3]);
    expect(c1.vector3.toArray()).toEqual([4, 5, 6]);

    // custom set
    c1.number = 2;
    c1.string = 'bar';
    c1.bool = false;
    c1.array = [7, 8, 9];
    c1.vector3.set(10, 11, 12);

    expect(c1.number).toBe(2);
    expect(c1.string).toBe('bar');
    expect(c1.bool).toBeFalsy();
    expect(c1.array).toEqual([7, 8, 9]);
    expect(c1.vector3.toArray()).toEqual([10, 11, 12]);

    // reset
    c1.reset();

    expect(c1.number).toBe(0.5);
    expect(c1.string).toBe('foo');
    expect(c1.bool).toBeTruthy();
    expect(c1.array).toEqual([1, 2, 3]);
    expect(c1.vector3.toArray()).toEqual([4, 5, 6]);
  });

  test('copy', t => {
    const schema = {
      value: { default: 0.5 },
      array: { default: [] }
    };

    const ComponentA = createComponentClass(schema, 'ComponentA');

    const c1 = new ComponentA();
    const c2 = new ComponentA();

    expect(c1.value).toBe(0.5);
    expect(c2.value).toBe(0.5);

    c1.value = 10;
    c1.array = [1, 2, 3];

    expect(c1.value).toBe(10);
    expect(c1.array).toEqual([1, 2, 3]);

    expect(c2.value).toBe(0.5);
    expect(c2.array).toEqual([]);
    c2.copy(c1);
    expect(c2.value).toBe(10);
    expect(c2.array).toEqual([1, 2, 3]);
  });

  it('Array of vector3 type', () => {
    const Vector3Array = createType({
      create: defaultValue => {
        const v = [];
        if (typeof defaultValue !== 'undefined') {
          for (const value of defaultValue) {
            v.push(new Vector3(value.x, value.y, value.z));
          }
        }
        return v;
      },
      reset: (src, key, defaultValue) => {
        if (typeof defaultValue !== 'undefined') {
          for (let i = 0; i < defaultValue.length; i++) {
            if (i < src[key].length) {
              src[key][i].copy(defaultValue[i]);
            } else {
              const value = defaultValue[i];
              src[key].push(new Vector3(value.x, value.y, value.z));
            }
          }

          // Remove if the number of elements on the default value is lower than the current value
          const diff = src[key].length - defaultValue.length;
          src[key].splice(defaultValue.length - diff + 1, diff);
        } else {
          src[key].length = 0;
        }
      },
      clear: (src, key) => {
        src[key].length = 0;
      }
    });

    const schema = {
      v3array: {
        default: [new Vector3(1, 2, 3), new Vector3(4, 5, 6)],
        type: Vector3Array
      }
    };

    const ComponentA = createComponentClass(schema, 'ComponentA');

    const c1 = new ComponentA();
    const c2 = new ComponentA();

    expect(c1.v3array.length).toBe(2);
    expect(c1.v3array).toEqual([new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);
    expect(c2.v3array.length).toBe(2);
    expect(c2.v3array).toEqual([new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);

    c1.v3array[0].x = 10;
    c1.v3array[1].y = 20;

    expect(c1.v3array).toEqual([new Vector3(10, 2, 3), new Vector3(4, 20, 6)]);
    expect(c2.v3array).toEqual([new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);

    c1.reset();

    expect(c1.v3array).toEqual([new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);
    expect(c2.v3array).toEqual([new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);

    c1.v3array.push(new Vector3(7, 8, 9));
    expect(c1.v3array).toEqual([
      new Vector3(1, 2, 3),
      new Vector3(4, 5, 6),
      new Vector3(7, 8, 9)
    ]);

    c1.reset();
    expect(c1.v3array).toEqual([new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);

    c1.v3array.splice(1, 1);
    c1.reset();
    expect(c1.v3array).toEqual([new Vector3(1, 2, 3), new Vector3(4, 5, 6)]);

    c1.clear();
    expect(c1.v3array.length).toBe(0);
  });

  fit('Copy with different number of parameters', () => {
    const schema = {
      value1: { default: 1 },
      value2: { default: 2 },
      value3: { default: 3 }
    };

    const ComponentA = createComponentClass(schema, 'ComponentA');
    const c1 = new ComponentA();

    expect(c1.value1).toBe(1);
    expect(c1.value2).toBe(2);
    expect(c1.value3).toBe(3);

    c1.copy({ value1: 11, value2: 22 });

    expect(c1.value1).toBe(11);
    expect(c1.value2).toBe(22);
    expect(c1.value3).toBe(3);

    c1.copy({ value1: 11, value2: 22, value3: 33, value4: 44 });

    expect(c1.value1).toBe(11);
    expect(c1.value2).toBe(22);
    expect(c1.value3).toBe(33);
    expect(c1.value4).toBe(undefined);
  });
});
