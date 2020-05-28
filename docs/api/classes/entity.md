
# Class: Entity

An entity in the world.

## Properties

###  id

• **id**: *number*

A unique ID for this entity.

## Methods

###  addComponent

▸ **addComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›, `values?`: object): *this*

Add a component to the entity.

**Type parameters:**

▪ **T**: *[Component](component.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› | Type of component to add to this entity |
`values?` | object | Optional values to replace the default attributes on the component  |

**Returns:** *this*

___

###  getComponent

▸ **getComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›, `includeRemoved?`: boolean): *T*

Get an immutable reference to a component on this entity.

**Type parameters:**

▪ **T**: *[Component](component.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› | Type of component to get |
`includeRemoved?` | boolean | Whether a component that is staled to be removed should be also considered  |

**Returns:** *T*

___

###  getComponentTypes

▸ **getComponentTypes**<**T**>(): *Array‹T›*

Get a list of component types that have been added to this entity.

**Type parameters:**

▪ **T**: *[Component](component.md)*

**Returns:** *Array‹T›*

___

###  getComponents

▸ **getComponents**(): *object*

Get an object containing all the components on this entity, where the object keys are the component types.

**Returns:** *object*

___

###  getComponentsToRemove

▸ **getComponentsToRemove**(): *object*

Get an object containing all the components that are slated to be removed from this entity, where the object keys are the component types.

**Returns:** *object*

___

###  getMutableComponent

▸ **getMutableComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›): *T*

Get a mutable reference to a component on this entity.

**Type parameters:**

▪ **T**: *[Component](component.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› | Type of component to get  |

**Returns:** *T*

___

###  getRemovedComponent

▸ **getRemovedComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›): *T*

Get a component that is slated to be removed from this entity.

**Type parameters:**

▪ **T**: *[Component](component.md)*

**Parameters:**

Name | Type |
------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› |

**Returns:** *T*

___

###  hasAllComponents

▸ **hasAllComponents**<**T**>(`Components`: Array‹[ComponentConstructor](../interfaces/componentconstructor.md)‹T››): *boolean*

Check if the entity has all components in a list.

**Type parameters:**

▪ **T**: *[Component](component.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Components` | Array‹[ComponentConstructor](../interfaces/componentconstructor.md)‹T›› | Component types to check  |

**Returns:** *boolean*

___

###  hasAnyComponents

▸ **hasAnyComponents**<**T**>(`Components`: Array‹[ComponentConstructor](../interfaces/componentconstructor.md)‹T››): *boolean*

Check if the entity has any of the components in a list.

**Type parameters:**

▪ **T**: *[Component](component.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Components` | Array‹[ComponentConstructor](../interfaces/componentconstructor.md)‹T›› | Component types to check  |

**Returns:** *boolean*

___

###  hasComponent

▸ **hasComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›, `includeRemoved?`: boolean): *boolean*

Check if the entity has a component.

**Type parameters:**

▪ **T**: *[Component](component.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› | Type of component |
`includeRemoved?` | boolean | Whether a component that is staled to be removed should be also considered  |

**Returns:** *boolean*

___

###  hasRemovedComponent

▸ **hasRemovedComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›): *boolean*

Check if the entity has a component that is slated to be removed.

**Type parameters:**

▪ **T**: *[Component](component.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› | Type of component  |

**Returns:** *boolean*

___

###  remove

▸ **remove**(`forceImmediate?`: boolean): *void*

Remove this entity from the world.

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`forceImmediate?` | boolean | Whether this entity should be removed immediately  |

**Returns:** *void*

___

###  removeAllComponents

▸ **removeAllComponents**(`forceImmediate?`: boolean): *void*

Remove all components on this entity.

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`forceImmediate?` | boolean | Whether all components should be removed immediately  |

**Returns:** *void*

___

###  removeComponent

▸ **removeComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›, `forceImmediate?`: boolean): *this*

Remove a component from the entity.

**Type parameters:**

▪ **T**: *[Component](component.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› | Type of component to remove from this entity |
`forceImmediate?` | boolean | Whether a component should be removed immediately  |

**Returns:** *this*
