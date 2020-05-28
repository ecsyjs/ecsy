
# Class: World

The World is the root of the ECS.

## Constructors

###  constructor

\+ **new World**(`options?`: [Options](../interfaces/options.md)): *[World](world.md)*

Create a new World.

**Parameters:**

Name | Type |
------ | ------ |
`options?` | [Options](../interfaces/options.md) |

**Returns:** *[World](world.md)*

## Properties

###  enabled

• **enabled**: *boolean*

Whether the world tick should execute.

## Methods

###  createEntity

▸ **createEntity**(`name?`: string): *[Entity](entity.md)*

Create a new entity

**Parameters:**

Name | Type |
------ | ------ |
`name?` | string |

**Returns:** *[Entity](entity.md)*

___

###  execute

▸ **execute**(`delta`: number, `time`: number): *void*

Update the systems per frame.

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`delta` | number | Delta time since the last call |
`time` | number | Elapsed time  |

**Returns:** *void*

___

###  getSystem

▸ **getSystem**<**T**>(`System`: [SystemConstructor](../interfaces/systemconstructor.md)‹T›): *[System](system.md)*

Get a system registered in this world.

**Type parameters:**

▪ **T**: *[System](system.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`System` | [SystemConstructor](../interfaces/systemconstructor.md)‹T› | Type of system to get.  |

**Returns:** *[System](system.md)*

___

###  getSystems

▸ **getSystems**(): *Array‹[System](system.md)›*

Get a list of systems registered in this world.

**Returns:** *Array‹[System](system.md)›*

___

###  play

▸ **play**(): *void*

Resume execution of this world.

**Returns:** *void*

___

###  registerComponent

▸ **registerComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›): *this*

Register a component.

**Type parameters:**

▪ **T**: *[Component](component.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› | Type of component to register  |

**Returns:** *this*

___

###  registerSystem

▸ **registerSystem**<**T**>(`System`: [SystemConstructor](../interfaces/systemconstructor.md)‹T›, `attributes?`: object): *this*

Register a system.

**Type parameters:**

▪ **T**: *[System](system.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`System` | [SystemConstructor](../interfaces/systemconstructor.md)‹T› | Type of system to register  |
`attributes?` | object | - |

**Returns:** *this*

___

###  stop

▸ **stop**(): *void*

Stop execution of this world.

**Returns:** *void*
