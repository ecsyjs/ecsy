import { System } from "../../build/ecsy.module.js";
import { Movement, Circle, Intersecting } from "./components.js";
import { fillCircle, drawLine, intersection } from "./utils.js";

export class MovementSystem extends System {
  init() {
    return {
      queries: {
        entities: { components: [Circle, Movement] }
      }
    };
  }

  execute(delta) {
    let canvasWidth = this.world.components.canvasContext.width;
    let canvasHeight = this.world.components.canvasContext.height;
    let multiplier = this.world.components.demoSettings.speedMultiplier;

    let entities = this.queries.entities;
    for (var i = 0; i < entities.length; i++) {
      let entity = entities[i];
      let circle = entity.getMutableComponent(Circle);
      let movement = entity.getMutableComponent(Movement);

      circle.position.x +=
        movement.velocity.x * movement.acceleration.x * delta * multiplier;
      circle.position.y +=
        movement.velocity.y * movement.acceleration.y * delta * multiplier;

      if (movement.acceleration.x > 1)
        movement.acceleration.x -= delta * multiplier;
      if (movement.acceleration.y > 1)
        movement.acceleration.y -= delta * multiplier;
      if (movement.acceleration.x < 1) movement.acceleration.x = 1;
      if (movement.acceleration.y < 1) movement.acceleration.y = 1;

      if (circle.position.y + circle.radius < 0)
        circle.position.y = canvasHeight + circle.radius;

      if (circle.position.y - circle.radius > canvasHeight)
        circle.position.y = -circle.radius;

      if (circle.position.x - circle.radius > canvasWidth)
        circle.position.x = 0;

      if (circle.position.x + circle.radius < 0)
        circle.position.x = canvasWidth;
    }
  }
}

export class IntersectionSystem extends System {
  init() {
    return {
      queries: {
        entities: { components: [Circle] }
      }
    };
  }

  execute() {
    let entities = this.queries.entities;

    for (var i = 0; i < entities.length; i++) {
      let entity = entities[i];
      if (entity.hasComponent(Intersecting)) {
        entity.getMutableComponent(Intersecting).points.length = 0;
      }

      let circle = entity.getComponent(Circle);

      for (var j = i + 1; j < entities.length; j++) {
        let entityB = entities[j];
        let circleB = entityB.getComponent(Circle);

        var intersect = intersection(circle, circleB);
        if (intersect !== false) {
          var intersectComponent;
          if (!entity.hasComponent(Intersecting)) {
            entity.addComponent(Intersecting);
          }
          intersectComponent = entity.getMutableComponent(Intersecting);
          intersectComponent.points.push(intersect);
        }
      }
      if (
        entity.hasComponent(Intersecting) &&
        entity.getComponent(Intersecting).points.length === 0
      ) {
        entity.removeComponent(Intersecting);
      }
    }
  }

  stop() {
    super.stop();
    // Clean up interesection when stopping
    let entities = this.queries.entities;

    for (var i = 0; i < entities.length; i++) {
      let entity = entities[i];
      if (entity.hasComponent(Intersecting)) {
        entity.getMutableComponent(Intersecting).points.length = 0;
      }
    }
  }
}

export class Renderer extends System {
  init() {
    return {
      queries: {
        circles: { components: [Circle] },
        intersectingCircles: { components: [Intersecting] }
      }
    };
  }

  execute() {
    let canvasComponent = this.world.components.canvasContext;
    let ctx = canvasComponent.ctx;
    let canvasWidth = canvasComponent.width;
    let canvasHeight = canvasComponent.height;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    let circles = this.queries.circles;
    for (var i = 0; i < circles.length; i++) {
      let circle = circles[i].getComponent(Circle);

      ctx.beginPath();
      ctx.arc(
        circle.position.x,
        circle.position.y,
        circle.radius,
        0,
        2 * Math.PI,
        false
      );
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }

    let intersectingCircles = this.queries.intersectingCircles;
    for (let i = 0; i < intersectingCircles.length; i++) {
      let intersect = intersectingCircles[i].getComponent(Intersecting);
      for (var j = 0; j < intersect.points.length; j++) {
        var points = intersect.points[j];
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#ff9";

        ctx.fillStyle = "rgba(255, 255,255, 0.2)";
        fillCircle(ctx, points[0], points[1], 8);
        fillCircle(ctx, points[2], points[3], 8);

        ctx.fillStyle = "#fff";
        fillCircle(ctx, points[0], points[1], 3);
        fillCircle(ctx, points[2], points[3], 3);

        ctx.strokeStyle = "#ff9";
        drawLine(ctx, points[0], points[1], points[2], points[3]);
      }
    }
  }
}
