import Phaser from "phaser";
import pieceSheetUrl from "../assets/sheet_alchemy_centered.png";
import { cloneBoard, findAllMergeGroups, rotateBoardInPlace } from "./board";
import { GameEngine } from "./engine";
import { pieceFrame } from "./presentation";
import { createSeed } from "./rng";
import type { RunConfig } from "./config";
import {
  BOARD_SIZE,
  cellIndex,
  type Board,
  type CellPos,
  type GameSnapshot,
  type MergeEvent,
  type Piece,
  type RotationDirection,
} from "./types";

const BOARD_X = 64;
const BOARD_Y = 64;
const CELL_SIZE = 84;
const BOARD_PIXELS = BOARD_SIZE * CELL_SIZE;
const BOARD_MIDDLE = BOARD_X + BOARD_PIXELS / 2;

interface SceneCallbacks {
  onHud: (snapshot: GameSnapshot) => void;
  onHover: (group: CellPos | null) => void;
  onChain: (chain: number, timeGain: number) => void;
  onGameOver: (snapshot: GameSnapshot) => void;
  onReady: () => void;
}

interface RotationTweenItem {
  sprite: Phaser.GameObjects.Image;
  target: CellPos;
}

export class GameScene extends Phaser.Scene {
  private readonly callbacks: SceneCallbacks;
  private engine: GameEngine;
  private pieceLayer!: Phaser.GameObjects.Container;
  private spritesByPieceId = new Map<number, Phaser.GameObjects.Image>();
  private hoverGroup: CellPos | null = null;
  private isAnimating = false;
  private gameOverNotified = false;
  private lastHudUpdate = 0;

  constructor(callbacks: SceneCallbacks, initialConfig: RunConfig) {
    super("GameScene");
    this.callbacks = callbacks;
    this.engine = new GameEngine(initialConfig);
  }

  preload(): void {
    this.load.spritesheet("pieces", pieceSheetUrl, {
      frameWidth: 256,
      frameHeight: 256,
    });
  }

  create(): void {
    this.input.mouse?.disableContextMenu();
    this.drawBoardBed();

    this.pieceLayer = this.add.container(0, 0);
    this.renderBoard();
    this.bindPointerInput();
    this.callbacks.onReady();
    this.syncHud();
  }

  update(_time: number, delta: number): void {
    if (!this.engine) return;

    this.engine.tick(delta);
    this.lastHudUpdate += delta;
    if (this.lastHudUpdate >= 70) {
      this.lastHudUpdate = 0;
      this.syncHud();
    }

    if (this.engine.snapshot().status === "game-over" && !this.gameOverNotified) {
      this.gameOverNotified = true;
      this.clearHover();
      this.callbacks.onGameOver(this.engine.snapshot());
    }
  }

  startRun(config: RunConfig): void {
    this.engine.reset(config, createSeed());
    this.engine.start();
    this.isAnimating = false;
    this.gameOverNotified = false;
    this.clearHover();
    this.renderBoard();
    this.syncHud();
  }

  previewConfig(config: RunConfig): void {
    if (this.engine.status !== "ready") return;
    this.engine.reset(config, createSeed());
    this.renderBoard();
    this.syncHud();
  }

  pauseRun(): boolean {
    if (this.isAnimating) return false;
    const paused = this.engine.pause();
    if (paused) {
      this.clearHover();
      this.syncHud();
    }
    return paused;
  }

  resumeRun(): boolean {
    const resumed = this.engine.resume();
    if (resumed) this.syncHud();
    return resumed;
  }

  clearHover(): void {
    this.hoverGroup = null;
    this.callbacks.onHover(null);
    this.game.canvas.style.cursor = "default";
  }

  getSnapshot(): GameSnapshot {
    return this.engine.snapshot();
  }

  getBoard(): Array<Piece | null> {
    return this.engine.board.map((piece) => (piece ? { ...piece } : null));
  }

  findPlayableMoves(): Array<{ row: number; col: number; direction: RotationDirection }> {
    const moves: Array<{ row: number; col: number; direction: RotationDirection }> = [];
    for (let row = 0; row < BOARD_SIZE - 1; row += 1) {
      for (let col = 0; col < BOARD_SIZE - 1; col += 1) {
        for (const direction of [1, -1] as const) {
          const copy = cloneBoard(this.engine.board);
          rotateBoardInPlace(copy, row, col, direction);
          if (findAllMergeGroups(copy).length > 0) moves.push({ row, col, direction });
        }
      }
    }
    return moves;
  }

  rotateForDebug(row: number, col: number, direction: RotationDirection = 1): boolean {
    if (this.isAnimating) return false;
    void this.rotateAt({ row, col }, direction);
    return true;
  }

  endRunForDebug(): void {
    this.engine.forceGameOver();
    this.clearHover();
    this.syncHud();
  }

  private drawBoardBed(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x160d21, 0.66);
    graphics.fillRoundedRect(
      BOARD_X - 16,
      BOARD_Y - 16,
      BOARD_PIXELS + 32,
      BOARD_PIXELS + 32,
      26,
    );
    graphics.lineStyle(5, 0xf0bd4f, 0.26);
    graphics.strokeRoundedRect(
      BOARD_X - 16,
      BOARD_Y - 16,
      BOARD_PIXELS + 32,
      BOARD_PIXELS + 32,
      26,
    );
    graphics.lineStyle(2, 0xffffff, 0.07);
    graphics.strokeRoundedRect(
      BOARD_X - 5,
      BOARD_Y - 5,
      BOARD_PIXELS + 10,
      BOARD_PIXELS + 10,
      18,
    );

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const x = BOARD_X + col * CELL_SIZE + 4;
        const y = BOARD_Y + row * CELL_SIZE + 4;
        const light = (row + col) % 2 === 0;
        graphics.fillStyle(light ? 0x2c173b : 0x261331, light ? 0.38 : 0.3);
        graphics.fillRoundedRect(x, y, CELL_SIZE - 8, CELL_SIZE - 8, 11);
      }
    }

    graphics.lineStyle(1, 0xffffff, 0.035);
    for (let index = 1; index < BOARD_SIZE; index += 1) {
      const x = BOARD_X + index * CELL_SIZE;
      const y = BOARD_Y + index * CELL_SIZE;
      graphics.lineBetween(x, BOARD_Y, x, BOARD_Y + BOARD_PIXELS);
      graphics.lineBetween(BOARD_X, y, BOARD_X + BOARD_PIXELS, y);
    }
  }

  private renderBoard(): void {
    this.renderSnapshot(this.engine.board);
  }

  private renderSnapshot(board: Board): void {
    if (!this.pieceLayer) return;
    this.pieceLayer.removeAll(true);
    this.spritesByPieceId.clear();

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const piece = board[cellIndex(row, col)];
        if (!piece) continue;
        const sprite = this.makePieceSprite(piece, { row, col });
        this.pieceLayer.add(sprite);
        this.spritesByPieceId.set(piece.id, sprite);
      }
    }
  }

  private makePieceSprite(piece: Piece, pos: CellPos): Phaser.GameObjects.Image {
    const center = this.cellCenter(pos);
    const sprite = this.add
      .image(center.x, center.y, "pieces", pieceFrame(piece))
      .setDisplaySize(CELL_SIZE * 0.98, CELL_SIZE * 0.98)
      .setOrigin(0.5);
    return sprite;
  }

  private bindPointerInput(): void {
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.isAnimating || this.engine.status !== "playing") return;
      const group = this.groupFromPointer(pointer.x, pointer.y);
      if (
        group?.row === this.hoverGroup?.row &&
        group?.col === this.hoverGroup?.col
      ) {
        return;
      }
      this.hoverGroup = group;
      this.callbacks.onHover(group);
      this.game.canvas.style.cursor = group ? "pointer" : "default";
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.isAnimating || this.engine.status !== "playing") return;
      const group = this.groupFromPointer(pointer.x, pointer.y);
      if (!group) return;

      const shiftPressed =
        (pointer.event as PointerEvent | undefined)?.shiftKey ?? false;
      const counterClockwise =
        this.engine.config.reverseRotation && (pointer.rightButtonDown() || shiftPressed);
      const direction: RotationDirection = counterClockwise ? -1 : 1;
      void this.rotateAt(group, direction);
    });

    this.input.on("gameout", () => {
      this.clearHover();
    });
  }

  private groupFromPointer(x: number, y: number): CellPos | null {
    if (
      x < BOARD_X ||
      x >= BOARD_X + BOARD_PIXELS ||
      y < BOARD_Y ||
      y >= BOARD_Y + BOARD_PIXELS
    ) {
      return null;
    }
    return {
      row: Phaser.Math.Clamp(Math.floor((y - BOARD_Y) / CELL_SIZE), 0, BOARD_SIZE - 2),
      col: Phaser.Math.Clamp(Math.floor((x - BOARD_X) / CELL_SIZE), 0, BOARD_SIZE - 2),
    };
  }

  private async rotateAt(group: CellPos, direction: RotationDirection): Promise<void> {
    if (this.isAnimating || this.engine.status !== "playing") return;

    const positions = [
      { row: group.row, col: group.col },
      { row: group.row, col: group.col + 1 },
      { row: group.row + 1, col: group.col },
      { row: group.row + 1, col: group.col + 1 },
    ];
    const moving: RotationTweenItem[] = [];
    for (const position of positions) {
      const piece = this.engine.board[cellIndex(position.row, position.col)];
      if (!piece) continue;
      const sprite = this.spritesByPieceId.get(piece.id);
      if (!sprite) continue;
      moving.push({ sprite, target: this.rotatedTarget(position, group, direction) });
    }

    const outcome = this.engine.rotate(group.row, group.col, direction);
    if (!outcome) return;

    this.isAnimating = true;
    this.clearHover();
    this.syncHud();
    await this.animateRotation(moving, group, direction);
    if (outcome.events.length > 0) {
      await this.playMergeEvents(outcome.events);
    }
    this.renderBoard();

    this.engine.finishResolution();
    this.isAnimating = false;
    this.syncHud();

    if (this.engine.snapshot().status === "game-over" && !this.gameOverNotified) {
      this.gameOverNotified = true;
      this.callbacks.onGameOver(this.engine.snapshot());
    }
  }

  private rotatedTarget(
    position: CellPos,
    center: CellPos,
    direction: RotationDirection,
  ): CellPos {
    const localRow = position.row - center.row;
    const localCol = position.col - center.col;
    if (direction === 1) {
      return {
        row: center.row + localCol,
        col: center.col + 1 - localRow,
      };
    }
    return {
      row: center.row + 1 - localCol,
      col: center.col + localRow,
    };
  }

  private animateRotation(
    moving: RotationTweenItem[],
    center: CellPos,
    direction: RotationDirection,
  ): Promise<void> {
    if (moving.length === 0) return Promise.resolve();
    const duration = this.engine.config.reducedMotion ? 40 : 150;
    const centerPoint = this.cellCenter({
      row: center.row + 0.5,
      col: center.col + 0.5,
    });
    const blockHalf = CELL_SIZE;

    return new Promise((resolve) => {
      let completed = 0;
      for (const item of moving) {
        const target = this.cellCenter(item.target);
        const startX = item.sprite.x;
        const startY = item.sprite.y;
        this.tweens.add({
          targets: item.sprite,
          x: target.x,
          y: target.y,
          angle: direction * 90,
          duration,
          ease: "Cubic.Out",
          onUpdate: (tween) => {
            if (this.engine.config.reducedMotion) return;
            const progress = tween.progress;
            const startAngle = Math.atan2(startY - centerPoint.y, startX - centerPoint.x);
            const endAngle = Math.atan2(target.y - centerPoint.y, target.x - centerPoint.x);
            const shortest = Phaser.Math.Angle.Wrap(endAngle - startAngle);
            const angle = startAngle + shortest * progress;
            const radius = blockHalf * 0.71;
            item.sprite.x = centerPoint.x + Math.cos(angle) * radius;
            item.sprite.y = centerPoint.y + Math.sin(angle) * radius;
          },
          onComplete: () => {
            completed += 1;
            if (completed === moving.length) resolve();
          },
        });
      }
    });
  }

  private async playMergeEvents(events: MergeEvent[]): Promise<void> {
    if (events.length === 0) return;
    for (const event of events) {
      this.renderSnapshot(event.before);
      this.callbacks.onChain(event.chain, event.timeGain);
      this.playMergeBurst(event);
      await this.animateMergeAndDrop(event);
      this.syncSpritesToBoard(event.after);
      this.playLandingEffect(event);
      await this.wait(this.engine.config.reducedMotion ? 50 : 140);
    }
    await this.wait(this.engine.config.reducedMotion ? 30 : 100);
  }

  private async animateMergeAndDrop(event: MergeEvent): Promise<void> {
    const consumed = event.group.cells
      .map((position) => {
        const piece = event.before[cellIndex(position.row, position.col)];
        return piece ? { piece, sprite: this.spritesByPieceId.get(piece.id) } : null;
      })
      .filter(
        (entry): entry is { piece: Piece; sprite: Phaser.GameObjects.Image } =>
          Boolean(entry?.sprite),
      );

    if (consumed.length > 0) {
      await Promise.all(
        consumed.map(
          ({ piece, sprite }) =>
            new Promise<void>((resolve) => {
              const targetScaleX = sprite.scaleX * 0.2;
              const targetScaleY = sprite.scaleY * 0.2;
              this.tweens.add({
                targets: sprite,
                alpha: 0,
                scaleX: targetScaleX,
                scaleY: targetScaleY,
                duration: this.engine.config.reducedMotion ? 30 : 90,
                ease: "Cubic.In",
                onComplete: () => {
                  this.spritesByPieceId.delete(piece.id);
                  sprite.destroy();
                  resolve();
                },
              });
            }),
        ),
      );
    }

    const mergedSprite = this.makePieceSprite(event.result, event.anchor);
    const targetScaleX = mergedSprite.scaleX;
    const targetScaleY = mergedSprite.scaleY;
    mergedSprite.setScale(targetScaleX * 0.3, targetScaleY * 0.3);
    this.pieceLayer.add(mergedSprite);
    this.spritesByPieceId.set(event.result.id, mergedSprite);
    this.tweens.add({
      targets: mergedSprite,
      scaleX: targetScaleX,
      scaleY: targetScaleY,
      duration: this.engine.config.reducedMotion ? 40 : 130,
      ease: "Back.Out",
    });

    await this.animateGravity(event);
  }

  private animateGravity(event: MergeEvent): Promise<void> {
    const tweens: Promise<void>[] = [];

    for (const move of event.moves) {
      const sprite = this.spritesByPieceId.get(move.pieceId);
      if (!sprite) continue;
      const target = this.cellCenter(move.to);
      const distance = Math.abs(move.to.row - move.from.row);
      tweens.push(
        this.tweenPromise({
          targets: sprite,
          x: target.x,
          y: target.y,
          duration: this.engine.config.reducedMotion ? 35 : 150 + distance * 28,
          ease: "Bounce.Out",
        }),
      );
    }

    for (const spawned of event.spawned) {
      const sprite = this.makePieceSprite(spawned.piece, spawned.from);
      this.pieceLayer.add(sprite);
      this.spritesByPieceId.set(spawned.piece.id, sprite);
      const target = this.cellCenter(spawned.to);
      const distance = spawned.to.row - spawned.from.row;
      tweens.push(
        this.tweenPromise({
          targets: sprite,
          x: target.x,
          y: target.y,
          duration: this.engine.config.reducedMotion ? 40 : 190 + distance * 24,
          ease: "Bounce.Out",
        }),
      );
    }

    return tweens.length > 0 ? Promise.all(tweens).then(() => undefined) : Promise.resolve();
  }

  private tweenPromise(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({
        ...config,
        onComplete: () => resolve(),
      });
    });
  }

  private syncSpritesToBoard(board: Board): void {
    const liveIds = new Set<number>();
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const piece = board[cellIndex(row, col)];
        if (!piece) continue;
        liveIds.add(piece.id);
        let sprite = this.spritesByPieceId.get(piece.id);
        if (!sprite) {
          sprite = this.makePieceSprite(piece, { row, col });
          this.pieceLayer.add(sprite);
          this.spritesByPieceId.set(piece.id, sprite);
        } else {
          const center = this.cellCenter({ row, col });
          sprite.setPosition(center.x, center.y);
        }
      }
    }

    for (const [pieceId, sprite] of this.spritesByPieceId) {
      if (liveIds.has(pieceId)) continue;
      sprite.destroy();
      this.spritesByPieceId.delete(pieceId);
    }
  }

  private playMergeBurst(event: MergeEvent): void {
    const center = this.cellCenter(event.anchor);
    const burst = this.add
      .image(center.x, center.y, "pieces", 17)
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0.92);
    const burstBase = (CELL_SIZE * 0.95) / 256;
    burst.setScale(burstBase * 0.35);
    this.tweens.add({
      targets: burst,
      scaleX: burstBase * 1.15,
      scaleY: burstBase * 1.15,
      alpha: 0,
      duration: this.engine.config.reducedMotion ? 100 : 320,
      ease: "Cubic.Out",
      onComplete: () => burst.destroy(),
    });

    if (event.group.result === "grail" && !this.engine.config.reducedMotion) {
      this.cameras.main.flash(180, 255, 215, 120, false);
    }
  }

  private playLandingEffect(event: MergeEvent): void {
    let resultPosition = event.anchor;
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if (event.after[cellIndex(row, col)]?.id === event.result.id) {
          resultPosition = { row, col };
        }
      }
    }
    const center = this.cellCenter(resultPosition);

    for (const spawned of event.spawned) {
      const point = this.cellCenter(spawned.to);
      const spark = this.add
        .image(point.x, point.y, "pieces", 23)
        .setOrigin(0.5)
        .setDepth(19)
        .setAlpha(0.38);
      const sparkBase = (CELL_SIZE * 0.52) / 256;
      spark.setScale(sparkBase * 0.2);
      this.tweens.add({
        targets: spark,
        scaleX: sparkBase,
        scaleY: sparkBase,
        alpha: 0,
        duration: this.engine.config.reducedMotion ? 80 : 260,
        ease: "Sine.Out",
        onComplete: () => spark.destroy(),
      });
    }

    const label = this.add
      .text(center.x, center.y - 6, `+${event.timeGain.toFixed(1)}s`, {
        fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
        fontSize: event.group.result === "grail" ? "30px" : "22px",
        fontStyle: "bold",
        color: "#ffe9a3",
        stroke: "#3a1745",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(25);
    this.tweens.add({
      targets: label,
      y: center.y - (this.engine.config.reducedMotion ? 28 : 56),
      alpha: 0,
      duration: this.engine.config.reducedMotion ? 300 : 720,
      ease: "Cubic.Out",
      onComplete: () => label.destroy(),
    });
  }

  private wait(duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(duration, () => resolve());
    });
  }

  private cellCenter(pos: CellPos): { x: number; y: number } {
    return {
      x: BOARD_X + (pos.col + 0.5) * CELL_SIZE,
      y: BOARD_Y + (pos.row + 0.5) * CELL_SIZE,
    };
  }

  private syncHud(): void {
    this.callbacks.onHud(this.engine.snapshot());
  }

  static boardMetrics(): {
    boardX: number;
    boardY: number;
    cellSize: number;
    boardPixels: number;
    canvasSize: number;
    boardMiddle: number;
  } {
    return {
      boardX: BOARD_X,
      boardY: BOARD_Y,
      cellSize: CELL_SIZE,
      boardPixels: BOARD_PIXELS,
      canvasSize: BOARD_MIDDLE * 2,
      boardMiddle: BOARD_MIDDLE,
    };
  }
}

