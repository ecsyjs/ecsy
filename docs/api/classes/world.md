
# Class: World

The World is the root of the ECS.

## Constructors

###  constructor

\+ **new World**(): *[World](world.md)*

Create a new World.

**Returns:** *[World](world.md)*

## Methods

###  createEntity

▸ **createEntity**(): *[Entity](entity.md)*

Create a new entity

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

▸ **registerSystem**<**T**>(`System`: [SystemConstructor](../interfaces/systemconstructor.md)‹T›): *this*

Register a system.

**Type parameters:**

▪ **T**: *[System](system.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`System` | [SystemConstructor](../interfaces/systemconstructor.md)‹T› | Type of system to register  |

**Returns:** *this*

___

###  stop

▸ **stop**(): *void*

Stop execution of this world.

**Returns:** *void*
