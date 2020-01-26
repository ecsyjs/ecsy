import { System } from './system';
export declare function systemToJSON(system: System): {
    name: string;
    enabled: boolean;
    executeTime: any;
    priority: number;
    queries: {};
};
