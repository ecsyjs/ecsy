export interface Component {
  copy?(src: Component): void;
  reset?(): void;
};

export type ComponentConstructor<T extends Component> =
  new (...args: any) => T;
