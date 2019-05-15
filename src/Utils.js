export function getName(Component) {
  return Component.name;
}

export function componentPropertyName(Component) {
  var name = getName(Component);
  return name.charAt(0).toLowerCase() + name.slice(1);
}

export function queryKey(Components) {
  var names = [];
  for (var n = 0; n < Components.length; n++) {
    var T = Components[n];
    names.push(getName(T));
  }

  return names
    .map(function(x) {
      return x.toLowerCase();
    })
    .sort()
    .join("-");
}
