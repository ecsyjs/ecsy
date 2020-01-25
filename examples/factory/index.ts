import { Not, System, TagComponent, World } from '@ecs';

const textarea = document.querySelector('textarea');
function log(msg) {
  console.log(msg);
  textarea.innerHTML += msg + '\n';
}

const names = [ 'Isabel', 'Scot', 'Francene', 'Robert', 'Kizzie', 'Leroy', 'Layla', 'Stella', 'Marianela', 'Devorah'];
const sizes = [ 'XS', 'S', 'M', 'L', 'XL' ];
const colors = [ 'white', 'red', 'yellow', 'purple', 'pink', 'blue', 'cyan', 'black' ];

// Components
class NPC extends TagComponent {}

class Name {
  value = '';

  constructor() {
    this.reset();
  }

  reset() {
    this.value = '';
  }
}

class Tshirt {
  color = 'white';
  size = 'XL';

  constructor() {
    this.reset();
  }

  reset() {
    this.color = 'white';
    this.size = 'XL';
  }
}

export class PerformanceСompensation {
  delta: number;
  time: number;

  reset() {
    this.delta = 0;
    this.time = 0;
  }
}

// Systems
class NameSystem extends System {
  static queries = {
    entities: { components: [NPC, Not(Name)] }
  };

  run() {
    this.queries.entities.results.forEach(entity => {
      const name = randomFromArray(names);
      log(`Added name '${name}' to player id=${entity.id}`);
      entity.addComponent(Name, {value: name});
    });
  }
}

class TshirtSystem extends System {

  static queries = {
    entities: { components: [NPC, Not(Tshirt)] }
  };

  run() {
    this.queries.entities.results.forEach(entity => {
      const size = randomFromArray(sizes);
      const color = randomFromArray(colors);
      log(`Added '${color}' '${size}' tshirt to player id=${entity.id}`);
      entity.addComponent(Tshirt, {color, size});
    });
  }
}

// Initialize our world
const world = new World();

world
  .registerComponent(NPC)
  .registerComponent(Tshirt)
  .registerComponent(Name)
  .registerSystem(NameSystem)
  .registerSystem(TshirtSystem)

const singletonEntity = world.createEntity()
  .addComponent(PerformanceСompensation);

const compensation = singletonEntity.getMutableComponent(PerformanceСompensation);


// HTML Code to interact with the world

document.getElementById('createNPC').addEventListener('click', () => {
  const npc = world.createEntity();
  npc.addComponent(NPC);
  log(`> Created NPC, (id = ${npc.id})`);
});

document.getElementById('removeName').addEventListener('click', () => {
  const entity = randomEntity();
  if (!entity) return;
  log(`> Removing name '${entity.getComponent(Name).value}' from player id=${entity.id}`);
  entity.removeComponent(Name);
});

document.getElementById('removeTshirt').addEventListener('click', () => {
  const entity = randomEntity();
  if (!entity) return;
  const tshirt = entity.getComponent(Tshirt);
  log(`> Removing '${tshirt.color}' '${tshirt.size}' from player id=${entity.id}`);
  entity.removeComponent(Tshirt);
});

// Utils
function randomEntity() {
  return randomFromArray(world.entityManager.entities);
}

function randomFromArray(array) {
  const idx = Math.floor(Math.random() * array.length);
  return array[idx];
}


function animate() {
  compensation.time = performance.now();
  compensation.delta = compensation.time - lastTime;

  world.run();

  lastTime = compensation.time;
  requestAnimationFrame(animate);
}

let lastTime = performance.now();
animate();