import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const gameUrl = process.env.VORTEX_URL ?? "http://127.0.0.1:5173/";
const outputDirectory = resolve("artifacts");
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--disable-gpu-sandbox", "--use-angle=swiftshader"],
});

const consoleErrors = [];
const failedRequests = [];
const httpErrors = [];
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`PAGE ERROR: ${error.message}`));
page.on("requestfailed", (request) => {
  failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
});
page.on("response", (response) => {
  if (response.status() >= 400) {
    httpErrors.push(`${response.status()} ${response.url()}`);
  }
});

await page.goto(gameUrl, { waitUntil: "networkidle" });
await page.locator("#game-stage canvas").waitFor({ state: "visible" });
await page.waitForFunction(() => {
  const button = document.querySelector("#start-button");
  return button instanceof HTMLButtonElement && !button.disabled;
});

const backgroundLoaded = await page.evaluate(() => {
  return getComputedStyle(document.body).backgroundImage.includes("vortex_alchemy_bg");
});
const startVisible = await page.locator("#start-screen").isVisible();
await page.screenshot({ path: resolve(outputDirectory, "01-start.png"), fullPage: true });

await page.locator("#start-button").click();
await page.waitForTimeout(650);

const initial = await page.evaluate(() => window.__vortex.snapshot());
const initialMoves = await page.evaluate(() => window.__vortex.moves());
assert.equal(initial?.status, "playing", "game should enter playing state");
assert.ok(initialMoves.length > 0, "initial board should have a playable rotation");
await page.screenshot({ path: resolve(outputDirectory, "02-game-desktop.png"), fullPage: true });

const canvasBox = await page.locator("#game-stage canvas").boundingBox();
assert.ok(canvasBox, "canvas should have a bounding box");

const toScreen = (row, col) => ({
  x: canvasBox.x + ((64 + (col + 1) * 84) / 800) * canvasBox.width,
  y: canvasBox.y + ((64 + (row + 1) * 84) / 800) * canvasBox.height,
});

const firstMove = initialMoves[0];
const point = toScreen(firstMove.row, firstMove.col);
await page.mouse.move(point.x, point.y);
await page.waitForFunction(
  () => {
    const hint = document.querySelector("#rotate-hint");
    return (
      hint?.classList.contains("visible") &&
      Number.parseFloat(getComputedStyle(hint).opacity) > 0.8
    );
  },
  undefined,
  { timeout: 2500 },
);
const hintVisible = await page.locator("#rotate-hint").evaluate((node) => {
  return node.classList.contains("visible") && Number.parseFloat(getComputedStyle(node).opacity) > 0;
});
assert.ok(hintVisible, "rotation hint should be visible after hovering over a 2×2 center");
const hintBox = await page.locator("#rotate-hint").boundingBox();
assert.ok(hintBox, "rotation hint should have a bounding box");
const renderedCellSize = canvasBox.width * (84 / 800);
const hintSpanCells = hintBox.width / renderedCellSize;
assert.ok(
  hintSpanCells >= 1.8 && hintSpanCells <= 2.2,
  `rotation hint should span about two cells, got ${hintSpanCells.toFixed(2)}`,
);
await page.screenshot({ path: resolve(outputDirectory, "03-rotate-hint.png"), fullPage: true });

const countdownBefore = initial.timeLeftMs;
await page.waitForTimeout(500);
const countdownAfter = await page.evaluate(() => window.__vortex.snapshot()?.timeLeftMs ?? 0);
assert.ok(countdownAfter < countdownBefore, "countdown should decrease during play");

if (firstMove.direction === -1) {
  await page.keyboard.down("Shift");
  await page.mouse.click(point.x, point.y, { button: "left" });
  await page.keyboard.up("Shift");
} else {
  await page.mouse.click(point.x, point.y, { button: "left" });
}
await page.waitForTimeout(360);
await page.screenshot({ path: resolve(outputDirectory, "04a-dropping.png"), fullPage: true });
await page.waitForFunction(
  () => window.__vortex.snapshot()?.status === "playing",
  undefined,
  { timeout: 5000 },
);
const afterMove = await page.evaluate(() => window.__vortex.snapshot());
const boardAfterMove = await page.evaluate(() => window.__vortex.board());
assert.ok(afterMove && afterMove.score > 0, "a playable rotation should increase score");
assert.equal(boardAfterMove.length, 64, "board should remain 8x8 after gravity");
assert.ok(boardAfterMove.every(Boolean), "gravity refill should leave no empty cells");
await page.screenshot({ path: resolve(outputDirectory, "04-after-merge.png"), fullPage: true });

await page.locator("#pause-button").click();
await page.locator("#modal-backdrop.visible").waitFor({ state: "visible" });
const pausedAt = await page.evaluate(() => window.__vortex.snapshot());
await page.waitForTimeout(550);
const pausedLater = await page.evaluate(() => window.__vortex.snapshot());
assert.equal(pausedAt?.status, "paused", "pause button should pause the run");
assert.equal(pausedLater?.timeLeftMs, pausedAt?.timeLeftMs, "timer should freeze while paused");
await page.screenshot({ path: resolve(outputDirectory, "05-pause.png"), fullPage: true });

await page.locator("#pause-settings").click();
await page.locator("#cfg-start").waitFor({ state: "visible" });
await page.locator("#cfg-start").fill("105");
await page.screenshot({ path: resolve(outputDirectory, "06-settings.png"), fullPage: true });
await page.locator('#settings-form button[type="submit"]').click();
await page.waitForFunction(() => !document.querySelector("#modal-backdrop")?.classList.contains("visible"));
await page.waitForTimeout(350);
const resumed = await page.evaluate(() => window.__vortex.snapshot());
assert.equal(resumed?.status, "playing", "saving settings should resume the paused run");

await page.evaluate(() => window.__vortex.end());
await page.waitForFunction(
  () => document.querySelector("#game-over-screen")?.classList.contains("visible"),
  undefined,
  { timeout: 3000 },
);
const gameOverVisible = await page.locator("#game-over-screen").isVisible();
assert.ok(gameOverVisible, "game-over screen should appear when the run ends");
await page.screenshot({ path: resolve(outputDirectory, "09-game-over.png"), fullPage: true });

await page.evaluate(() => localStorage.clear());
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => {
  const button = document.querySelector("#start-button");
  return button instanceof HTMLButtonElement && !button.disabled;
});
await page.locator("#start-button").click();
await page.waitForTimeout(500);
const mobileMetrics = await page.evaluate(() => {
  const canvas = document.querySelector("#game-stage canvas");
  const rect = canvas?.getBoundingClientRect();
  return {
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvas: rect
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom }
      : null,
    status: window.__vortex.snapshot()?.status,
  };
});
assert.equal(mobileMetrics.status, "playing");
assert.ok(mobileMetrics.scrollWidth <= mobileMetrics.innerWidth + 1, "mobile layout should not overflow horizontally");
assert.ok(mobileMetrics.canvas && mobileMetrics.canvas.width > 250, "mobile board should remain readable");
await page.screenshot({ path: resolve(outputDirectory, "07-mobile.png"), fullPage: true });

await page.locator("#settings-button").click();
await page.locator("#cfg-start").waitFor({ state: "visible" });
await page.screenshot({ path: resolve(outputDirectory, "08-mobile-settings.png"), fullPage: true });

const summary = {
  startVisible,
  backgroundLoaded,
  initialMoves: initialMoves.length,
  firstMove,
  hintVisible,
  hintSpanCells,
  countdownBefore,
  countdownAfter,
  afterMove,
  boardIntegrity: {
    cells: boardAfterMove.length,
    emptyCells: boardAfterMove.filter((piece) => !piece).length,
  },
  pauseFrozen: pausedLater?.timeLeftMs === pausedAt?.timeLeftMs,
  resumedStatus: resumed?.status,
  gameOverVisible,
  mobileMetrics,
  consoleErrors,
  failedRequests,
  httpErrors,
};
await writeFile(
  resolve(outputDirectory, "playtest-summary.json"),
  JSON.stringify(summary, null, 2),
  "utf8",
);
console.log(JSON.stringify(summary, null, 2));

assert.deepEqual(consoleErrors, [], "browser console should have no errors");
assert.deepEqual(failedRequests, [], "all network requests should succeed");
assert.deepEqual(httpErrors, [], "all HTTP responses should be successful");

await browser.close();

