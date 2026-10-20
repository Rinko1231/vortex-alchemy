import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";

const ICON_SIZE = 256;
const ICON_MARGIN = 12;
const ALPHA_THRESHOLD = 8;

const items = [
  { source: "omnipotent.png", output: "src/assets/items/wildcard-item.png" },
  { source: "upgrade.png", output: "src/assets/items/upgrade-item.png" },
];

function alphaBounds(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      if (alpha <= ALPHA_THRESHOLD) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error("Source image has no visible pixels.");
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function sampleSource(image, bounds, left, top, right, bottom) {
  const xStart = Math.floor(left);
  const xEnd = Math.ceil(right);
  const yStart = Math.floor(top);
  const yEnd = Math.ceil(bottom);
  let weightTotal = 0;
  let alphaTotal = 0;
  let redTotal = 0;
  let greenTotal = 0;
  let blueTotal = 0;

  for (let y = yStart; y < yEnd; y += 1) {
    const overlapY = Math.max(0, Math.min(y + 1, bottom) - Math.max(y, top));
    if (overlapY <= 0) continue;
    const sourceY = Math.min(bounds.y + bounds.height - 1, Math.max(bounds.y, y));

    for (let x = xStart; x < xEnd; x += 1) {
      const overlapX = Math.max(0, Math.min(x + 1, right) - Math.max(x, left));
      if (overlapX <= 0) continue;
      const sourceX = Math.min(bounds.x + bounds.width - 1, Math.max(bounds.x, x));
      const weight = overlapX * overlapY;
      const index = (sourceY * image.width + sourceX) * 4;
      const alpha = image.data[index + 3] / 255;
      weightTotal += weight;
      alphaTotal += alpha * weight;
      redTotal += image.data[index] * alpha * weight;
      greenTotal += image.data[index + 1] * alpha * weight;
      blueTotal += image.data[index + 2] * alpha * weight;
    }
  }

  if (alphaTotal <= 0) return [0, 0, 0, 0];

  return [
    Math.round(redTotal / alphaTotal),
    Math.round(greenTotal / alphaTotal),
    Math.round(blueTotal / alphaTotal),
    Math.round((alphaTotal / weightTotal) * 255),
  ];
}

function makeIcon(sourcePath) {
  const source = PNG.sync.read(readFileSync(sourcePath));
  const bounds = alphaBounds(source);
  const available = ICON_SIZE - ICON_MARGIN * 2;
  const scale = Math.min(available / bounds.width, available / bounds.height);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  const offsetX = Math.round((ICON_SIZE - width) / 2);
  const offsetY = Math.round((ICON_SIZE - height) / 2);
  const output = new PNG({ width: ICON_SIZE, height: ICON_SIZE });

  for (let y = 0; y < ICON_SIZE; y += 1) {
    for (let x = 0; x < ICON_SIZE; x += 1) {
      const index = (y * ICON_SIZE + x) * 4;
      if (x < offsetX || x >= offsetX + width || y < offsetY || y >= offsetY + height) {
        output.data[index + 3] = 0;
        continue;
      }

      const destX = x - offsetX;
      const destY = y - offsetY;
      const [red, green, blue, alpha] = sampleSource(
        source,
        bounds,
        bounds.x + (destX * bounds.width) / width,
        bounds.y + (destY * bounds.height) / height,
        bounds.x + ((destX + 1) * bounds.width) / width,
        bounds.y + ((destY + 1) * bounds.height) / height,
      );
      output.data[index] = red;
      output.data[index + 1] = green;
      output.data[index + 2] = blue;
      output.data[index + 3] = alpha;
    }
  }

  return { output, bounds, width, height };
}

for (const item of items) {
  const { output, bounds, width, height } = makeIcon(resolve(item.source));
  const outputPath = resolve(item.output);
  mkdirSync(resolve("src/assets/items"), { recursive: true });
  writeFileSync(outputPath, PNG.sync.write(output));
  console.log(
    `${item.source}: ${bounds.width}×${bounds.height} -> ${width}×${height} -> ${item.output}`,
  );
}
