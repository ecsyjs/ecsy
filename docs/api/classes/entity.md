
# Class: Entity

An entity in the world.

## Properties

###  alive

• **alive**: *boolean*

Whether or not the entity is alive or removed.

___

###  id

• **id**: *number*

A unique ID for this entity.

## Methods

###  addComponent

▸ **addComponent**<**C**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹C›, `values?`: Partial‹Omit‹C, keyof Component<any>››): *this*

Add a component to the entity.

**Type parameters:**

▪ **C**: *[Component](component.md)‹any›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹C› | Type of component to add to this entity |
`values?` | Partial‹Omit‹C, keyof Component<any>›› | Optional values to replace the default attributes on the component  |

**Returns:** *this*

___

###  clone

▸ **clone**(): *this*

**Returns:** *this*

___

###  copy

▸ **copy**(`source`: this): *this*

**Parameters:**

Name | Type |
------ | ------ |
`source` | this |

**Returns:** *this*

___

###  getComponent

▸ **getComponent**<**C**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹C›, `includeRemoved?`: boolean): *Readonly‹C› | undefined*

Get an immutable reference to a component on this entity.

**Type parameters:**

▪ **C**: *[Component](component.md)‹any›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹C› | Type of component to get |
`includeRemoved?` | boolean | Whether a component that is staled to be removed should be also considered  |

**Returns:** *Readonly‹C› | undefined*

___

###  getComponentTypes

▸ **getComponentTypes**(): *Array‹[Component](component.md)‹any››*

Get a list of component types that have been added to this entity.

**Returns:** *Array‹[Component](component.md)‹any››*

___

###  getComponents

▸ **getComponents**(): *object*

Get an object containing all the components on this entity, where the object keys are the component types.

**Returns:** *object*

* \[ **componentName**: *string*\]: [Component](component.md)‹any›

___

###  getComponentsToRemove

▸ **getComponentsToRemove**(): *object*

Get an object containing all the components that are slated to be removed from this entity, where the object keys are the component types.

**Returns:** *object*

* \[ **componentName**: *string*\]: [Component](component.md)‹any›

___

###  getMutableComponent

▸ **getMutableComponent**<**C**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹C›): *C | undefined*

Get a mutable reference to a component on this entity.

**Type parameters:**

▪ **C**: *[Component](component.md)‹any›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹C› | Type of component to get  |

**Returns:** *C | undefined*

___

###  getRemovedComponent

▸ **getRemovedComponent**<**C**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹C›): *Readonly‹C› | undefined*

Get a component that is slated to be removed from this entity.

**Type parameters:**

▪ **C**: *[Component](component.md)‹any›*

**Parameters:**

Name | Type |
------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹C› |

**Returns:** *Readonly‹C› | undefined*

___

###  hasAllComponents

▸ **hasAllComponents**(`Components`: Array‹[ComponentConstructor](../interfaces/componentconstructor.md)‹any››): *boolean*

Check if the entity has all components in a list.

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Components` | Array‹[ComponentConstructor](../interfaces/componentconstructor.md)‹any›› | Component types to check  |

**Returns:** *boolean*

___

###  hasAnyComponents

▸ **hasAnyComponents**(`Components`: Array‹[ComponentConstructor](../interfaces/componentconstructor.md)‹any››): *boolean*

Check if the entity has any of the components in a list.

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Components` | Array‹[ComponentConstructor](../interfaces/componentconstructor.md)‹any›› | Component types to check  |

**Returns:** *boolean*

___

###  hasComponent

▸ **hasComponent**<**C**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹C›, `includeRemoved?`: boolean): *boolean*

Check if the entity has a component.

**Type parameters:**

▪ **C**: *[Component](component.md)‹any›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹C› | Type of component |
`includeRemoved?` | boolean | Whether a component that is staled to be removed should be also considered  |

**Returns:** *boolean*

___

###  hasRemovedComponent

▸ **hasRemovedComponent**<**C**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹C›): *boolean*

Check if the entity has a component that is slated to be removed.

**Type parameters:**

▪ **C**: *[Component](component.md)‹any›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹C› | Type of component  |

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

▸ **removeComponent**<**C**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹C›, `forceImmediate?`: boolean): *this*

Remove a component from the entity.

**Type parameters:**

▪ **C**: *[Component](component.md)‹any›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹C› | Type of component to remove from this entity |
`forceImmediate?` | boolean | Whether a component should be removed immediately  |

**Returns:** *this*

___

###  reset

▸ **reset**(): *void*

**Returns:** *void*
