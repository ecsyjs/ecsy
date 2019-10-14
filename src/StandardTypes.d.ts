import { TypeDefinition } from "./CreateType";

export interface Types {
  Number: TypeDefinition<number>;
  Boolean: TypeDefinition<boolean>;
  String: TypeDefinition<string>;
  Array: TypeDefinition<any[]>
}
