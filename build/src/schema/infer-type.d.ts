import { TypeDefinition } from './create-type';
/**
 * Try to infer the type of the value
 * @return Type of the attribute
 */
export declare function inferType(value: unknown): TypeDefinition<NumberConstructor | BooleanConstructor | BooleanConstructor | ArrayConstructor>;
