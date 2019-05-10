export default class Entity {
  constructor(manager) {
    this._manager = manager || null;
    this.id = nextId++;
    this._Components = [];
    this._tags = [];
  }

  //---------------------------------------------------------------------------
  // COMPONENTS
  //---------------------------------------------------------------------------
  addComponent(Component, values) {
    this._manager.entityAddComponent(this, Component, values);
    return this;
  }

  removeComponent(Component) {
    this._manager.entityRemoveComponent(this, Component);
    return this;
  }

  hasComponent(Component) {
    return !!~this._Components.indexOf(Component);
  }

  hasAllComponents(Components) {
    var result = true;

    for (var i = 0; i < Components.length; i++) {
      result = result && !!~this._Components.indexOf(Components[i]);
    }

    return result;
  }

  removeAllComponents() {
    return this._manager.entityRemoveAllComponents(this);
  }

  //---------------------------------------------------------------------------
  // TAGS
  //---------------------------------------------------------------------------

  hasTag(tag) {
    return !!~this._tags.indexOf(tag);
  }

  addTag(tag) {
    this._manager.entityAddTag(this, tag);
    return this;
  }

  removeTag(tag) {
    this._manager.entityRemoveTag(this, tag);
    return this;
  }

  //---------------------------------------------------------------------------
  // EXTRAS
  //---------------------------------------------------------------------------
  __init() {
    this.id = nextId++;
    this._manager = null;
    this._Components.length = 0;
    this._tags.length = 0;
  }

  trigger(eventName, option) {
    this._manager.trigger(eventName, this, option);
  }

  dispose() {
    return this._manager.removeEntity(this);
  }
}

var nextId = 0;
