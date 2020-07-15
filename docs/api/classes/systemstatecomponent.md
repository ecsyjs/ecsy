
# Class: SystemStateComponent <**C**>

Components that extend the SystemStateComponent are not removed when an entity is deleted.

## Type parameters

▪ **C**

## Constructors

###  constructor

\+ **new SystemStateComponent**(`props?`: Partial‹Omit‹C, keyof Component<any>›› | false): *[SystemStateComponent](systemstatecomponent.md)*

*Inherited from [Component](component.md).[constructor](component.md#constructor)*

**Parameters:**

Name | Type |
------ | ------ |
`props?` | Partial‹Omit‹C, keyof Component<any>›› &#124; false |

**Returns:** *[SystemStateComponent](systemstatecomponent.md)*

## Properties

### `Static` isComponent

▪ **isComponent**: *true*

*Inherited from [Component](component.md).[isComponent](component.md#static-iscomponent)*

___

### `Static` isSystemStateComponent

▪ **isSystemStateComponent**: *true*

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
