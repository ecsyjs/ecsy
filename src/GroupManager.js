import Group from "./Group.js";

export default class GroupManager {
  constructor(manager) {
    this._manager = manager;
    this._groups = {};
  }

  addEntity(entity, Component) {
    // Check each indexed group to see if we need to add this entity to the list
    for (var groupName in this._groups) {
      var group = this._groups[groupName];

      // Add the entity only if:
      // Component is in the group
      if (!~group.Components.indexOf(Component)) continue;

      // && Entity has ALL the components of the group
      if (!entity.hasAllComponents(group.Components)) continue;

      // && Entity is not already in the group
      if (~group.entities.indexOf(entity)) continue;

      group.entities.push(entity);
    }
  }

  removeEntity(entity, Component) {
    for (var groupName in this._groups) {
      var group = this._groups[groupName];

      if (!~group.Components.indexOf(Component)) continue;
      if (!entity.hasAllComponents(group.Components)) continue;

      var loc = group.entities.indexOf(entity);
      if (~loc) {
        group.entities.splice(loc, 1);
      }
    }
  }

  _createGroup(Components) {
    var key = groupKey(Components);

    if (this._groups[key]) return;

    var group = (this._groups[key] = new Group(Components));

    // Fill the group with the existing entities
    for (var n = 0; n < this._manager._entities.length; n++) {
      var entity = this._manager._entities[n];
      if (entity.hasAllComponents(Components)) {
        group.entities.push(entity);
      }
    }

    return group;
  }

  getGroup(Components) {
    var group = this._groups[groupKey(Components)];
    if (!group) {
      group = this._createGroup(Components);
    }
    return group;
  }

  stats() {
    var stats = {};
    for (var groupName in this._groups) {
      stats[groupName] = this._groups[groupName].stats();
    }
    return stats;
  }
}

function getName(Component) {
  return Component.name;
}

function groupKey(Components) {
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
