
# ecsy

## Index

### Classes

* [Component](classes/component.md)
* [Entity](classes/entity.md)
* [System](classes/system.md)
* [SystemStateComponent](classes/systemstatecomponent.md)
* [TagComponent](classes/tagcomponent.md)
* [World](classes/world.md)

### Interfaces

* [ComponentConstructor](interfaces/componentconstructor.md)
* [SystemConstructor](interfaces/systemconstructor.md)
* [Types](interfaces/types.md)

### Functions

* [Not](README.md#not)
* [createComponentClass](README.md#createcomponentclass)
* [createType](README.md#createtype)

## Functions

###  Not

▸ **Not**<**T**>(`Component`: [ComponentConstructor](interfaces/componentconstructor.md)‹T›): *object*

Use the Not class to negate a component query.

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type |
------ | ------ |
`Component` | [ComponentConstructor](interfaces/componentconstructor.md)‹T› |

**Returns:** *object*

___

###  createComponentClass

▸ **createComponentClass**<**T**>(`schema`: object, `name`: string): *[ComponentConstructor](interfaces/componentconstructor.md)‹T›*

Create a component class from a schemaa.

**Type parameters:**

▪ **T**: *[Component](classes/component.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`schema` | object | An object that describes the schema of the component |
`name` | string | The name of the component  |

**Returns:** *[ComponentConstructor](interfaces/componentconstructor.md)‹T›*

___

###  createType

▸ **createType**(`typeDefinition`: object): *object*

Use createType to create custom type definitions.

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`typeDefinition` | object | An object with create, reset and clear functions for the custom type.  |

**Returns:** *object*
