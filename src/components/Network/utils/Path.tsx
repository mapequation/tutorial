export default class Path {
  x0 = 0;
  y0 = 0;
  paths: string[] = [];

  moveTo(x: number, y: number) {
    this.x0 = x;
    this.y0 = y;
  }


  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    const path = `M${this.x0},${this.y0}C${x1},${y1},${x2},${y2},${x},${y}`;
    this.paths.push(path);
    this.x0 = x;
    this.y0 = y;
  }

  toString() {
    return this.paths.join("");
  }

  closePath() {
  }

  lineTo() {
  }

  quadraticCurveTo() {
  }

  arcTo() {
  }

  arc() {
  }

  rect() {
  }
}
