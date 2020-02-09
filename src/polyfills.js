export const performance =
  typeof window !== "undefined" && typeof window.performance !== "undefined"
    ? window.performance
    : require("perf_hooks").performance;
