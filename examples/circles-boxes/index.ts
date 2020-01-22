import { SystemBase, World } from '@ecs';

const NUM_ELEMENTS = 600;
const SPEED_MULTIPLIER = 0.1;
const SHAPE_SIZE = 20;
const SHAPE_HALF_SIZE = SHAPE_SIZE / 2;

// Initialize canvas
const canvas = document.querySelector('canvas');
let canvasWidth = canvas.width = window.innerWidth;
let canvasHeight = canvas.height = window.innerHeight;
const ctx = canvas.getContext('2d');

window.addEventListener( 'resize', () => {
  canvasWidth = canvas.width = window.innerWidth
  canvasHeight = canvas.height = window.innerHeight;
}, false );

// ----------------------
// Components
// ----------------------

// Velocity component
class Velocity {
  x = 0;
  y = 0;

  reset() {
    this.x = this.y = 0;
  }
}

// Position component
class Position {
  x = 0;
  y = 0;

  reset() {
    this.x = this.y = 0;
  }
}

// Shape component
class Shape {
  primitive = 'box';

  reset() {
    this.primitive = 'box';
  }
}

// Renderable component
class Renderable {
  reset() {}
}

class PerformanceСompensation {
  delta = 0;
  time = 0;

  reset() {
    this.delta = this.time = 0;
  }
}

// ----------------------
// Systems
// ----------------------

// MovableSystem
class MovableSystem extends SystemBase {

  // Define a query of entities that have "Velocity" and "Position" components
  static systemData = {
    moving: {
      components: [Velocity, Position]
    },
    context: { components: [PerformanceСompensation], mandatory: true }
  }

  // This method will get called on every frame by default
  run() {
    const context = this.queries.context.results[0];
    const delta = context.getComponent(PerformanceСompensation).delta;
    // Iterate through all the entities on the query
    this.queries.moving.results.forEach(entity => {
      const velocity = entity.getComponent(Velocity);
      const position = entity.getMutableComponent(Position);

      position.x += velocity.x * delta;
      position.y += velocity.y * delta;

      if (position.x > canvasWidth + SHAPE_HALF_SIZE) position.x = - SHAPE_HALF_SIZE;
      if (position.x < - SHAPE_HALF_SIZE) position.x = canvasWidth + SHAPE_HALF_SIZE;
      if (position.y > canvasHeight + SHAPE_HALF_SIZE) position.y = - SHAPE_HALF_SIZE;
      if (position.y < - SHAPE_HALF_SIZE) position.y = canvasHeight + SHAPE_HALF_SIZE;
    });
  }
}



// RendererSystem
class RendererSystem extends SystemBase {

  // Define a query of entities that have "Renderable" and "Shape" components
  static systemData = {
    renderables: { components: [Renderable, Shape] }
  }

  // This method will get called on every frame by default
  run() {

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    // ctx.globalAlpha = 0.6;

    // Iterate through all the entities on the query
    this.queries.renderables.results.forEach(entity => {
      const shape = entity.getComponent(Shape);
      const position = entity.getComponent(Position);
      if (shape.primitive === 'box') {
        this.drawBox(position);
      } else {
        this.drawCircle(position);
      }
    });
  }

  drawCircle(position) {
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(position.x, position.y, SHAPE_HALF_SIZE, 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#222';
    ctx.stroke();
  }

  drawBox(position) {
   ctx.beginPath();
    ctx.rect(position.x - SHAPE_HALF_SIZE, position.y - SHAPE_HALF_SIZE, SHAPE_SIZE, SHAPE_SIZE);
    ctx.fillStyle= '#f28d89';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#800904';
    ctx.stroke();
  }
}

// Create world and register the systems on it
const world = new World();
world
  .registerSystem(MovableSystem)
  .registerSystem(RendererSystem);

// Used for singleton components
const singletonEntity = world.createEntity()
    .addComponent(PerformanceСompensation);

// Some helper functions when creating the components
function getRandomVelocity() {
  return {
    x: SPEED_MULTIPLIER * (2 * Math.random() - 1),
    y: SPEED_MULTIPLIER * (2 * Math.random() - 1)
  };
}

function getRandomPosition() {
  return {
    x: Math.random() * canvasWidth,
    y: Math.random() * canvasHeight
  };
}

function getRandomShape() {
   return {
     primitive: Math.random() >= 0.5 ? 'circle' : 'box'
   };
}

for (let i = 0; i < NUM_ELEMENTS; i++) {
  world
    .createEntity()
    .addComponent(Velocity, getRandomVelocity())
    .addComponent(Shape, getRandomShape())
    .addComponent(Position, getRandomPosition())
    .addComponent(Renderable)
}

const performanceСompensation = singletonEntity.getMutableComponent(PerformanceСompensation);

// Run!
function run() {
  // Compute delta and elapsed time
  const time = performance.now();
  performanceСompensation.delta = time - lastTime;

  // Run all the systems
  world.run();

  lastTime = time;
  requestAnimationFrame(run);
}

let lastTime = performance.now();
run();