
# Class: World

The World is the root of the ECS.

## Constructors

###  constructor

\+ **new World**(`options?`: [WorldOptions](../interfaces/worldoptions.md)): *[World](world.md)*

Create a new World.

**Parameters:**

Name | Type |
------ | ------ |
`options?` | [WorldOptions](../interfaces/worldoptions.md) |

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

▸ **execute**(`delta?`: number, `time?`: number): *void*

Update the systems per frame.

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`delta?` | number | Delta time since the last call |
`time?` | number | Elapsed time  |

**Returns:** *void*

___

###  getSystem

▸ **getSystem**<**S**>(`System`: [SystemConstructor](../interfaces/systemconstructor.md)‹S›): *S*

Get a system registered in this world.

**Type parameters:**

▪ **S**: *[System](system.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`System` | [SystemConstructor](../interfaces/systemconstructor.md)‹S› | Type of system to get.  |

**Returns:** *S*

___

###  getSystems

▸ **getSystems**(): *Array‹[System](system.md)›*

Get a list of systems registered in this world.

**Returns:** *Array‹[System](system.md)›*

___

###  hasRegisteredComponent

▸ **hasRegisteredComponent**<**C**>(`Component`: [Component](component.md)‹C›): *boolean*

Evluate whether a component has been registered to this world or not.

**Type parameters:**

▪ **C**: *[Component](component.md)‹any›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [Component](component.md)‹C› | Type of component to to evaluate  |

**Returns:** *boolean*

___

###  play

▸ **play**(): *void*

Resume execution of this world.

**Returns:** *void*

___

###  registerComponent

▸ **registerComponent**<**C**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹C›, `objectPool?`: [ObjectPool](objectpool.md)‹C› | false): *this*

Register a component.

**Type parameters:**

▪ **C**: *[Component](component.md)‹any›*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹C› | Type of component to register  |
`objectPool?` | [ObjectPool](objectpool.md)‹C› &#124; false | - |

**Returns:** *this*

___

###  registerSystem

▸ **registerSystem**(`System`: [SystemConstructor](../interfaces/systemconstructor.md)‹any›, `attributes?`: object): *this*

Register a system.

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`System` | [SystemConstructor](../interfaces/systemconstructor.md)‹any› | Type of system to register  |
`attributes?` | object | - |

**Returns:** *this*

___

###  stop

▸ **stop**(): *void*

Stop execution of this world.

**Returns:** *void*

___

###  unregisterSystem

▸ **unregisterSystem**(`System`: [SystemConstructor](../interfaces/systemconstructor.md)‹any›): *this*

Unregister a system.

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`System` | [SystemConstructor](../interfaces/systemconstructor.md)‹any› | Type of system to unregister  |

**Returns:** *this*
