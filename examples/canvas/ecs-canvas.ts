import { createComponentClass, createType, World } from '@ecs';

import {
  Acceleration,
  CanvasContext,
  Circle,
  DemoSettings,
  PerformanceСompensation,
  Position,
  Velocity,
} from './components';
import { Vector2 } from './math';
import { MovementSystem, IntersectionSystem, RendererCircles, RendererIntersecting, RendererBackground } from './systems';
import { random } from './utils';

export class EcsCanvas {

  renderer = {
    createElement: <K extends keyof HTMLElementTagNameMap>(tagName: K, options?: ElementCreationOptions) =>
      document.createElement(tagName, options),
    appendChild: (parent: Node, newChild: Node) => parent.appendChild(newChild),
  };

  elementRef = {
    nativeElement: document.body,
  };

  constructor() {}

  run() {
    const world = new World();

    const CustomVector2 = createType({
      baseType: Vector2,
      create: (defaultValue) => defaultValue
        ? new Vector2(defaultValue)
        : new Vector2(),
      reset: (src, key, defaultValue) => defaultValue
        ? src[key].copy(defaultValue)
        : src[key].set(0, 0),
      clear: (src, key) => src[key].set(0, 0),
    });

    const ExampleComponent = createComponentClass({
      number:  { default: 0.5 },
      string:  { default: 'foo' },
      bool:    { default: true },
      array:   { default: [1, 2, 3] },
      vector2: { default: new Vector2(3, 4), type: CustomVector2 }
    }, 'ExampleComponent');

    console.log(`ExampleComponent :::::::`);
    console.dir(ExampleComponent);
    console.log(new ExampleComponent());

    world
      // .registerComponent(Circle)
      // .registerComponent(Velocity)
      // .registerComponent(Acceleration)
      // .registerComponent(Position)
      // .registerComponent(Intersecting)
      .registerSystem(MovementSystem)
      .registerSystem(IntersectionSystem)
      .registerSystem(RendererBackground)
      .registerSystem(RendererCircles)
      .registerSystem(RendererIntersecting)
      ;

    // Used for singleton components
    const singletonEntity = world.createEntity()
        .addComponent(PerformanceСompensation)
        .addComponent(CanvasContext)
        .addComponent(DemoSettings);

    const canvas: HTMLCanvasElement = this.renderer.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    this.renderer.appendChild(this.elementRef.nativeElement, canvas);

    const canvasComponent = singletonEntity.getMutableComponent(CanvasContext);
    canvasComponent.ctx = canvas.getContext('2d');
    canvasComponent.width = canvas.width;
    canvasComponent.height = canvas.height;

    for (let i = 0; i < 100; i++) {
      world.createEntity()
        .addComponent(Circle, { radius: random(10, 50) })
        .addComponent(Velocity, {
          x: random(-200, 200),
          y: random(-200, 200),
        })
        .addComponent(Acceleration)
        .addComponent(Position, {
          x: random(0, canvas.width),
          y: random(0, canvas.height),
        });
    }

    window.addEventListener('resize', () => {
      canvasComponent.width = canvas.width = window.innerWidth;
      canvasComponent.height = canvas.height = window.innerHeight;
    }, false );

    const performanceСompensation = singletonEntity.getMutableComponent(PerformanceСompensation);

    let lastTime = performance.now();

    let timeOut = 0;

    const update = () => {

      const time = performance.now();
      performanceСompensation.delta = time - lastTime;
      lastTime = time;

      world.run();

      requestAnimationFrame(update);
      if (timeOut > 0) {
        timeOut--;
      }

    };

    update();


    console.log(`world`, world);
  }
}
