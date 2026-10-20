import { countGrails, generateInitialBoard, resolveBoard, type IdCounter } from "./board";
import type { RunConfig } from "./config";
import { createSeed, Rng } from "./rng";
import type {
  Board,
  CellPos,
  GameSnapshot,
  GameStatus,
  RotationDirection,
  RotationOutcome,
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
    );
    this.nextId = idCounter.value;

    this.timeLeftMs += outcome.timeGain * 1000;
    this.score += outcome.scoreGain;
    this.lastChain = outcome.chain;
    this.maxChain = Math.max(this.maxChain, outcome.chain);
    this.grails = countGrails(this.board);
    return outcome;
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
      seed: this.seed,
    };
  }
}

