export const GRID_SIZE = 10;

export function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

export function calculateGridSnap(x: number, y: number, gridSize: number = GRID_SIZE) {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize)
  };
}

export function getGridLines(width: number, height: number, gridSize: number = GRID_SIZE) {
  const lines = [];
  for (let i = 0; i < width / gridSize; i++) {
    lines.push({
      points: [i * gridSize, 0, i * gridSize, height],
      stroke: '#e2e8f0',
      strokeWidth: 1,
      opacity: 0.5
    });
  }
  for (let j = 0; j < height / gridSize; j++) {
    lines.push({
      points: [0, j * gridSize, width, j * gridSize],
      stroke: '#e2e8f0',
      strokeWidth: 1,
      opacity: 0.5
    });
  }
  return lines;
}
