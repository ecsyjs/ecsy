import { System } from '@ecs';

import { CanvasContext, Circle, Intersecting, Position } from '../components';
import { drawLine, fillCircle } from '../utils';

export class RendererBackground implements System {
  static queries = {
    context: { components: [CanvasContext], mandatory: true }
  };

  enabled = true;
  initialized = true;

  queriesOther = {};
  queries: any = {};

  mandatoryQueries = [];

  run() {

    const context = this.queries.context.results[0];
    const canvasComponent = context.getComponent(CanvasContext);
    const ctx: CanvasRenderingContext2D = canvasComponent.ctx;
    const canvasWidth = canvasComponent.width;
    const canvasHeight = canvasComponent.height;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  play() {
    this.enabled = true;
  }

  stop() {
    this.enabled = false;
  }
}

export class RendererCircles implements System {

  static queries = {
    circles: { components: [Circle, Position] },
    context: { components: [CanvasContext], mandatory: true }
  };

  enabled = true;
  initialized = true;

  queriesOther = {};
  queries: any = {};

  mandatoryQueries = [];

  run() {

    const context = this.queries.context.results[0];
    const canvasComponent = context.getComponent(CanvasContext);
    const ctx: CanvasRenderingContext2D = canvasComponent.ctx;

    const circles = this.queries.circles.results;

    for (const circle of circles) {
      const component = circle.getComponent(Circle);
      const position = circle.getMutableComponent(Position);

      ctx.beginPath();
      ctx.arc(
        position.x,
        position.y,
        component.radius,
        0,
        2 * Math.PI,
        false
      );
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
  }

  play() {
    this.enabled = true;
  }

  stop() {
    this.enabled = false;
  }
}

export class RendererIntersecting implements System {

  static queries = {
    intersectingCircles: { components: [Intersecting] },
    context: { components: [CanvasContext], mandatory: true }
  };

  enabled = true;
  initialized = true;

  queriesOther = {};
  queries: any = {};

  mandatoryQueries = [];

  run() {

    const context = this.queries.context.results[0];
    const canvasComponent = context.getComponent(CanvasContext);
    const ctx: CanvasRenderingContext2D = canvasComponent.ctx;

    const intersectingCircles = this.queries.intersectingCircles.results;

    for (const intersectingCircle of intersectingCircles) {
      const intersect = intersectingCircle.getComponent(Intersecting);

      for (const points of intersect.points) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ff9';

        ctx.fillStyle = 'rgba(255, 255,255, 0.2)';
        fillCircle(ctx, points[0], points[1], 8);
        fillCircle(ctx, points[2], points[3], 8);

        ctx.fillStyle = '#fff';
        fillCircle(ctx, points[0], points[1], 3);
        fillCircle(ctx, points[2], points[3], 3);

        drawLine(ctx, points[0], points[1], points[2], points[3]);
      }
    }
  }

  play() {
    this.enabled = true;
  }

  stop() {
    this.enabled = false;
  }
}
