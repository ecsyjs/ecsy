import { World } from '@ecs';

import {
  Collider,
  Collisionable,
  Moving,
  Object3D,
  PerformanceСompensation,
  PulsatingColor,
  PulsatingScale,
  Rotating,
} from './components';
import {
  ColliderSystem,
  MovingSystem,
  PulsatingColorSystem,
  PulsatingScaleSystem,
  RotatingSystem,
  TimeoutSystem,
} from './systems';

declare var BABYLON: any;

const world = new World();

world.systemManager
  .registerSystem(RotatingSystem)
  .registerSystem(PulsatingColorSystem)
  .registerSystem(PulsatingScaleSystem)
  .registerSystem(TimeoutSystem)
  .registerSystem(ColliderSystem)
  .registerSystem(MovingSystem);

const singletonEntity = world.createEntity()
  .addComponent(PerformanceСompensation);

const compensation = singletonEntity.getMutableComponent(PerformanceСompensation);

init();

function randomSpherePoint(radius) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);
  return { x, y, z };
}


function init() {
  const numObjects = 10000;
  const size = 0.2;

  const canvas = document.getElementById('renderCanvas');
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

  const scene = new BABYLON.Scene(engine);

  const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 5, -20), scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, false);

  const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);

  const objMoving = BABYLON.MeshBuilder.CreateIcoSphere('sphere', { subdivisions: 1 }, scene);
  let material = new BABYLON.StandardMaterial();
  material.diffuseColor.set(1, 1, 0);
  objMoving.material = material;

  const radius = 10;
  const entity = world.entityManager.createEntity();
  entity.addComponent(Collider);
  entity.addComponent(Object3D, { object: objMoving });
  entity.addComponent(Rotating, { rotatingSpeed: 0.5 });
  objMoving.setPivotMatrix(BABYLON.Matrix.Translation(0, 0, radius), false);

  const states = [];

  const rootMesh = BABYLON.MeshBuilder.CreateBox('box', { size }, scene);
  material = new BABYLON.StandardMaterial('material', scene);
  material.diffuseColor = new BABYLON.Color3(1, 1, 1);
  rootMesh.material = material;
  rootMesh.setEnabled(false);

  rootMesh.registerInstancedBuffer('color', 4);
  rootMesh.instancedBuffers.color = new BABYLON.Color4(1, 0, 0, 1);

  for (let i = 0; i < numObjects; i++) {
    const entity2 = world.entityManager.createEntity();

    const mesh = rootMesh.createInstance('box');
    mesh.instancedBuffers.color = new BABYLON.Color4(1, 0, 0, 1);
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.position.copyFrom(randomSpherePoint(radius));

    const state = {
      mesh,
      colliding: false,
      rotationSpeed: 0,
      originalColor: new BABYLON.Color4(1, 0, 0, 1),
      tmpColor: new BABYLON.Color4()
    };

    states.push(state);

    entity2.addComponent(Object3D, { object: mesh });
    entity2.addComponent(PulsatingColor, { offset: i });
    entity2.addComponent(PulsatingScale, { offset: i });

    if (Math.random() > 0.5) {
      entity2.addComponent(Moving, { offset: i });
    }

    entity2.addComponent(Collisionable);
  }

  scene.freezeActiveMeshes();

  window.addEventListener('resize', () => engine.resize());


  let lastTime = performance.now();

  engine.runRenderLoop(() => {
    compensation.time = performance.now() / 1000;
    compensation.delta = compensation.time - lastTime;
    lastTime = compensation.time;

    scene.render();

    world.run();
  });
}
