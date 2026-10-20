import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";

const source = PNG.sync.read(readFileSync("src/assets/sheet_alchemy_centered.png"));
const outputDirectory = resolve("src/assets/items");
mkdirSync(outputDirectory, { recursive: true });

const frames = [
  { frame: 4, name: "wildcard-item.png" },
  { frame: 17, name: "upgrade-item.png" },
];

for (const { frame, name } of frames) {
  const sourceX = (frame % 6) * 256;
  const sourceY = Math.floor(frame / 6) * 256;
  const image = new PNG({ width: 256, height: 256 });
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const sourceIndex = ((sourceY + y) * source.width + sourceX + x) * 4;
      const targetIndex = (y * 256 + x) * 4;
      image.data[targetIndex] = source.data[sourceIndex];
      image.data[targetIndex + 1] = source.data[sourceIndex + 1];
      image.data[targetIndex + 2] = source.data[sourceIndex + 2];
      image.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }
  writeFileSync(resolve(outputDirectory, name), PNG.sync.write(image));
}

