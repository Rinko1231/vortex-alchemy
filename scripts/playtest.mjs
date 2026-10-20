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
const audioAfterStart = await page.evaluate(() => window.__vortex.audio());
assert.equal(initial?.status, "playing", "game should enter playing state");
assert.ok(initialMoves.length > 0, "initial board should have a playable rotation");
assert.ok(audioAfterStart.bgmPlaying, "background music should start after the first click");
assert.ok(!audioAfterStart.soundLocked, "audio should unlock after the first user gesture");
await page.screenshot({ path: resolve(outputDirectory, "02-game-desktop.png"), fullPage: true });

const canvasBox = await page.locator("#game-stage canvas").boundingBox();
assert.ok(canvasBox, "canvas should have a bounding box");

const toScreen = (row, col) => ({
  x: canvasBox.x + ((64 + (col + 1) * 84) / 800) * canvasBox.width,
  y: canvasBox.y + ((64 + (row + 1) * 84) / 800) * canvasBox.height,
});

const firstMove = initialMoves.find((move) => move.direction === 1) ?? initialMoves[0];
const boardBeforeMove = await page.evaluate(() => window.__vortex.board());
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
const audioAfterMerge = await page.evaluate(() => window.__vortex.audio());
assert.ok(
  afterMove && afterMove.score > 0,
  `a playable rotation should increase score: ${JSON.stringify({
    firstMove,
    before: boardBeforeMove.slice(0, 4),
    after: boardAfterMove.slice(0, 4),
    snapshot: afterMove,
  })}`,
);
assert.equal(boardAfterMove.length, 64, "board should remain 8x8 after gravity");
assert.ok(boardAfterMove.every(Boolean), "gravity refill should leave no empty cells");
assert.ok(
  audioAfterMerge.lastSfx === "sfx-merge-normal" ||
    audioAfterMerge.lastSfx === "sfx-merge-tier4",
  `a merge should play a merge sound, got ${audioAfterMerge.lastSfx}`,
);
await page.screenshot({ path: resolve(outputDirectory, "04-after-merge.png"), fullPage: true });

await page.locator("#pause-button").click();
await page.locator("#modal-backdrop.visible").waitFor({ state: "visible" });
const audioAfterPauseClick = await page.evaluate(() => window.__vortex.audio());
const pausedAt = await page.evaluate(() => window.__vortex.snapshot());
await page.waitForTimeout(550);
const pausedLater = await page.evaluate(() => window.__vortex.snapshot());
assert.equal(pausedAt?.status, "paused", "pause button should pause the run");
assert.equal(pausedLater?.timeLeftMs, pausedAt?.timeLeftMs, "timer should freeze while paused");
assert.equal(audioAfterPauseClick.lastSfx, "sfx-ui-click", "pause should play the UI click");
await page.screenshot({ path: resolve(outputDirectory, "05-pause.png"), fullPage: true });

await page.locator("#pause-settings").click();
await page.locator("#cfg-start").waitFor({ state: "visible" });
await page.locator("#cfg-start").fill("105");
await page.locator("#cfg-music").evaluate((node) => {
  node.value = "0.35";
  node.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.locator("#cfg-sfx").evaluate((node) => {
  node.value = "0.45";
  node.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.screenshot({ path: resolve(outputDirectory, "06-settings.png"), fullPage: true });
await page.locator('#settings-form button[type="submit"]').click();
await page.waitForFunction(() => !document.querySelector("#modal-backdrop")?.classList.contains("visible"));
await page.waitForTimeout(350);
const resumed = await page.evaluate(() => window.__vortex.snapshot());
const audioAfterSettings = await page.evaluate(() => window.__vortex.audio());
assert.equal(resumed?.status, "playing", "saving settings should resume the paused run");
assert.equal(audioAfterSettings.musicVolume, 0.35, "music volume should save from settings");
assert.equal(audioAfterSettings.sfxVolume, 0.45, "sfx volume should save from settings");

await page.locator("#sound-button").click();
const mutedState = await page.evaluate(() => window.__vortex.audio());
assert.equal(mutedState.muted, true, "sound button should mute audio");
await page.locator("#sound-button").click();
const unmutedState = await page.evaluate(() => window.__vortex.audio());
assert.equal(unmutedState.muted, false, "sound button should unmute audio");

await page.evaluate(() => window.__vortex.grantItem("upgrade", 1));
await page.waitForTimeout(150);
const itemButtonEnabled = await page.locator("#item-upgrade-button").isEnabled();
assert.ok(itemButtonEnabled, "granted item should enable its button");
const upgradeBeforeUse = await page.evaluate(() => window.__vortex.snapshot()?.items.upgrade ?? 0);
await page.locator("#item-upgrade-button").click();
await page.waitForFunction(
  () => window.__vortex.snapshot()?.status === "playing",
  undefined,
  { timeout: 8000 },
);
const upgradeAfterUse = await page.evaluate(() => window.__vortex.snapshot()?.items.upgrade ?? 0);
const boardAfterItem = await page.evaluate(() => window.__vortex.board());
const audioAfterUpgrade = await page.evaluate(() => window.__vortex.audio());
assert.ok(boardAfterItem.every(Boolean), "item use should leave a settled board");
assert.equal(audioAfterUpgrade.lastSfx, "sfx-item-use", "using an item should play its sound");
await page.screenshot({ path: resolve(outputDirectory, "09-item-use.png"), fullPage: true });

await page.evaluate(() => window.__vortex.grantItem("wildcard", 1));
await page.waitForTimeout(150);
const wildcardButtonEnabled = await page.locator("#item-wildcard-button").isEnabled();
assert.ok(wildcardButtonEnabled, "granted wildcard item should enable its button");
const wildcardBeforeUse = await page.evaluate(
  () => window.__vortex.snapshot()?.items.wildcard ?? 0,
);
await page.locator("#item-wildcard-button").click();
await page.waitForFunction(
  () => window.__vortex.snapshot()?.status === "playing",
  undefined,
  { timeout: 8000 },
);
const wildcardAfterUse = await page.evaluate(
  () => window.__vortex.snapshot()?.items.wildcard ?? 0,
);
const itemHud = await page.evaluate(() => {
  const snapshot = window.__vortex.snapshot();
  return {
    wildcard: Number(document.querySelector("#item-wildcard-count")?.textContent ?? -1),
    upgrade: Number(document.querySelector("#item-upgrade-count")?.textContent ?? -1),
    snapshot,
  };
});
assert.ok(itemHud.snapshot && itemHud.wildcard === itemHud.snapshot.items.wildcard);
assert.ok(itemHud.snapshot && itemHud.upgrade === itemHud.snapshot.items.upgrade);
assert.ok(
  (await page.evaluate(() => window.__vortex.board())).every(Boolean),
  "wildcard item use should leave a settled board",
);
await page.screenshot({ path: resolve(outputDirectory, "09b-wildcard-item.png"), fullPage: true });

await page.evaluate(() => window.__vortex.setTime(12_000));
await page.waitForTimeout(260);
const dangerState = await page.locator("#timer-plate").evaluate(async (node) => {
  const samples = [];
  for (let index = 0; index < 10; index += 1) {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    samples.push({
      x: Number(rect.x.toFixed(2)),
      y: Number(rect.y.toFixed(2)),
      color: style.color,
    });
    await new Promise((resolve) => window.setTimeout(resolve, 35));
  }
  return {
    hasDangerClass: node.classList.contains("danger"),
    animationName: getComputedStyle(node).animationName,
    distinctPositions: new Set(samples.map((sample) => `${sample.x},${sample.y}`)).size,
    color: samples[0]?.color ?? "",
    samples,
  };
});
assert.ok(dangerState.hasDangerClass, "low time should add the danger class");
assert.ok(
  dangerState.animationName.includes("timer-danger-shake"),
  "low time should use the red shake animation",
);
assert.ok(
  dangerState.distinctPositions > 1,
  "the timer plate should visibly move while the danger animation runs",
);
assert.ok(
  dangerState.color.includes("215, 33, 73"),
  `danger timer should turn red, got ${dangerState.color}`,
);
await page.screenshot({ path: resolve(outputDirectory, "10-low-time.png"), fullPage: true });
await page.evaluate(() => window.__vortex.setTime(45_000));
await page.waitForTimeout(120);
const dangerCleared = await page.locator("#timer-plate").evaluate((node) => ({
  hasDangerClass: node.classList.contains("danger"),
  animationName: getComputedStyle(node).animationName,
}));
assert.ok(!dangerCleared.hasDangerClass, "danger styling should clear after time recovers");

await page.evaluate(() => window.__vortex.end());
await page.waitForFunction(
  () => document.querySelector("#game-over-screen")?.classList.contains("visible"),
  undefined,
  { timeout: 3000 },
);
const gameOverVisible = await page.locator("#game-over-screen").isVisible();
assert.ok(gameOverVisible, "game-over screen should appear when the run ends");
await page.screenshot({ path: resolve(outputDirectory, "11-game-over.png"), fullPage: true });

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
  const footer = document.querySelector(".status-bar")?.getBoundingClientRect();
  const tray = document.querySelector(".item-tray")?.getBoundingClientRect();
  const hudRight = document.querySelector(".hud-right")?.getBoundingClientRect();
  const soundButton = document.querySelector("#sound-button")?.getBoundingClientRect();
  const itemButtons = Array.from(document.querySelectorAll(".item-button")).map((button) => {
    const buttonRect = button.getBoundingClientRect();
    return { width: buttonRect.width, height: buttonRect.height };
  });
  const iconButtons = Array.from(document.querySelectorAll(".hud-right .icon-button"))
    .map((button) => {
      const buttonRect = button.getBoundingClientRect();
      return {
        width: buttonRect.width,
        height: buttonRect.height,
        left: buttonRect.left,
        right: buttonRect.right,
      };
    })
    .filter((button) => button.width > 0);
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    canvas: rect
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom }
      : null,
    footer: footer ? { top: footer.top, bottom: footer.bottom } : null,
    itemTray: tray ? { x: tray.x, width: tray.width } : null,
    itemButtons,
    hudRight: hudRight
      ? { left: hudRight.left, right: hudRight.right, width: hudRight.width }
      : null,
    soundButton: soundButton ? { width: soundButton.width, height: soundButton.height } : null,
    iconButtons,
    status: window.__vortex.snapshot()?.status,
  };
});
assert.equal(mobileMetrics.status, "playing");
assert.ok(mobileMetrics.scrollWidth <= mobileMetrics.innerWidth + 1, "mobile layout should not overflow horizontally");
assert.ok(mobileMetrics.canvas && mobileMetrics.canvas.width > 250, "mobile board should remain readable");
assert.ok(
  mobileMetrics.footer && mobileMetrics.footer.bottom <= mobileMetrics.innerHeight + 1,
  "mobile status bar should stay inside the viewport",
);
assert.ok(
  mobileMetrics.itemTray && mobileMetrics.itemTray.x >= 0 &&
    mobileMetrics.itemTray.x + mobileMetrics.itemTray.width <= mobileMetrics.innerWidth + 1,
  "mobile item tray should stay fully visible",
);
assert.ok(
  mobileMetrics.itemButtons.length === 2 &&
    mobileMetrics.itemButtons.every((button) => button.width > 30 && button.height > 24),
  "both mobile item buttons should keep a usable hit area",
);
assert.ok(
  mobileMetrics.iconButtons.length === 3 &&
    mobileMetrics.iconButtons.every(
      (button) =>
        button.width >= 32 &&
        button.height >= 32 &&
        button.left >= 0 &&
        button.right <= mobileMetrics.innerWidth + 1,
    ),
  `visible HUD icon buttons should fit on mobile (help is hidden): ${JSON.stringify({
    width: mobileMetrics.innerWidth,
    hudRight: mobileMetrics.hudRight,
    iconButtons: mobileMetrics.iconButtons,
  })}`,
);
assert.ok(
  mobileMetrics.soundButton &&
    mobileMetrics.soundButton.width >= 32 &&
    mobileMetrics.soundButton.height >= 32,
  "mobile sound button should remain tappable",
);
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
  audioAfterStart,
  countdownBefore,
  countdownAfter,
  afterMove,
  audioAfterMerge,
  boardIntegrity: {
    cells: boardAfterMove.length,
    emptyCells: boardAfterMove.filter((piece) => !piece).length,
  },
  pauseFrozen: pausedLater?.timeLeftMs === pausedAt?.timeLeftMs,
  resumedStatus: resumed?.status,
  audioAfterSettings,
  mutedState,
  unmutedState,
  itemButtonEnabled,
  itemUse: {
    upgradeBeforeUse,
    upgradeAfterUse,
    wildcardButtonEnabled,
    wildcardBeforeUse,
    wildcardAfterUse,
    audioAfterUpgrade,
    hudMatchesSnapshot:
      itemHud.snapshot !== null &&
      itemHud.wildcard === itemHud.snapshot.items.wildcard &&
      itemHud.upgrade === itemHud.snapshot.items.upgrade,
  },
  dangerState,
  dangerCleared,
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

