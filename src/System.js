/**
 * @class System
 */
import Query from "./Query.js";

export class System {
  constructor(world, attributes) {
    this.world = world;
    this.enabled = true;

    // @todo Better naming :)
    this._queries = {};
    this.queries = {};

    this._events = {};
    this.events = {};

    this.priority = 0;

    if (attributes && attributes.priority) {
      this.priority = attributes.priority;
    }

    this.config = this.init ? this.init() : null;

    if (!this.config) return;
    if (this.config.queries) {
      for (var name in this.config.queries) {
        var queryConfig = this.config.queries[name];
        var Components = queryConfig.components;
        if (!Components || Components.length === 0) {
          throw new Error("'components' attribute can't be empty in a query");
        }
        var query = this.world.entityManager.queryComponents(Components);
        this._queries[name] = query;
        this.queries[name] = query.entities;

        if (queryConfig.events) {
          this.events[name] = {};
          let events = this.events[name];
          for (let eventName in queryConfig.events) {
            let event = queryConfig.events[eventName];
            events[eventName] = [];

            const eventMapping = {
              EntityAdded: Query.prototype.ENTITY_ADDED,
              EntityRemoved: Query.prototype.ENTITY_REMOVED,
              EntityChanged: Query.prototype.ENTITY_CHANGED
            };

            if (eventMapping[event.event]) {
              query.eventDispatcher.addEventListener(
                eventMapping[event.event],
                entity => {
                  events[eventName].push(entity);
                }
              );
            } else if (event.event === "ComponentChanged") {
              query.reactive = true;
              query.eventDispatcher.addEventListener(
                Query.prototype.COMPONENT_CHANGED,
                (entity, component) => {
                  if (event.components.indexOf(component.constructor) !== -1) {
                    events[eventName].push(entity);
                  }
                }
              );
            }
          }
        }
      }
    }

    if (this.config.events) {
      for (let name in this.config.events) {
        var event = this.config.events[name];
        this.events[name] = [];
        this.world.addEventListener(event, data => {
          this.events[name].push(data);
        });
      }
    }
  }

  stop() {
    this.enabled = false;
  }

  play() {
    this.enabled = true;
  }

  clearEvents() {
    for (var name in this.events) {
      var event = this.events[name];
      if (Array.isArray(event)) {
        this.events[name].length = 0;
      } else {
        for (name in event) {
          event[name].length = 0;
        }
      }
    }
  }
}
