import Phaser from "phaser";
import "./styles.css";
import { GameScene } from "./game/GameScene";
import {
  DEFAULT_CONFIG,
  isDefaultConfig,
  loadConfig,
  normalizeConfig,
  saveConfig,
  type RunConfig,
} from "./game/config";
import { formatScore, formatTime } from "./game/presentation";
import type {
  CellPos,
  GameSnapshot,
  RotationDirection,
} from "./game/types";
import { UI_ASSETS } from "./ui/assets";

const BEST_SCORE_KEY = "vortex-alchemy:best:v1";

type SettingsOrigin = "start" | "game" | "pause" | "gameover";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

const ui = {
  scoreIcon: element<HTMLImageElement>("score-icon"),
  helpIcon: element<HTMLImageElement>("help-icon"),
  pauseIcon: element<HTMLImageElement>("pause-icon"),
  settingsIcon: element<HTMLImageElement>("settings-icon"),
  rotateHintImage: element<HTMLImageElement>("rotate-hint-image"),
  chainIcon: element<HTMLImageElement>("chain-icon"),
  grailIcon: element<HTMLImageElement>("grail-icon"),
  ribbonImage: element<HTMLImageElement>("ribbon-image"),
  scoreValue: element<HTMLElement>("score-value"),
  timeValue: element<HTMLElement>("time-value"),
  bestValue: element<HTMLElement>("best-value"),
  chainValue: element<HTMLElement>("chain-value"),
  grailValue: element<HTMLElement>("grail-value"),
  timerPlate: element<HTMLElement>("timer-plate"),
  chainToast: element<HTMLElement>("chain-toast"),
  rotateHint: element<HTMLElement>("rotate-hint"),
  startScreen: element<HTMLElement>("start-screen"),
  startButton: element<HTMLButtonElement>("start-button"),
  startSettingsButton: element<HTMLButtonElement>("start-settings-button"),
  helpButton: element<HTMLButtonElement>("help-button"),
  pauseButton: element<HTMLButtonElement>("pause-button"),
  settingsButton: element<HTMLButtonElement>("settings-button"),
  modalBackdrop: element<HTMLElement>("modal-backdrop"),
  modalCard: element<HTMLElement>("modal-card"),
  modalContent: element<HTMLElement>("modal-content"),
  modalClose: element<HTMLButtonElement>("modal-close"),
  gameOverScreen: element<HTMLElement>("game-over-screen"),
  resultTitle: element<HTMLElement>("result-title"),
  resultScore: element<HTMLElement>("result-score"),
  resultChain: element<HTMLElement>("result-chain"),
  resultGrails: element<HTMLElement>("result-grails"),
  resultNote: element<HTMLElement>("result-note"),
  restartButton: element<HTMLButtonElement>("restart-button"),
  resultSettingsButton: element<HTMLButtonElement>("result-settings-button"),
};

let config = loadConfig();
let sceneReady = false;
let scene: GameScene;
let lastSnapshot: GameSnapshot | null = null;
let resumeAfterModal = false;
let chainToastTimer = 0;
let bestScore = readBestScore();

function readBestScore(): number {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_SCORE_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function writeBestScore(value: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch {
    // Local storage is optional for private/embedded browsing.
  }
}

function setImage(image: HTMLImageElement, source: string): void {
  image.src = source;
}

function applyUiAssets(): void {
  setImage(ui.scoreIcon, UI_ASSETS.badgeScore);
  setImage(ui.helpIcon, UI_ASSETS.iconHelp);
  setImage(ui.pauseIcon, UI_ASSETS.iconPause);
  setImage(ui.settingsIcon, UI_ASSETS.iconSettings);
  setImage(ui.rotateHintImage, UI_ASSETS.rotateHint);
  setImage(ui.chainIcon, UI_ASSETS.badgeChain);
  setImage(ui.grailIcon, UI_ASSETS.badgeGrail);
  setImage(ui.ribbonImage, UI_ASSETS.ribbon);

  const root = document.documentElement.style;
  root.setProperty("--bg-image", `url("${UI_ASSETS.background}")`);
  root.setProperty("--ui-panel", `url("${UI_ASSETS.panelFrame}")`);
  root.setProperty("--ui-timer", `url("${UI_ASSETS.timerPlate}")`);
  root.setProperty("--ui-primary", `url("${UI_ASSETS.primaryButton}")`);
  root.setProperty("--ui-secondary", `url("${UI_ASSETS.secondaryButton}")`);
  root.setProperty("--ui-icon-button", `url("${UI_ASSETS.iconButton}")`);
  root.setProperty("--ui-corner", `url("${UI_ASSETS.cornerOrnament}")`);
}

function setLayerVisible(layer: HTMLElement, visible: boolean): void {
  layer.classList.toggle("visible", visible);
  layer.classList.toggle("hidden", !visible);
}

function updateHud(snapshot: GameSnapshot): void {
  lastSnapshot = snapshot;
  ui.timeValue.textContent = formatTime(snapshot.timeLeftMs);
  ui.scoreValue.textContent = formatScore(snapshot.score);
  ui.chainValue.textContent = String(snapshot.chain);
  ui.grailValue.textContent = String(snapshot.grails);
  ui.bestValue.textContent = formatScore(bestScore);
  ui.timerPlate.classList.toggle("danger", snapshot.timeLeftMs <= 10_000);
}

function flashMessage(message: string): void {
  window.clearTimeout(chainToastTimer);
  ui.chainToast.textContent = message;
  ui.chainToast.classList.add("visible");
  chainToastTimer = window.setTimeout(() => {
    ui.chainToast.classList.remove("visible");
  }, 900);
}

function showHover(group: CellPos | null): void {
  if (!group || !lastSnapshot || lastSnapshot.status !== "playing") {
    ui.rotateHint.classList.remove("visible");
    return;
  }

  const metrics = GameScene.boardMetrics();
  const size = (metrics.cellSize * 2 * 100) / metrics.canvasSize;
  const centerX =
    ((metrics.boardX + (group.col + 1) * metrics.cellSize) * 100) /
    metrics.canvasSize;
  const centerY =
    ((metrics.boardY + (group.row + 1) * metrics.cellSize) * 100) /
    metrics.canvasSize;

  ui.rotateHint.style.width = `${size}%`;
  ui.rotateHint.style.height = `${size}%`;
  ui.rotateHint.style.left = `${centerX}%`;
  ui.rotateHint.style.top = `${centerY}%`;
  ui.rotateHint.classList.add("visible");
}

function hideHover(): void {
  ui.rotateHint.classList.remove("visible");
}

function startGame(): void {
  if (!sceneReady) return;
  closeModal(false);
  setLayerVisible(ui.startScreen, false);
  setLayerVisible(ui.gameOverScreen, false);
  hideHover();
  scene.startRun(config);
  updateHud(scene.getSnapshot());
  flashMessage("实验开始");
}

function showGameOver(snapshot: GameSnapshot): void {
  hideHover();
  const newBest = isDefaultConfig(config) && snapshot.score > bestScore;
  if (newBest) {
    bestScore = snapshot.score;
    writeBestScore(bestScore);
  }
  ui.bestValue.textContent = formatScore(bestScore);

  ui.resultTitle.textContent = snapshot.grails > 0 ? "圣杯现世" : "时间耗尽";
  ui.resultScore.textContent = formatScore(snapshot.score);
  ui.resultChain.textContent = String(snapshot.maxChain);
  ui.resultGrails.textContent = String(snapshot.grails);

  const notes: string[] = [];
  if (newBest) notes.push("新的最佳记录。");
  if (snapshot.grails > 0) notes.push(`本局炼成了 ${snapshot.grails} 座圣杯。`);
  if (!isDefaultConfig(config)) notes.push("本局使用自定义参数，不计入默认最佳记录。");
  if (notes.length === 0) notes.push("把同色同阶的器皿转进同一个 2×2，连锁能换回更多时间。");
  ui.resultNote.textContent = notes.join(" ");

  window.setTimeout(() => {
    setLayerVisible(ui.gameOverScreen, true);
  }, 220);
}

function openModal(content: string): void {
  ui.modalContent.innerHTML = content;
  setLayerVisible(ui.modalBackdrop, true);
  ui.modalBackdrop.setAttribute("aria-hidden", "false");
  window.setTimeout(() => {
    const firstInput = ui.modalContent.querySelector<HTMLElement>(
      "button, input, select, [tabindex]",
    );
    firstInput?.focus();
  }, 0);
}

function closeModal(resume = true): void {
  if (!ui.modalBackdrop.classList.contains("visible")) return;
  setLayerVisible(ui.modalBackdrop, false);
  ui.modalBackdrop.setAttribute("aria-hidden", "true");
  ui.modalContent.innerHTML = "";
  const shouldResume = resume && resumeAfterModal;
  resumeAfterModal = false;
  if (shouldResume) {
    scene.resumeRun();
    updateHud(scene.getSnapshot());
  }
}

function openPause(): void {
  if (!lastSnapshot || lastSnapshot.status !== "playing") {
    flashMessage("连锁结算中，稍后再暂停");
    return;
  }
  if (!scene.pauseRun()) return;
  resumeAfterModal = true;
  updateHud(scene.getSnapshot());
  openModal(`
    <p class="eyebrow">实验暂停</p>
    <h2 id="modal-title">时间已经停下</h2>
    <p class="modal-lead">你可以继续本局、调整规则，或者重新布置一张棋盘。</p>
    <div class="modal-actions vertical">
      <button id="pause-resume" class="text-button primary" type="button"><span>继续实验</span></button>
      <button id="pause-restart" class="text-button secondary" type="button"><span>重新开始</span></button>
      <button id="pause-settings" class="text-button secondary" type="button"><span>调整规则</span></button>
      <button id="pause-help" class="text-button ghost" type="button"><span>玩法说明</span></button>
    </div>
  `);

  element<HTMLButtonElement>("pause-resume").addEventListener("click", () => {
    closeModal(true);
  });
  element<HTMLButtonElement>("pause-restart").addEventListener("click", () => {
    resumeAfterModal = false;
    closeModal(false);
    startGame();
  });
  element<HTMLButtonElement>("pause-settings").addEventListener("click", () => {
    openSettings("pause");
  });
  element<HTMLButtonElement>("pause-help").addEventListener("click", () => {
    openHelp("pause");
  });
}

function openHelp(origin: "start" | "game" | "pause" = "start"): void {
  if (origin === "game") {
    if (!lastSnapshot || lastSnapshot.status !== "playing" || !scene.pauseRun()) {
      flashMessage("连锁结算中，稍后再看说明");
      return;
    }
    resumeAfterModal = true;
    updateHud(scene.getSnapshot());
  } else if (origin === "pause") {
    resumeAfterModal = true;
  }

  openModal(`
    <p class="eyebrow">炼金手册</p>
    <h2 id="modal-title">怎么让反应发生</h2>
    <ul class="rules-list">
      <li>点击任意 2×2 的中心，四格棋子顺时针旋转。右键或 Shift + 点击可逆时针旋转。</li>
      <li>四颗同色同阶的一、二、三阶棋子会合成高一阶。四阶是同色路线的终点。</li>
      <li>紫色万能黏胶只能替代一阶。四颗万能黏胶也能直接炼成圣杯。</li>
      <li>黑、白、红、黄各一颗四阶宝石时，合成圣杯并换来大笔时间。</li>
      <li>合并后会在空出的三个格位原地补入新棋子；新棋子继续合并会形成连锁，连锁越深加时越多。</li>
      <li>圣杯可以被做出来，也可以转动，但不能再作为材料参与合并。</li>
    </ul>
    <div class="modal-actions">
      <button id="help-close" class="text-button primary" type="button"><span>知道了</span></button>
    </div>
  `);
  element<HTMLButtonElement>("help-close").addEventListener("click", () => {
    closeModal(true);
  });
}

function numberField(
  id: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  unit: string,
): string {
  return `
    <label class="setting-row" for="${id}">
      <span>${label}</span>
      <span class="setting-control">
        <input id="${id}" class="setting-input" type="number" min="${min}" max="${max}" step="${step}" value="${value}" />
        <span class="setting-unit">${unit}</span>
      </span>
    </label>
  `;
}

function settingsTemplate(current: RunConfig, origin: SettingsOrigin): string {
  const restartLabel =
    origin === "start" || origin === "gameover" ? "保存并开始" : "保存并重开";
  return `
    <p class="eyebrow">实验参数</p>
    <h2 id="modal-title">调整规则</h2>
    <p class="modal-lead">玩法参数在下一局生效；按钮文案和界面会跟随窗口大小自动适配。</p>
    <form id="settings-form" class="settings-form">
      <fieldset>
        <legend>时间</legend>
        ${numberField("cfg-start", "开局倒计时", current.startingTimeSec, 30, 300, 5, "秒")}
        ${numberField("cfg-g2", "一阶 → 二阶", current.gainTier2, 0, 10, 0.5, "秒")}
        ${numberField("cfg-g3", "二阶 → 三阶", current.gainTier3, 0, 20, 0.5, "秒")}
        ${numberField("cfg-g4", "三阶 → 四阶", current.gainTier4, 0, 30, 0.5, "秒")}
        ${numberField("cfg-grail", "圣杯加时", current.gainGrail, 0, 120, 1, "秒")}
        ${numberField("cfg-chain-step", "每层连锁加成", current.chainStep, 0, 0.5, 0.05, "倍")}
        ${numberField("cfg-chain-cap", "连锁倍率上限", current.chainCap, 1, 5, 0.25, "倍")}
      </fieldset>
      <fieldset>
        <legend>新棋子</legend>
        ${numberField("cfg-tier1", "一阶权重", current.tier1Weight, 0, 100, 1, "%")}
        ${numberField("cfg-tier2", "二阶权重", current.tier2Weight, 0, 100, 1, "%")}
        ${numberField("cfg-wildcard", "万能权重", current.wildcardWeight, 0, 100, 1, "%")}
        <p id="weight-note" class="small-note">三项会自动归一化，不需要手动凑到 100%。</p>
      </fieldset>
      <fieldset>
        <legend>操作与辅助</legend>
        <label class="check-row">
          <input id="cfg-reverse" type="checkbox" ${current.reverseRotation ? "checked" : ""} />
          <span>允许右键 / Shift 逆时针旋转</span>
        </label>
        <label class="check-row">
          <input id="cfg-reduced" type="checkbox" ${current.reducedMotion ? "checked" : ""} />
          <span>减弱旋转与特效动态</span>
        </label>
      </fieldset>
      <div class="settings-actions">
        <button class="text-button primary" type="submit"><span>保存设置</span></button>
        <button id="settings-save-restart" class="text-button secondary" type="button"><span>${restartLabel}</span></button>
        <button id="settings-reset" class="text-button ghost" type="button"><span>恢复默认</span></button>
      </div>
    </form>
  `;
}

function readNumber(id: string): number {
  return element<HTMLInputElement>(id).valueAsNumber;
}

function readFormConfig(): RunConfig {
  return normalizeConfig({
    startingTimeSec: readNumber("cfg-start"),
    gainTier2: readNumber("cfg-g2"),
    gainTier3: readNumber("cfg-g3"),
    gainTier4: readNumber("cfg-g4"),
    gainGrail: readNumber("cfg-grail"),
    chainStep: readNumber("cfg-chain-step"),
    chainCap: readNumber("cfg-chain-cap"),
    tier1Weight: readNumber("cfg-tier1"),
    tier2Weight: readNumber("cfg-tier2"),
    wildcardWeight: readNumber("cfg-wildcard"),
    reverseRotation: element<HTMLInputElement>("cfg-reverse").checked,
    reducedMotion: element<HTMLInputElement>("cfg-reduced").checked,
  });
}

function writeFormConfig(value: RunConfig): void {
  const fields: Array<[string, number]> = [
    ["cfg-start", value.startingTimeSec],
    ["cfg-g2", value.gainTier2],
    ["cfg-g3", value.gainTier3],
    ["cfg-g4", value.gainTier4],
    ["cfg-grail", value.gainGrail],
    ["cfg-chain-step", value.chainStep],
    ["cfg-chain-cap", value.chainCap],
    ["cfg-tier1", value.tier1Weight],
    ["cfg-tier2", value.tier2Weight],
    ["cfg-wildcard", value.wildcardWeight],
  ];
  for (const [id, fieldValue] of fields) {
    element<HTMLInputElement>(id).value = String(fieldValue);
  }
  element<HTMLInputElement>("cfg-reverse").checked = value.reverseRotation;
  element<HTMLInputElement>("cfg-reduced").checked = value.reducedMotion;
}

function applySavedConfig(next: RunConfig): void {
  config = saveConfig(next);
  document.documentElement.classList.toggle("reduced-motion", config.reducedMotion);
}

function openSettings(origin: SettingsOrigin): void {
  if (origin === "game") {
    if (!lastSnapshot || lastSnapshot.status !== "playing" || !scene.pauseRun()) {
      flashMessage("连锁结算中，稍后再改设置");
      return;
    }
    resumeAfterModal = true;
    updateHud(scene.getSnapshot());
  } else {
    resumeAfterModal = origin === "pause";
  }

  openModal(settingsTemplate(config, origin));
  const form = element<HTMLFormElement>("settings-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    applySavedConfig(readFormConfig());
    if (origin === "start") scene.previewConfig(config);
    closeModal(true);
    flashMessage("设置已保存，下一局生效");
  });
  element<HTMLButtonElement>("settings-save-restart").addEventListener("click", () => {
    applySavedConfig(readFormConfig());
    closeModal(false);
    startGame();
  });
  element<HTMLButtonElement>("settings-reset").addEventListener("click", () => {
    writeFormConfig(DEFAULT_CONFIG);
    flashMessage("已填回默认值，保存后生效");
  });
}

function togglePause(): void {
  if (!lastSnapshot) return;
  if (lastSnapshot.status === "playing") {
    openPause();
  } else if (lastSnapshot.status === "paused") {
    closeModal(true);
  }
}

function handleVisibility(): void {
  if (document.hidden && lastSnapshot?.status === "playing") {
    openPause();
  }
}

applyUiAssets();
document.documentElement.classList.toggle("reduced-motion", config.reducedMotion);
ui.bestValue.textContent = formatScore(bestScore);
ui.startButton.disabled = true;
ui.startButton.querySelector("span")!.textContent = "载入炼金台…";

const callbacks = {
  onHud: updateHud,
  onHover: showHover,
  onChain: (chain: number, timeGain: number) => {
    flashMessage(`连锁 ×${chain}  +${timeGain.toFixed(1)} 秒`);
  },
  onGameOver: showGameOver,
  onReady: () => {
    sceneReady = true;
    ui.startButton.disabled = false;
    ui.startButton.querySelector("span")!.textContent = "开始实验";
  },
};

const gameScene = new GameScene(callbacks, config);
scene = gameScene;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-stage",
  width: 800,
  height: 800,
  transparent: true,
  antialias: true,
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [gameScene],
});

ui.startButton.addEventListener("click", startGame);
ui.startSettingsButton.addEventListener("click", () => openSettings("start"));
ui.helpButton.addEventListener("click", () => openHelp("game"));
ui.pauseButton.addEventListener("click", togglePause);
ui.settingsButton.addEventListener("click", () => openSettings("game"));
ui.modalClose.addEventListener("click", () => closeModal(true));
ui.modalBackdrop.addEventListener("click", (event) => {
  if (event.target === ui.modalBackdrop) closeModal(true);
});
ui.restartButton.addEventListener("click", startGame);
ui.resultSettingsButton.addEventListener("click", () => openSettings("gameover"));
document.addEventListener("visibilitychange", handleVisibility);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && ui.modalBackdrop.classList.contains("visible")) {
    closeModal(true);
  }
});

declare global {
  interface Window {
    __vortex: {
      start: () => void;
      rotate: (row: number, col: number, direction?: RotationDirection) => boolean;
      snapshot: () => GameSnapshot | null;
      moves: () => Array<{ row: number; col: number; direction: RotationDirection }>;
      end: () => void;
      setConfig: (partial: Partial<RunConfig>) => RunConfig;
      getConfig: () => RunConfig;
    };
  }
}

window.__vortex = {
  start: startGame,
  rotate: (row, col, direction = 1) => scene.rotateForDebug(row, col, direction),
  snapshot: () => lastSnapshot,
  moves: () => scene.findPlayableMoves(),
  end: () => scene.endRunForDebug(),
  setConfig: (partial) => {
    config = saveConfig(normalizeConfig({ ...config, ...partial }));
    return config;
  },
  getConfig: () => ({ ...config }),
};

