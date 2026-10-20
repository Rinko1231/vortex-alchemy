import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const inputPath = process.argv[2] ?? "sheet_alchemy.png";
const outputPath = process.argv[3] ?? "src/assets/sheet_alchemy_centered.png";
const cellSize = 256;
const image = PNG.sync.read(readFileSync(inputPath));
const { width, height, data } = image;
const visited = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
const components = [];

for (let start = 0; start < width * height; start += 1) {
  if (visited[start] || data[start * 4 + 3] <= 4) continue;

  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  visited[start] = 1;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let area = 0;

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    area += 1;

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (visited[next] || data[next * 4 + 3] <= 4) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
  }

  if (area >= 20) components.push({ minX, minY, maxX, maxY, area });
}

const parent = components.map((_, index) => index);
const find = (index) => {
  let current = index;
  while (parent[current] !== current) {
    parent[current] = parent[parent[current]];
    current = parent[current];
  }
  return current;
};
const union = (left, right) => {
  const leftRoot = find(left);
  const rightRoot = find(right);
  if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
};

for (let left = 0; left < components.length; left += 1) {
  for (let right = left + 1; right < components.length; right += 1) {
    const a = components[left];
    const b = components[right];
    const overlaps =
      a.minX <= b.maxX + 1 &&
      a.maxX + 1 >= b.minX &&
      a.minY <= b.maxY + 1 &&
      a.maxY + 1 >= b.minY;
    if (overlaps) union(left, right);
  }
}

const grouped = new Map();
for (let index = 0; index < components.length; index += 1) {
  const root = find(index);
  const component = components[index];
  const existing = grouped.get(root);
  if (!existing) {
    grouped.set(root, { ...component });
  } else {
    existing.minX = Math.min(existing.minX, component.minX);
    existing.minY = Math.min(existing.minY, component.minY);
    existing.maxX = Math.max(existing.maxX, component.maxX);
    existing.maxY = Math.max(existing.maxY, component.maxY);
    existing.area += component.area;
  }
}

const groups = [...grouped.values()].map((group) => {
  const centerX = (group.minX + group.maxX) / 2;
  const centerY = (group.minY + group.maxY) / 2;
  const row = centerY < 300 ? 0 : centerY < 530 ? 1 : centerY < 770 ? 2 : 3;
  return { ...group, centerX, centerY, row };
});

const rows = [0, 1, 2, 3].map((row) =>
  groups
    .filter((group) => group.row === row)
    .sort((left, right) => left.centerX - right.centerX),
);

const targetColumns = [
  [0, 1, 2, 3, 4, 5],
  [0, 1, 2, 3, 5],
  [0, 1, 2, 3, 5],
  [0, 1, 2, 3, 5],
];
const labels = [
  ["black-1", "white-1", "red-1", "yellow-1", "wildcard", "grail"],
  ["black-2", "white-2", "red-2", "yellow-2", "rotation-dial"],
  ["black-3", "white-3", "red-3", "yellow-3", "merge-burst"],
  ["black-4", "white-4", "red-4", "yellow-4", "chain-flare"],
];

for (let row = 0; row < 4; row += 1) {
  if (rows[row].length !== targetColumns[row].length) {
    throw new Error(
      `Row ${row} expected ${targetColumns[row].length} objects but found ${rows[row].length}.`,
    );
  }
}

const output = new Uint8Array(width * height * 4);
const mapping = [];
for (let row = 0; row < 4; row += 1) {
  for (let index = 0; index < rows[row].length; index += 1) {
    const group = rows[row][index];
    const targetColumn = targetColumns[row][index];
    const objectWidth = group.maxX - group.minX + 1;
    const objectHeight = group.maxY - group.minY + 1;
    const targetX = targetColumn * cellSize + Math.floor((cellSize - objectWidth) / 2);
    const targetY = row * cellSize + Math.floor((cellSize - objectHeight) / 2);

    for (let y = 0; y < objectHeight; y += 1) {
      for (let x = 0; x < objectWidth; x += 1) {
        const sourceIndex =
          ((group.minY + y) * width + (group.minX + x)) * 4;
        const targetIndex = ((targetY + y) * width + (targetX + x)) * 4;
        output[targetIndex] = data[sourceIndex];
        output[targetIndex + 1] = data[sourceIndex + 1];
        output[targetIndex + 2] = data[sourceIndex + 2];
        output[targetIndex + 3] = data[sourceIndex + 3];
      }
    }

    mapping.push({
      row,
      frame: row * 6 + targetColumn,
      label: labels[row][index],
      source: `${group.minX},${group.minY} ${objectWidth}x${objectHeight}`,
    });
  }
}

const normalized = new PNG({ width, height });
normalized.data = Buffer.from(output);
writeFileSync(outputPath, PNG.sync.write(normalized));
console.table(mapping);

