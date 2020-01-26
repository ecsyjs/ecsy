export interface TypeDefinition<T> {
    baseType?: T;
    isType?: boolean;
    isSimpleType?: boolean;
    create(defaultValue: any): void;
    reset(src: any, key: any, defaultValue: any): void;
    clear(src: any, key: any): void;
    copy?(src: any, dst: any, key: any): void;
}
export declare function createType<T>(typeDefinition: TypeDefinition<T>): TypeDefinition<T>;
