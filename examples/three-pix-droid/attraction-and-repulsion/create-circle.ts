
const TWO_PI = 2 * Math.PI;

export const draw = (ctx: CanvasRenderingContext2D) => ({

  createCircle: (x, y, rad, fill, color) => {
   ctx.fillStyle = ctx.strokeStyle = color;
   ctx.beginPath();
   ctx.arc(x, y, rad, 0, TWO_PI);
   ctx.closePath();
   fill ? ctx.fill() : ctx.stroke();
  }
})
