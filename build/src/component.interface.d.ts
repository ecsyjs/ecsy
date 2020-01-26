import { Resettable } from './resettable.interface';
import { NotComponent } from './not';
export interface Component extends Resettable {
    [key: string]: any;
    copy?(src: Component): void;
}
export declare type ComponentConstructor = new () => Component;
export declare type Components = ComponentConstructor | NotComponent;
