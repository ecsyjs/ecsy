
# Class: System

A system that manipulates entities in the world.

## Constructors

###  constructor

\+ **new System**(`world`: [World](world.md), `attributes?`: [Attributes](../interfaces/attributes.md)): *[System](system.md)*

**Parameters:**

Name | Type |
------ | ------ |
`world` | [World](world.md) |
`attributes?` | [Attributes](../interfaces/attributes.md) |

**Returns:** *[System](system.md)*

## Properties

###  enabled

• **enabled**: *boolean*

Whether the system will execute during the world tick.

___

###  queries

• **queries**: *object*

The results of the queries.
Should be used inside of execute.

#### Type declaration:

* \[ **queryName**: *string*\]: object

* **added**? : *[Entity](entity.md)[]*

* **changed**? : *[Entity](entity.md)[]*

* **removed**? : *[Entity](entity.md)[]*

* **results**: *[Entity](entity.md)[]*

___

###  world

• **world**: *[World](world.md)*

___

### `Static` queries

▪ **queries**: *object*

Defines what Components the System will query for.
This needs to be user defined.

#### Type declaration:

* \[ **queryName**: *string*\]: object

* **components**: *[Component](component.md)‹› | [NotComponent](../interfaces/notcomponent.md) | [TagComponent](tagcomponent.md)‹›[]*

* **listen**(): *object*

  * **added**? : *boolean*

  * **changed**? : *boolean | [Component](component.md)[]*

  * **removed**? : *boolean*

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
