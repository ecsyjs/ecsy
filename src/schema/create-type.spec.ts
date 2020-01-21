import { createType } from './create-type';

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

describe('create-type', () => {

  it('Create simple type', () => {
    // Empty
    expect(() => {
      createType({} as any);
    })
      .toThrowError('createType expect type definition to implements the following functions: create, reset, clear');


    // Just create
    expect(() => {
      createType({ create: {} } as any);
    })
      .toThrowError('createType expect type definition to implements the following functions: reset, clear');

    // create and reset
    expect(() => {
      createType({ create: {}, reset: {} } as any);
    })
      .toThrowError('createType expect type definition to implements the following functions: clear');

    // all of them
    const type = createType({ create: {}, reset: {}, clear: {} } as any);
    expect(type).not.toBe(null);
    expect(type.isType).toBeTruthy();
  });

  it('Create vector3 type', () => {
    const CustomVector3 = createType({
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
    });

    expect(CustomVector3.isType).toBeTruthy();
  });
});
