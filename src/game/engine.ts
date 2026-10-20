import {
  cloneBoard,
  countGrails,
  findAllMergeGroups,
  generateInitialBoard,
  resolveBoard,
  resolveExistingCascades,
  type IdCounter,
} from "./board";
import type { RunConfig } from "./config";
import { createSeed, Rng } from "./rng";
import { BOARD_SIZE, cellIndex } from "./types";
import type {
  Board,
  CellPos,
  GameSnapshot,
  GameStatus,
  ItemCounts,
  ItemType,
  ItemUseResult,
  Piece,
  RotationDirection,
  RotationOutcome,
  CascadeResolution,
} from "./types";

export class GameEngine {
  board: Board;
  config: RunConfig;
  seed: string;
  status: GameStatus = "ready";
  timeLeftMs: number;
  score = 0;
  lastChain = 0;
  maxChain = 0;
  grails = 0;
  grailsMade = 0;
  items: ItemCounts = { wildcard: 0, upgrade: 0 };

  private rng: Rng;
  private nextId: number;

  constructor(config: RunConfig, seed = createSeed()) {
    this.config = { ...config };
    this.seed = seed;
    this.rng = new Rng(seed);

    const initial = generateInitialBoard(config, this.rng);
    this.board = initial.board;
    this.nextId = initial.nextId;
    this.timeLeftMs = config.startingTimeSec * 1000;
  }

  reset(config = this.config, seed = createSeed()): void {
    this.config = { ...config };
    this.seed = seed;
    this.rng = new Rng(seed);
    const initial = generateInitialBoard(this.config, this.rng);
    this.board = initial.board;
    this.nextId = initial.nextId;
    this.timeLeftMs = this.config.startingTimeSec * 1000;
    this.score = 0;
    this.lastChain = 0;
    this.maxChain = 0;
    this.grails = 0;
    this.grailsMade = 0;
    this.items = { wildcard: 0, upgrade: 0 };
    this.status = "ready";
  }

  start(): void {
    if (this.status === "ready") {
      this.status = "playing";
    }
  }

  tick(deltaMs: number): void {
    if (this.status !== "playing" && this.status !== "resolving") return;
    this.timeLeftMs = Math.max(0, this.timeLeftMs - Math.max(0, deltaMs));
    if (this.timeLeftMs <= 0 && this.status === "playing") {
      this.status = "game-over";
    }
  }

  rotate(row: number, col: number, direction: RotationDirection): RotationOutcome | null {
    if (this.status !== "playing") return null;
    if (row < 0 || row > 6 || col < 0 || col > 6) return null;
    if (direction === -1 && !this.config.reverseRotation) return null;

    this.status = "resolving";
    const center: CellPos = { row, col };
    const idCounter: IdCounter = { value: this.nextId };
    const outcome = resolveBoard(
      this.board,
      center,
      direction,
      this.config,
      this.rng,
      idCounter,
      this.grailsMade,
    );
    this.nextId = idCounter.value;

    this.applyCascadeRewards(outcome);
    return outcome;
  }

  useItem(item: ItemType): ItemUseResult | null {
    if (this.status !== "playing" || this.items[item] <= 0) return null;

    const candidates: Array<{ position: CellPos; piece: Piece }> = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const piece = this.board[cellIndex(row, col)];
        if (!piece || piece.kind === "grail") continue;
        if (item === "upgrade" && (piece.kind !== "core" || piece.tier > 2)) continue;
        if (item === "wildcard" && piece.kind !== "core") continue;
        candidates.push({ position: { row, col }, piece });
      }
    }

    if (candidates.length === 0) return null;
    const chosen = candidates[this.rng.nextInt(candidates.length)]!;
    let after: Piece;
    if (item === "wildcard") {
      after = { id: chosen.piece.id, kind: "wildcard" };
    } else {
      if (chosen.piece.kind !== "core" || chosen.piece.tier > 2) return null;
      after = {
        id: chosen.piece.id,
        kind: "core",
        color: chosen.piece.color,
        tier: (chosen.piece.tier + 1) as 2 | 3,
      };
    }
    this.board[cellIndex(chosen.position.row, chosen.position.col)] = after;
    this.items[item] -= 1;

    const boardAfterItem = cloneBoard(this.board);
    let cascade: CascadeResolution | null = null;
    if (findAllMergeGroups(this.board).length > 0) {
      this.status = "resolving";
      const idCounter: IdCounter = { value: this.nextId };
      cascade = resolveExistingCascades(
        this.board,
        this.config,
        this.rng,
        idCounter,
        chosen.position,
        this.grailsMade,
      );
      this.nextId = idCounter.value;
      this.applyCascadeRewards(cascade);
    }

    return {
      item,
      position: chosen.position,
      before: chosen.piece,
      after,
      boardAfterItem,
      cascade,
    };
  }

  finishResolution(): void {
    if (this.status !== "resolving") return;
    this.status = this.timeLeftMs <= 0 ? "game-over" : "playing";
  }

  pause(): boolean {
    if (this.status !== "playing") return false;
    this.status = "paused";
    return true;
  }

  resume(): boolean {
    if (this.status !== "paused") return false;
    this.status = "playing";
    return true;
  }

  forceGameOver(): void {
    this.status = "game-over";
  }

  snapshot(): GameSnapshot {
    return {
      status: this.status,
      timeLeftMs: this.timeLeftMs,
      score: this.score,
      chain: this.lastChain,
      maxChain: this.maxChain,
      grails: this.grails,
      grailsMade: this.grailsMade,
      items: { ...this.items },
      seed: this.seed,
    };
  }

  private applyCascadeRewards(cascade: CascadeResolution): void {
    this.timeLeftMs += cascade.timeGain * 1000;
    this.score += cascade.scoreGain;
    this.lastChain = cascade.chain;
    this.maxChain = Math.max(this.maxChain, cascade.chain);
    this.grailsMade += cascade.grailsGained;
    this.grails = countGrails(this.board);
    for (const item of cascade.itemsAwarded) {
      this.items[item] += 1;
    }
  }
}

