
/**
 * Components that extend the SystemStateComponent are not removed when an entity is deleted.
 *
 * System State Components (SSC) are components used by a system to hold internal resources
 * for an entity. They are not removed when you delete the entity, you must explicitly remove
 * them when you are done with them. They can be used to detect when an entity has been added
 * or removed from a query.
 */
export class SystemStateComponent {
  static isSystemStateComponent = true;
}

