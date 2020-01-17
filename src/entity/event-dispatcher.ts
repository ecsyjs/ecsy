import { ComponentConstructor, Component } from '../component.interface';
import { Entity } from './entity';

/**
 * EventDispatcher
 */
export class EventDispatcher {
  listeners = {};
  stats = {
    fired: 0,
    handled: 0
  };

  constructor() {
  }

  /**
   * Add an event listener
   * @param eventName Name of the event to listen
   * @param listener Callback to trigger when the event is fired
   */
  addEventListener(eventName: string, listener: (entity: Entity, componentConstructor?: ComponentConstructor<Component>) => void) {
    const listeners = this.listeners;
    if (listeners[eventName] === undefined) {
      listeners[eventName] = [];
    }

    if (listeners[eventName].indexOf(listener) === -1) {
      listeners[eventName].push(listener);
    }
  }

  /**
   * Check if an event listener is already added to the list of listeners
   * @param eventName Name of the event to check
   * @param listener Callback for the specified event
   */
  hasEventListener(eventName: string, listener: (entity: Entity, componentConstructor?: ComponentConstructor<Component>) => void) {
    return (
      this.listeners[eventName] !== undefined &&
      this.listeners[eventName].indexOf(listener) !== -1
    );
  }

  /**
   * Remove an event listener
   * @param eventName Name of the event to remove
   * @param listener Callback for the specified event
   */
  removeEventListener(eventName: string, listener: (entity: Entity, componentConstructor?: ComponentConstructor<Component>) => void) {
    const listenerArray = this.listeners[eventName];
    if (listenerArray !== undefined) {
      const index = listenerArray.indexOf(listener);
      if (index !== -1) {
        listenerArray.splice(index, 1);
      }
    }
  }

  /**
   * Dispatch an event
   * @param eventName Name of the event to dispatch
   * @param entity (Optional) Entity to emit
   */
  dispatchEvent(eventName: string, entity?: Entity, component?: Component) {
    this.stats.fired++;

    const listenerArray = this.listeners[eventName];
    if (listenerArray !== undefined) {
      const array = listenerArray.slice(0);

      for (const value of array) {
        value.call(this, entity, component);
      }
    }
  }

  /**
   * Reset stats counters
   */
  resetCounters() {
    this.stats.fired = this.stats.handled = 0;
  }
}
