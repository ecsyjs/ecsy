import { Component } from "../../src/Component";
import { Entity } from "../../src/Entity";
import { SystemStateComponent } from "../../src/SystemStateComponent";
import { TagComponent } from "../../src/TagComponent";
import { Types } from "../../src/Types";
import { World } from "../../src/World";

// COMPONENT
class Position extends Component<{ x: number; y: number }> {}
Position.isComponent;
Position.schema = {
  x: { type: Types.Number },
  y: { type: Types.Number },
};

const position = new Position();
position.x;
position.y;

const position2 = new Position({ x: 5, y: 9 });
position2.clone();

// TAG COMPONENT
class TestTagComponent extends TagComponent {}
TestTagComponent.isTagComponent;

const testTagComponent = new TestTagComponent();
TestTagComponent.isComponent;
testTagComponent.clone();

// SYSTEM STATE COMPONENT
class SystemComponent extends SystemStateComponent<{ foo: boolean }> {}
SystemComponent.isComponent;
SystemComponent.isSystemStateComponent;

SystemComponent.schema = {
  foo: { type: Types.Boolean },
};

const sComponent = new SystemComponent({ foo: true });
sComponent.foo;
sComponent.clone();

// WORLD
const world = new World();
world.registerComponent(Position);
world.hasRegisteredComponent(Position);

// ENTITY

const entity = new Entity();

entity.addComponent(Position);

const entityPosition = entity.getComponent(Position, true);
entityPosition?.x;

entity.hasAllComponents([Position]);
entity.hasAnyComponents([Position]);
entity.hasComponent(Position);
entity.hasRemovedComponent(Position);

entity.removeComponent(Position);
const removedEntityPosition = entity.getRemovedComponent(Position);
const allComponentsToRemove = entity.getComponentsToRemove();

const allComponents = entity.getComponents();
const allComponentTyes = entity.getComponentTypes();

const entityMutablePosition = entity.getMutableComponent(Position);
entityMutablePosition.x = 54;

entity.removeAllComponents();
entity.clone();
