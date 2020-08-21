
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

###  priority

• **priority**: *number*

Execution priority (i.e: order) of the system.

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

### `Static` isSystem

▪ **isSystem**: *true*

___

### `Static` queries

▪ **queries**: *[SystemQueries](../interfaces/systemqueries.md)*

Defines what Components the System will query for.
This needs to be user defined.

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

###  init

▸ **init**(`attributes?`: [Attributes](../interfaces/attributes.md)): *void*

Called when the system is added to the world.

**Parameters:**

Name | Type |
------ | ------ |
`attributes?` | [Attributes](../interfaces/attributes.md) |

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
