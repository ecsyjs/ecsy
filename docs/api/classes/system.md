
# Class: System

A system that manipulates entities in the world.

## Properties

###  enabled

• **enabled**: *boolean*

Whether the system will execute during the world tick.

___

### `Static` queries

▪ **queries**: *object*

Defines what Components the System will query for.
This needs to be user defined.

#### Type declaration:

* \[ **queryName**: *string*\]: object

* **components**: *[Component](component.md) | [NotComponent](../interfaces/notcomponent.md)[]*

* **listen**(): *object*

  * **added**? : *Boolean*

  * **changed**? : *Boolean | [Component](component.md)[]*

  * **removed**? : *Boolean*

## Methods

### `Abstract` execute

▸ **execute**(`delta`: number, `time`: number): *void*

This function is called for each run of world.
All of the `queries` defined on the class are available here.

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`delta` | number | - |
`time` | number |   |

**Returns:** *void*

___

###  play

▸ **play**(): *void*

Resume execution of this system.

**Returns:** *void*

___

###  stop

▸ **stop**(): *void*

Stop execution of this system.

**Returns:** *void*
