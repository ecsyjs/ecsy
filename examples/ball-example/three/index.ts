import './index.scss';

import { World } from '@ecs';

import {
  Collidable,
  Collider,
  Colliding,
  Moving,
  Object3D,
  PerformanceСompensation,
  PulsatingColor,
  PulsatingScale,
  Recovering,
  Rotating,
  Timeout,
} from './components';
import {
  ColliderSystem,
  MovingSystem,
  PulsatingColorSystem,
  PulsatingScaleSystem,
  RotatingSystem,
  TimeoutSystem,
} from './systems';

declare var THREE: any;

const world = new World();

world
  .registerSystem(RotatingSystem)
  .registerSystem(PulsatingColorSystem)
  .registerSystem(PulsatingScaleSystem)
  .registerSystem(TimeoutSystem)
  .registerSystem(ColliderSystem)
  .registerSystem(MovingSystem);

world
  .registerComponent(Object3D)
  .registerComponent(Collidable)
  .registerComponent(Collider)
  .registerComponent(Recovering)
  .registerComponent(Moving)
  .registerComponent(PulsatingScale)
  .registerComponent(Timeout)
  .registerComponent(PulsatingColor)
  .registerComponent(Colliding)
  .registerComponent(Rotating);

const singletonEntity = world.createEntity()
  .addComponent(PerformanceСompensation);

const performanceСompensation = singletonEntity.getMutableComponent(PerformanceСompensation);

let camera;
let scene;
let renderer;
let parent;
const clock = new THREE.Clock();

init();

function randomSpherePoint(radius) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);
  return new THREE.Vector3(x,y,z);
}

let objMoving;
let states;

function init() {
  const numObjects = 10000;
  const size = 0.2;
  const w = 100;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera( 80, window.innerWidth / window.innerHeight, 0.005, 10000 );
  camera.position.z = 20;

  parent = new THREE.Object3D();


  const geometry = new THREE.IcosahedronGeometry( 1 );
  const material = new THREE.MeshStandardMaterial({color: '#ff0'});
  const parent2 = new THREE.Object3D();

  objMoving = new THREE.Mesh( geometry, material );
  objMoving.position.set(0,0,0);
  const radius = 10;

  let entity = world.createEntity();
  objMoving.position.set(0,0,radius);
  entity.addComponent(Collider);
  entity.addComponent(Object3D, {object: objMoving});

  entity = world.createEntity();
  parent2.add(objMoving);
  entity.addComponent(Rotating, {rotatingSpeed: 0.5})
        .addComponent(Object3D, {object: parent2});
  parent.add(parent2);

  states = [];

  const ambientLight = new THREE.AmbientLight( 0xcccccc );
  scene.add( ambientLight );

  const directionalLight = new THREE.DirectionalLight( 0xffffff, 2 );
  directionalLight.position.set( 1, 1, 0.5 ).normalize();
  scene.add( directionalLight );

  const geometry2 = new THREE.BoxBufferGeometry( size, size, size );

  for (let i = 0;i < numObjects; i++) {

    const material2 = new THREE.MeshStandardMaterial({color: new THREE.Color(1,0,0)});
    const mesh = new THREE.Mesh( geometry2, material2 );
    mesh.position.copy(randomSpherePoint(radius));

    const state = {
      mesh,
      colliding: false,
      rotationSpeed: 0,
      originalColor: material2.color.clone(),
      tmpColor: new THREE.Color()
    };

    states.push(state);

    const entity2 = world.createEntity();
    entity2.addComponent(Object3D, {object: mesh});
    entity2.addComponent(PulsatingColor, {offset: i});
    entity2.addComponent(PulsatingScale, {offset: i});

    if (Math.random() > 0.5) {
      entity2.addComponent(Moving, {offset: i});
    }

    entity2.addComponent(Collidable);
    parent.add( mesh );
  }

  scene.add( parent );

  renderer = new THREE.WebGLRenderer();
  renderer.setClearColor( 0x333333 );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );
  //
  window.addEventListener( 'resize', onWindowResize, false );

  renderer.setAnimationLoop(animate);

}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
  performanceСompensation.delta = clock.getDelta();
  performanceСompensation.time = clock.elapsedTime;
  // console.time('render');
  world.run();
  // console.timeEnd('render');

  renderer.render( scene, camera );
}