import { Component } from '../component.interface';
import { Entity } from './entity';

type Listener = (entity: Entity, component?: Component) => void;

/**
 * EventDispatcher
 */
export class EventDispatcher<T> {
  listeners = new Map<T, Listener[]>();

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
  addEventListener(eventName: T, listener: Listener) {
    const listeners = this.listeners;

    if (!listeners.has(eventName)) {
      listeners.set(eventName, []);
    }

    const listenerArray = listeners.get(eventName);

    if (listenerArray.indexOf(listener) === -1) {
      listenerArray.push(listener);
    }
  }

  /**
   * Check if an event listener is already added to the list of listeners
   * @param eventName Name of the event to check
   * @param listener Callback for the specified event
   */
  hasEventListener(eventName: T, listener: Listener) {
    return (
      this.listeners.has(eventName) && this.listeners.get(eventName).indexOf(listener) !== -1
    );
  }

  /**
   * Remove an event listener
   * @param eventName Name of the event to remove
   * @param listener Callback for the specified event
   */
  removeEventListener(eventName: T, listener: Listener) {
    const listenerArray = this.listeners.get(eventName);

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
  dispatchEvent(eventName: T, entity?: Entity, component?: Component) {
    this.stats.fired++;

    const listenerArray = this.listeners.get(eventName);

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
