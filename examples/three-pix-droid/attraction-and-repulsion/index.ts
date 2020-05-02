import './index.scss';

import { System, World } from '@ecs';

import { random } from './random';
import { Vector2 } from './math';
import { draw } from './create-circle';

const config = {
  dotMinRad: 6,
  dotMaxRad: 20,
  sphereRad: 350,
  bigDotRad: 35,
  mouseSize: 120,
  massFactor: 0.002,
  defColor: `rgba(250, 10, 30, 0.9)`,
  smooth: 0.85,
}

// Initialize canvas
const canvas = document.querySelector('canvas');
let canvasWidth = canvas.width = window.innerWidth;
let canvasHeight = canvas.height = window.innerHeight;
const ctx = canvas.getContext('2d');

window.addEventListener( 'resize', () => {
  canvasWidth = canvas.width = window.innerWidth
  canvasHeight = canvas.height = window.innerHeight;
}, false );

const gMouse = { x: 0, y: 0 };
let gDown;
function isDown() {
  gDown = !gDown;
}

canvas.addEventListener(`mousemove`, ({ x, y }) => {
  [gMouse.x, gMouse.y] = [x, y];
});
window.addEventListener(`mousedown`, isDown);
window.addEventListener(`mouseup`  , isDown);



// ----------------------
// Components
// ----------------------

// Velocity component
class Dot {
  pos = {x: 0, y: 0}
  vel = {x: 0, y: 0}
  rad = random(config.dotMinRad, config.dotMaxRad);
  mass = this.rad * config.massFactor;
  color = config.defColor;

  reset() {}
}

class MousePosition extends Vector2 {}

class MouseClick {
  down: boolean;
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

// UpdateDotsSystem
class UpdateDotsSystem extends System {

  // Define a query of entities that have "Velocity" and "Position" components
  static queries = {
    entities: { components: [Dot] },
    context: { components: [PerformanceСompensation], mandatory: true }
  }

  // This method will get called on every frame by default
  run() {
    // const delta = context.getComponent(PerformanceСompensation).delta;

    const entities = this.queries.entities.results;

    // Iterate through all the entities on the query
    for (let i = 1; i < entities.length; i++) {
      const acc = {x: 0, y: 0};
      const a = entities[i].getMutableComponent(Dot);

      for (let j = 0; j < entities.length; j++) {
        if (i === j) {
          continue;
        }

        const b = entities[j].getMutableComponent(Dot);

        const delta = {x: b.pos.x - a.pos.x, y: b.pos.y - a.pos.y}
        const dist = Math.sqrt( delta.x * delta.x + delta.y * delta.y) || 1;
        let force  = (dist - config.sphereRad) / dist * b.mass;

        if (j === 0) {
          const alpha = config.mouseSize / dist;
          a.color = `rgba(250, 10, 30, ${alpha})`;

          dist < config.mouseSize
            ? force = (dist - config.mouseSize) * b.mass
            : force = a.mass;
        }

        acc.x += delta.x * force;
        acc.y += delta.y * force;
      }

      a.vel.x = a.vel.x * config.smooth + acc.x * a.mass;
      a.vel.y = a.vel.y * config.smooth + acc.y * a.mass;
    }

  }
}

class AddDotsSystem extends System {
  static queries = {
    context: { components: [MouseClick, MousePosition], mandatory: true }
  };

  run() {
    const context = this.queries.context.results[0];
    const down = context.getComponent(MouseClick).down;
    const mouse = context.getComponent(MousePosition);

    if (down) {
      world.createEntity()
        .addComponent(Dot, { pos: { x: mouse.x, y: mouse.y } })
    }
  }
}

class UpadateMouseClickSystem extends System {
  static queries = {
    context: { components: [MouseClick], mandatory: true }
  };

  run() {
    const context = this.queries.context.results[0];
    const mouse = context.getMutableComponent(MouseClick);

    mouse.down = gDown;
  }
}

class UpadateMousePositionSystem extends System {
  static queries = {
    context: { components: [MousePosition], mandatory: true }
  };

  run() {
    const context = this.queries.context.results[0];
    const mouse = context.getMutableComponent(MousePosition);

    [mouse.x, mouse.y] = [gMouse.x, gMouse.y];
  }
}

export class RendererBackground extends System {

  run() {
    ctx.fillStyle = 'rgb(21, 25, 46)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
}

class RendererDotsSystem extends System {

  static queries = {
    entities: { components: [Dot] },
    context: { components: [MousePosition], mandatory: true }
  };

  createCircle = draw(ctx).createCircle;

  run() {
    const context = this.queries.context.results[0];
    const entities = this.queries.entities.results;

    const mouse = context.getComponent(MousePosition);

    for (let i = 0; i < entities.length; i++) {
      const dot = entities[i].getMutableComponent(Dot);

      if (i === 0) {
        dot.pos.x = mouse.x;
        dot.pos.y = mouse.y;
      } else {
        dot.pos.x = dot.pos.x + dot.vel.x;
        dot.pos.y = dot.pos.y + dot.vel.y;
      }

      this.createCircle(dot.pos.x, dot.pos.y, dot.rad, true, dot.color);
      this.createCircle(dot.pos.x, dot.pos.y, dot.rad, false, config.defColor);
    }
  }
}


// Create world and register the systems on it
const world = new World();
world
  .registerSystem(UpadateMousePositionSystem)
  .registerSystem(UpadateMouseClickSystem)
  .registerSystem(AddDotsSystem)
  .registerSystem(UpdateDotsSystem)
  .registerSystem(RendererBackground)
  .registerSystem(RendererDotsSystem);

// Used for singleton components
const singletonEntity = world.createEntity()
  .addComponent(PerformanceСompensation)
  .addComponent(MouseClick)
  .addComponent(MousePosition, { x: gMouse.x, y: gMouse.y });


world.createEntity()
  .addComponent(Dot, { rad: config.bigDotRad })

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