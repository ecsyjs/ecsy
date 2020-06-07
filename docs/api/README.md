
# ecsy - v0.2.5

## Functions

###  Not

▸ **Not**<**T**>(`Component`: [ComponentConstructor](interfaces/componentconstructor.md)‹T›): *[NotComponent](interfaces/notcomponent.md)*

Use the Not class to negate a component query.

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type |
------ | ------ |
`Component` | [ComponentConstructor](interfaces/componentconstructor.md)‹T› |

**Returns:** *[NotComponent](interfaces/notcomponent.md)*

___

###  createComponentClass

▸ **createComponentClass**<**T**>(`schema`: object, `name`: string): *[ComponentConstructor](interfaces/componentconstructor.md)‹T›*

Create a component class from a schema.

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
