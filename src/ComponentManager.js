export class ComponentManager {
  constructor() {
    this.Components = {};
  }

  registerComponent(Component) {
    this.Components[Component.name] = Component;
  }
}