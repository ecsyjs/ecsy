
# Class: TagComponent

Create components that extend TagComponent in order to take advantage of performance optimizations for components
that do not store data

## Constructors

###  constructor

\+ **new TagComponent**(`props?`: Partial‹Omit‹__type, keyof Component<any>›› | false): *[TagComponent](tagcomponent.md)*

*Inherited from [Component](component.md).[constructor](component.md#constructor)*

**Parameters:**

Name | Type |
------ | ------ |
`props?` | Partial‹Omit‹__type, keyof Component<any>›› &#124; false |

**Returns:** *[TagComponent](tagcomponent.md)*

## Properties

### `Static` isComponent

▪ **isComponent**: *true*

*Inherited from [Component](component.md).[isComponent](component.md#static-iscomponent)*

___

### `Static` isTagComponent

▪ **isTagComponent**: *true*

___

### `Static` schema

▪ **schema**: *[ComponentSchema](../README.md#componentschema)*

*Inherited from [Component](component.md).[schema](component.md#static-schema)*

## Methods

###  clone

▸ **clone**(): *this*

*Inherited from [Component](component.md).[clone](component.md#clone)*

**Returns:** *this*

___

###  copy

▸ **copy**(`source`: this): *this*

*Inherited from [Component](component.md).[copy](component.md#copy)*

**Parameters:**

Name | Type |
------ | ------ |
`source` | this |

**Returns:** *this*

___

###  dispose

▸ **dispose**(): *void*

*Inherited from [Component](component.md).[dispose](component.md#dispose)*

**Returns:** *void*

___

###  reset

▸ **reset**(): *void*

*Inherited from [Component](component.md).[reset](component.md#reset)*

**Returns:** *void*
