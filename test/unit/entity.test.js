import test from 'ava';
import Entity from '../../src/Entity';
import {EntityManager} from '../../src/EntityManager';
import {FooComponent, BarComponent} from '../helpers/components';

test('entity id', t => {
  var entities = [];
  for (var i = 0; i < 10; i++) {
    entities.push(new Entity());
  }

  for (var i = 0; i < 10; i++) {
    t.is(entities[i].id, i);
  }
});

test('adding components', async t => {
  var entityManager = new EntityManager();

  var entity = new Entity(entityManager);
  entity.addComponent(FooComponent);

  t.is(entity.Components.length, 1);
  t.true(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));

  entity.addComponent(BarComponent);
  t.is(entity.Components.length, 2);
  t.true(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(BarComponent));
  t.true(entity.hasAllComponents([FooComponent, BarComponent]));

  entity.removeComponent(FooComponent);
  t.is(entity.Components.length, 1);
  t.false(entity.hasComponent(FooComponent));
  t.true(entity.hasComponent(BarComponent));
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));

  entity.addComponent(FooComponent);
  entity.removeAllComponents();
  t.is(entity.Components.length, 0);
  t.false(entity.hasComponent(FooComponent));
  t.false(entity.hasComponent(BarComponent));
  t.false(entity.hasAllComponents([FooComponent, BarComponent]));

});

// Entity created directly without using entityManager.createEntity()
test('dispose entity', async t => {
  var entityManager = new EntityManager();

  var entity = new Entity(entityManager);
  entity.addComponent(FooComponent);

  const error = t.throws(() => {
    entity.dispose();
  }, Error);

  t.is(error.message, 'Tried to remove entity not in list');
});
