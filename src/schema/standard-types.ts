import { createType } from './create-type';

/**
 * Standard types
 */
export const standardTypes = {
  number: createType({
    baseType: Number,
    isSimpleType: true,
    create: defaultValue => {
      return typeof defaultValue !== 'undefined' ? defaultValue : 0;
    },
    reset: (src, key, defaultValue) => {
      if (typeof defaultValue !== 'undefined') {
        src[key] = defaultValue;
      } else {
        src[key] = 0;
      }
    },
    clear: (src, key) => {
      src[key] = 0;
    }
  }),
  boolean: createType({
    baseType: Boolean,
    isSimpleType: true,
    create: defaultValue => {
      return typeof defaultValue !== 'undefined' ? defaultValue : false;
    },
    reset: (src, key, defaultValue) => {
      if (typeof defaultValue !== 'undefined') {
        src[key] = defaultValue;
      } else {
        src[key] = false;
      }
    },
    clear: (src, key) => {
      src[key] = false;
    }
  }),
  string: createType({
    baseType: String,
    isSimpleType: true,
    create: defaultValue => {
      return typeof defaultValue !== 'undefined' ? defaultValue : '';
    },
    reset: (src, key, defaultValue) => {
      if (typeof defaultValue !== 'undefined') {
        src[key] = defaultValue;
      } else {
        src[key] = '';
      }
    },
    clear: (src, key) => {
      src[key] = '';
    }
  }),
  array: createType({
    baseType: Array,
    create: defaultValue => {
      if (typeof defaultValue !== 'undefined') {
        return defaultValue.slice();
      }

      return [];
    },
    reset: (src, key, defaultValue) => {
      if (typeof defaultValue !== 'undefined') {
        src[key] = defaultValue.slice();
      } else {
        src[key].length = 0;
      }
    },
    clear: (src, key) => {
      src[key].length = 0;
    },
    copy: (src: any, dst: any, key: string) => {
      src[key] = dst[key].slice();
    }
  }),
};

