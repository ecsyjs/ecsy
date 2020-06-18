
# @ecsy/core - v0.2.6

## Type aliases

###  ComponentProps

Ƭ **ComponentProps**: *P | false*

Base class for components.

___

###  ComponentSchema

Ƭ **ComponentSchema**: *object*

#### Type declaration:

* \[ **propName**: *string*\]: [ComponentSchemaProp](README.md#componentschemaprop)‹any›

___

###  ComponentSchemaProp

Ƭ **ComponentSchemaProp**: *object*

#### Type declaration:

* **default**? : *T*

* **type**: *[PropType](interfaces/proptype.md)‹T›*

___

###  TypeCloneFunction

Ƭ **TypeCloneFunction**: *function*

#### Type declaration:

▸ (`value`: T): *T*

**Parameters:**

Name | Type |
------ | ------ |
`value` | T |

___

###  TypeCopyFunction

Ƭ **TypeCopyFunction**: *function*

#### Type declaration:

▸ (`src`: T, `dest`: T): *T*

**Parameters:**

Name | Type |
------ | ------ |
`src` | T |
`dest` | T |

## Variables

### `Const` Types

• **Types**: *[PropTypes](interfaces/proptypes.md)*

## Functions

###  Not

▸ **Not**<**P**, **C**>(`Component`: [ComponentConstructor](interfaces/componentconstructor.md)‹P, C›): *[NotComponent](interfaces/notcomponent.md)‹P, C›*

Use the Not class to negate a component query.

**Type parameters:**

▪ **P**

▪ **C**: *[Component](classes/component.md)‹P›*

**Parameters:**

Name | Type |
------ | ------ |
`Component` | [ComponentConstructor](interfaces/componentconstructor.md)‹P, C› |

**Returns:** *[NotComponent](interfaces/notcomponent.md)‹P, C›*

___

###  cloneArray

▸ **cloneArray**<**T**>(`value`: Array‹T›): *Array‹T›*

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type |
------ | ------ |
`value` | Array‹T› |

**Returns:** *Array‹T›*

___

###  cloneClonable

▸ **cloneClonable**<**T**>(`value`: T): *T*

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type |
------ | ------ |
`value` | T |

**Returns:** *T*

___

###  cloneJSON

▸ **cloneJSON**(`value`: any): *any*

**Parameters:**

Name | Type |
------ | ------ |
`value` | any |

**Returns:** *any*

___

###  cloneValue

▸ **cloneValue**<**T**>(`value`: T): *T*

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type |
------ | ------ |
`value` | T |

**Returns:** *T*

___

###  copyArray

▸ **copyArray**<**T**>(`src`: T, `dest`: T): *Array‹T›*

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type |
------ | ------ |
`src` | T |
`dest` | T |

**Returns:** *Array‹T›*

___

###  copyCopyable

▸ **copyCopyable**<**T**>(`src`: T, `dest`: T): *T*

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type |
------ | ------ |
`src` | T |
`dest` | T |

**Returns:** *T*

___

###  copyJSON

▸ **copyJSON**(`src`: any, `dest`: any): *any*

**Parameters:**

Name | Type |
------ | ------ |
`src` | any |
`dest` | any |

**Returns:** *any*

___

###  copyValue

▸ **copyValue**<**T**>(`src`: T, `dest`: T): *T*

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type |
------ | ------ |
`src` | T |
`dest` | T |

**Returns:** *T*

___

###  createType

▸ **createType**<**T**>(`typeDefinition`: [PropTypeDefinition](interfaces/proptypedefinition.md)‹T›): *[PropType](interfaces/proptype.md)‹T›*

Use createType to create custom type definitions.

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`typeDefinition` | [PropTypeDefinition](interfaces/proptypedefinition.md)‹T› | An object with create, reset and clear functions for the custom type.  |

**Returns:** *[PropType](interfaces/proptype.md)‹T›*
