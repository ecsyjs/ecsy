import RegisterType from "./Types";

// Numeric

export const Numeric = {
  isSimpleType: true,
  default: 0,
  reset: (src, key, defaultValue) => {
    src[key] = defaultValue;
  },
  clear: (src, key) => {
    src[key] = 0;
  }
};

RegisterType(Numeric);

