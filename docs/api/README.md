
# ecsy - v0.4.3

## Type aliases

###  ArrayPropType

Ƭ **ArrayPropType**: *[PropType](interfaces/proptype.md)‹Array‹T›, []›*

___

###  BooleanPropType

Ƭ **BooleanPropType**: *[PropType](interfaces/proptype.md)‹boolean, boolean›*

___

###  ComponentSchema

Ƭ **ComponentSchema**: *object*

#### Type declaration:

* \[ **propName**: *string*\]: [ComponentSchemaProp](README.md#componentschemaprop)

___

###  ComponentSchemaProp

Ƭ **ComponentSchemaProp**: *object*

Base class for components.

#### Type declaration:

* **default**? : *any*

* **type**: *[PropType](interfaces/proptype.md)‹any, any›*

___

###  JSONPropType

Ƭ **JSONPropType**: *[PropType](interfaces/proptype.md)‹any, null›*

___

###  NumberPropType

Ƭ **NumberPropType**: *[PropType](interfaces/proptype.md)‹number, number›*

___

###  RefPropType

Ƭ **RefPropType**: *[PropType](interfaces/proptype.md)‹T, undefined›*

___

###  StringPropType

Ƭ **StringPropType**: *[PropType](interfaces/proptype.md)‹string, string›*

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

• **Types**: *object*

#### Type declaration:

* **Array**: *[ArrayPropType](README.md#arrayproptype)‹any›*

* **Boolean**: *[BooleanPropType](README.md#booleanproptype)*

* **JSON**: *[JSONPropType](README.md#jsonproptype)*

* **Number**: *[NumberPropType](README.md#numberproptype)*

* **Ref**: *[RefPropType](README.md#refproptype)‹any›*

* **String**: *[StringPropType](README.md#stringproptype)*

## Functions

###  Not

▸ **Not**<**C**>(`Component`: [ComponentConstructor](interfaces/componentconstructor.md)‹C›): *[NotComponent](interfaces/notcomponent.md)‹C›*

Use the Not class to negate a component query.

**Type parameters:**

▪ **C**: *[Component](classes/component.md)‹any›*

**Parameters:**

Name | Type |
------ | ------ |
`Component` | [ComponentConstructor](interfaces/componentconstructor.md)‹C› |

**Returns:** *[NotComponent](interfaces/notcomponent.md)‹C›*

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

▸ **createType**<**T**, **D**>(`typeDefinition`: [PropTypeDefinition](interfaces/proptypedefinition.md)‹T, D›): *[PropType](interfaces/proptype.md)‹T, D›*

Use createType to create custom type definitions.

**Type parameters:**

▪ **T**

▪ **D**

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`typeDefinition` | [PropTypeDefinition](interfaces/proptypedefinition.md)‹T, D› | An object with create, reset and clear functions for the custom type.  |

**Returns:** *[PropType](interfaces/proptype.md)‹T, D›*
