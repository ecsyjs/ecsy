
# Class: Entity

## Hierarchy

* **Entity**

## Index

### Methods

* [addComponent](entity.md#addcomponent)
* [getComponent](entity.md#getcomponent)
* [getMutableComponent](entity.md#getmutablecomponent)
* [hasComponent](entity.md#hascomponent)
* [remove](entity.md#remove)
* [removeComponent](entity.md#removecomponent)

## Methods

###  addComponent

▸ **addComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›, `values?`: __type): *this*

**Type parameters:**

▪ **T**: *[Component](../interfaces/component.md)*

**Parameters:**

Name | Type |
------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› |
`values?` | __type |

**Returns:** *this*

___

###  getComponent

▸ **getComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›): *T*

Get an immutable reference to a component on this entity

**Type parameters:**

▪ **T**: *[Component](../interfaces/component.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› | Type of component to get  |

**Returns:** *T*

___

###  getMutableComponent

▸ **getMutableComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›): *T*

**Type parameters:**

▪ **T**: *[Component](../interfaces/component.md)*

**Parameters:**

Name | Type |
------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› |

**Returns:** *T*

___

###  hasComponent

▸ **hasComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›): *boolean*

**Type parameters:**

▪ **T**: *[Component](../interfaces/component.md)*

**Parameters:**

Name | Type |
------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› |

**Returns:** *boolean*

___

###  remove

▸ **remove**(): *void*

Remove this entity from the world.

**Returns:** *void*

___

###  removeComponent

▸ **removeComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›, `forceRemove?`: boolean): *this*

**Type parameters:**

▪ **T**: *[Component](../interfaces/component.md)*

**Parameters:**

Name | Type |
------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› |
`forceRemove?` | boolean |

**Returns:** *this*
