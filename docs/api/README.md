
# ecsy - v0.2.6

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

▸ (`src`: [Component](classes/component.md)‹any›, `dest`: [Component](classes/component.md)‹any›, `key`: string): *T*

**Parameters:**

Name | Type |
------ | ------ |
`src` | [Component](classes/component.md)‹any› |
`dest` | [Component](classes/component.md)‹any› |
`key` | string |

## Variables

### `Const` Types

• **Types**: *[PropTypes](interfaces/proptypes.md)*

## Functions

###  Not

▸ **Not**(`Component`: [ComponentConstructor](interfaces/componentconstructor.md)‹any, any›): *[NotComponent](interfaces/notcomponent.md)*

Use the Not class to negate a component query.

**Parameters:**

Name | Type |
------ | ------ |
`Component` | [ComponentConstructor](interfaces/componentconstructor.md)‹any, any› |

**Returns:** *[NotComponent](interfaces/notcomponent.md)*

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

▸ **copyArray**<**T**>(`src`: [Component](classes/component.md)‹any›, `dest`: [Component](classes/component.md)‹any›, `key`: string): *Array‹T›*

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type |
------ | ------ |
`src` | [Component](classes/component.md)‹any› |
`dest` | [Component](classes/component.md)‹any› |
`key` | string |

**Returns:** *Array‹T›*

___

###  copyCopyable

▸ **copyCopyable**<**T**>(`src`: [Component](classes/component.md)‹any›, `dest`: [Component](classes/component.md)‹any›, `key`: string): *T*

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type |
------ | ------ |
`src` | [Component](classes/component.md)‹any› |
`dest` | [Component](classes/component.md)‹any› |
`key` | string |

**Returns:** *T*

___

###  copyJSON

▸ **copyJSON**(`src`: [Component](classes/component.md)‹any›, `dest`: [Component](classes/component.md)‹any›, `key`: string): *any*

**Parameters:**

Name | Type |
------ | ------ |
`src` | [Component](classes/component.md)‹any› |
`dest` | [Component](classes/component.md)‹any› |
`key` | string |

**Returns:** *any*

___

###  copyValue

▸ **copyValue**<**T**>(`src`: [Component](classes/component.md)‹any›, `dest`: [Component](classes/component.md)‹any›, `key`: string): *T*

**Type parameters:**

▪ **T**

**Parameters:**

Name | Type |
------ | ------ |
`src` | [Component](classes/component.md)‹any› |
`dest` | [Component](classes/component.md)‹any› |
`key` | string |

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
