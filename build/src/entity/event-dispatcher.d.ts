import { Component } from '../component.interface';
import { Entity } from './entity';
declare type Listener = (entity: Entity, component?: Component) => void;
/**
 * EventDispatcher
 */
export declare class EventDispatcher<T> {
    listeners: Map<T, Listener[]>;
    stats: {
        fired: number;
        handled: number;
    };
    constructor();
    /**
     * Add an event listener
     * @param eventName Name of the event to listen
     * @param listener Callback to trigger when the event is fired
     */
    addEventListener(eventName: T, listener: Listener): void;
    /**
     * Check if an event listener is already added to the list of listeners
     * @param eventName Name of the event to check
     * @param listener Callback for the specified event
     */
    hasEventListener(eventName: T, listener: Listener): boolean;
    /**
     * Remove an event listener
     * @param eventName Name of the event to remove
     * @param listener Callback for the specified event
     */
    removeEventListener(eventName: T, listener: Listener): void;
    /**
     * Dispatch an event
     * @param eventName Name of the event to dispatch
     * @param entity (Optional) Entity to emit
     */
    dispatchEvent(eventName: T, entity?: Entity, component?: Component): void;
    /**
     * Reset stats counters
     */
    resetCounters(): void;
}
export {};
