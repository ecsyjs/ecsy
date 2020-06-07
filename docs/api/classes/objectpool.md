
# Class: ObjectPool <**T**>

## Type parameters

▪ **T**

## Constructors

###  constructor

\+ **new ObjectPool**(`baseObject`: object, `initialSize?`: number): *[ObjectPool](objectpool.md)*

**Parameters:**

▪ **baseObject**: *object*

Name | Type |
------ | ------ |
`constructor` |  |

▪`Optional`  **initialSize**: *number*

**Returns:** *[ObjectPool](objectpool.md)*

## Methods

###  acquire

▸ **acquire**(): *T*

**Returns:** *T*

___

###  expand

▸ **expand**(`count`: number): *void*

**Parameters:**

Name | Type |
------ | ------ |
`count` | number |

**Returns:** *void*

___

###  release

▸ **release**(`item`: T): *void*

**Parameters:**

Name | Type |
------ | ------ |
`item` | T |

**Returns:** *void*

___

###  totalFree

▸ **totalFree**(): *number*

**Returns:** *number*

___

###  totalSize

▸ **totalSize**(): *number*

**Returns:** *number*

___

###  totalUsed

▸ **totalUsed**(): *number*

**Returns:** *number*
