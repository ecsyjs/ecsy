global.performance =
  typeof performance !== "undefined" ? performance : { now: () => 0 };

global.window = typeof window !== "undefined" ? window : { location: {} };

const common = {};

export default common;
