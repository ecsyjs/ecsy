export class ComponentManager {
  constructor() {
    this.Components = {};
    this.SingletonComponents = {};
  }

  registerComponent(Component) {
    this.Components[Component.name] = Component;
  }

  registerSingletonComponent(Component) {
    this.SingletonComponents[Component.name] = Component;
  }
}
