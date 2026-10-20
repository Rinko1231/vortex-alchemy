export const BOARD_SIZE = 8;
export const CORE_COLORS = ["black", "white", "red", "yellow"] as const;

export type CoreColor = (typeof CORE_COLORS)[number];
export type Tier = 1 | 2 | 3 | 4;
export type RotationDirection = 1 | -1;

export type Piece =
  | { id: number; kind: "core"; color: CoreColor; tier: Tier }
  | { id: number; kind: "wildcard" }
  | { id: number; kind: "grail" };

export type Cell = Piece | null;
export type Board = Cell[];

export interface CellPos {
  row: number;
  col: number;
}

export interface MergeGroup {
  top: number;
  left: number;
  cells: CellPos[];
  result: 2 | 3 | 4 | "grail";
  color: CoreColor | null;
}

export interface GravityMove {
  pieceId: number;
  from: CellPos;
  to: CellPos;
}

export interface SpawnedPiece {
  piece: Piece;
  from: CellPos;
  to: CellPos;
}

export interface GravityResult {
  moves: GravityMove[];
  spawned: SpawnedPiece[];
}

export interface MergeEvent {
  chain: number;
  group: MergeGroup;
  anchor: CellPos;
  result: Piece;
  timeGain: number;
  scoreGain: number;
  before: Board;
  moves: GravityMove[];
  spawned: SpawnedPiece[];
  after: Board;
}

export interface RotationOutcome {
  center: CellPos;
  direction: RotationDirection;
  chain: number;
  timeGain: number;
  scoreGain: number;
  grailsGained: number;
  events: MergeEvent[];
}

export type GameStatus = "ready" | "playing" | "resolving" | "paused" | "game-over";

export interface GameSnapshot {
  status: GameStatus;
  timeLeftMs: number;
  score: number;
  chain: number;
  maxChain: number;
  grails: number;
  seed: string;
}

export function isCorePiece(piece: Piece): piece is Extract<Piece, { kind: "core" }> {
  return piece.kind === "core";
}

export function isWildcard(piece: Piece): piece is Extract<Piece, { kind: "wildcard" }> {
  return piece.kind === "wildcard";
}

export function isGrail(piece: Piece): piece is Extract<Piece, { kind: "grail" }> {
  return piece.kind === "grail";
}

export function cellIndex(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

export function positionsFor2x2(top: number, left: number): CellPos[] {
  return [
    { row: top, col: left },
    { row: top, col: left + 1 },
    { row: top + 1, col: left },
    { row: top + 1, col: left + 1 },
  ];
}

