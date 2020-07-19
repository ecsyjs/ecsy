/**
 * Return the name of a component
 * @param {Component} Component
 * @private
 */
export function getName(Component) {
  return Component.name;
}

/**
 * Return a valid property name for the Component
 * @param {Component} Component
 * @private
 */
export function componentPropertyName(Component) {
  return getName(Component);
}

/**
 * Returns the unique type id for the Component.
 * @param {Component} Component
 * @private
 */
function getTypeId(Component) {
  const id = Component._typeId;
  if (id === undefined) {
    const name = getName(Component);
    console.warn(`Component ${name} has no TypeId. Was it registered?`);
  }
  return id;
}

/**
 * Get a key from a list of components
 * @param {Array(Component)} Components Array of components to generate the key
 * @private
 */
export function queryKey(Components) {
  var names = [];
  for (var n = 0; n < Components.length; n++) {
    var T = Components[n];
    if (typeof T === "object") {
      var operator = T.operator === "not" ? "!" : T.operator;
      names.push(operator + getTypeId(T.Component));
    } else {
      names.push(getTypeId(T));
    }
  }

  return names.sort().join("-");
}

// Detector for browser's "window"
export const hasWindow = typeof window !== "undefined";

// performance.now() "polyfill"
export const now =
  hasWindow && typeof window.performance !== "undefined"
    ? performance.now.bind(performance)
    : Date.now.bind(Date);
