import test from 'ava';
import Entity from '../../src/Entity';
import {EntityManager} from '../../src/EntityManager';
import {FooComponent, BarComponent} from '../helpers/components';

test('entity', t => {
  var entityManager = new EntityManager();
  for (var i = 0; i < 10; i++) {
    entityManager.createEntity();
  }

  t.is(entityManager._entities.length, 10);
});

test('entity', t => {
  var entityManager = new EntityManager();
  for (var i = 0; i < 10; i++) {
    entityManager.createEntity();
  }

  t.is(entityManager._entities.length, 10);
});
