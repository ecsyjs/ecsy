import { ComponentSchema } from "./CreateType";
/**
 * Base class for components.
 */
export class Component {
  schema?: ComponentSchema
  copy(src: Component): void
  reset(): void
  clear(): void
}

export interface ComponentConstructor<T extends Component> {
  new (...args: any): T;
}
