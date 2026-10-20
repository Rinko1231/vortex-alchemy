import type { RunConfig } from "./config";
import type { Rng } from "./rng";
import {
  BOARD_SIZE,
  CORE_COLORS,
  cellIndex,
  isCorePiece,
  isGrail,
  isWildcard,
  positionsFor2x2,
  type Board,
  type CascadeResolution,
  type CellPos,
  type CoreColor,
  type GravityMove,
  type GravityResult,
  type ItemType,
  type MergeEvent,
  type MergeGroup,
  type Piece,
  type RotationDirection,
  type RotationOutcome,
  type SpawnedPiece,
  type Tier,
} from "./types";

export interface IdCounter {
  value: number;
}

export interface InitialBoardResult {
  board: Board;
  nextId: number;
}

const WHITE: CoreColor = "white";

export function createCorePiece(
  id: number,
  color: CoreColor,
  tier: Tier,
): Piece {
  return { id, kind: "core", color, tier };
}

function applyBonus(piece: Piece, config: RunConfig, rng: Rng): Piece {
  if (piece.kind === "grail" || rng.next() * 100 >= config.bonusChance) return piece;
  return {
    ...piece,
    bonus: rng.next() < 0.5 ? "wildcard" : "upgrade",
  };
}

export function spawnPiece(
  id: number,
  config: RunConfig,
  rng: Rng,
  grailsMade = 0,
): Piece {
  const tier1 = Math.max(0, config.tier1Weight);
  const tier2 = Math.min(
    80,
    Math.max(0, config.tier2Weight + config.tier2BonusPerGrail * grailsMade),
  );
  const wildcard = Math.max(0, config.wildcardWeight);
  const total = tier1 + tier2 + wildcard;

  if (total <= 0) {
    return applyBonus({ id, kind: "core", color: rng.pick(CORE_COLORS), tier: 1 }, config, rng);
  }

  const roll = rng.next() * total;
  if (roll < tier2) {
    return applyBonus({ id, kind: "core", color: rng.pick(CORE_COLORS), tier: 2 }, config, rng);
  }
  if (roll < tier2 + wildcard) {
    return applyBonus({ id, kind: "wildcard" }, config, rng);
  }
  return applyBonus({ id, kind: "core", color: rng.pick(CORE_COLORS), tier: 1 }, config, rng);
}

export function fillBoard(
  config: RunConfig,
  rng: Rng,
  startId: number,
  grailsMade = 0,
): InitialBoardResult {
  const board: Board = [];
  let nextId = startId;
  for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) {
    board.push(spawnPiece(nextId, config, rng, grailsMade));
    nextId += 1;
  }
  return { board, nextId };
}

export function cloneBoard(board: Board): Board {
  return board.map((piece) => (piece ? { ...piece } : null));
}

export function findAllMergeGroups(board: Board): MergeGroup[] {
  const groups: MergeGroup[] = [];

  for (let top = 0; top < BOARD_SIZE - 1; top += 1) {
    for (let left = 0; left < BOARD_SIZE - 1; left += 1) {
      const cells = positionsFor2x2(top, left);
      const pieces = cells.map((position) => board[cellIndex(position.row, position.col)]);
      if (pieces.some((piece) => piece === null)) continue;

      const present = pieces as Piece[];
      if (present.some(isGrail)) continue;

      const wildcards = present.filter(isWildcard);
      const cores = present.filter(isCorePiece);

      if (wildcards.length === 4) {
        groups.push({ top, left, cells, result: "grail", color: null });
        continue;
      }

      if (
        cores.length === 4 &&
        cores.every((piece) => piece.tier === 4) &&
        new Set(cores.map((piece) => piece.color)).size === 4
      ) {
        groups.push({ top, left, cells, result: "grail", color: null });
        continue;
      }

      if (
        cores.length === 4 &&
        cores.every(
          (piece) =>
            piece.color === cores[0]?.color &&
            piece.tier === cores[0]?.tier &&
            piece.tier < 4,
        )
      ) {
        groups.push({
          top,
          left,
          cells,
          result: (cores[0]!.tier + 1) as 2 | 3 | 4,
          color: cores[0]!.color,
        });
        continue;
      }

      if (
        wildcards.length > 0 &&
        cores.length > 0 &&
        cores.every((piece) => piece.tier === 1 && piece.color === cores[0]?.color)
      ) {
        groups.push({
          top,
          left,
          cells,
          result: 2,
          color: cores[0]!.color,
        });
      }
    }
  }

  return groups;
}

function groupPriority(group: MergeGroup): number {
  if (group.result === "grail") return 5;
  return group.result;
}

function distance(a: { row: number; col: number }, b: { row: number; col: number }): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function chooseMergeGroup(
  groups: MergeGroup[],
  lastAnchor: CellPos | null,
  rotationCenter: CellPos,
): MergeGroup {
  const pivot = lastAnchor ?? rotationCenter;
  return [...groups].sort((left, right) => {
    const priority = groupPriority(right) - groupPriority(left);
    if (priority !== 0) return priority;

    const leftDistance = distance({ row: left.top, col: left.left }, pivot);
    const rightDistance = distance({ row: right.top, col: right.left }, pivot);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    if (left.top !== right.top) return left.top - right.top;
    return left.left - right.left;
  })[0]!;
}

export function rotateBoardInPlace(
  board: Board,
  top: number,
  left: number,
  direction: RotationDirection,
): void {
  const topLeftIndex = cellIndex(top, left);
  const topRightIndex = cellIndex(top, left + 1);
  const bottomRightIndex = cellIndex(top + 1, left + 1);
  const bottomLeftIndex = cellIndex(top + 1, left);

  const topLeft = board[topLeftIndex]!;
  const topRight = board[topRightIndex]!;
  const bottomRight = board[bottomRightIndex]!;
  const bottomLeft = board[bottomLeftIndex]!;

  if (direction === 1) {
    board[topRightIndex] = topLeft;
    board[bottomRightIndex] = topRight;
    board[bottomLeftIndex] = bottomRight;
    board[topLeftIndex] = bottomLeft;
  } else {
    board[topLeftIndex] = topRight;
    board[topRightIndex] = bottomRight;
    board[bottomRightIndex] = bottomLeft;
    board[bottomLeftIndex] = topLeft;
  }
}

export function hasPlayableRotation(board: Board): boolean {
  for (let top = 0; top < BOARD_SIZE - 1; top += 1) {
    for (let left = 0; left < BOARD_SIZE - 1; left += 1) {
      for (const direction of [1, -1] as const) {
        const copy = cloneBoard(board);
        rotateBoardInPlace(copy, top, left, direction);
        if (findAllMergeGroups(copy).length > 0) return true;
      }
    }
  }
  return false;
}

export function generateInitialBoard(
  config: RunConfig,
  rng: Rng,
  startId = 1,
): InitialBoardResult {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const generated = fillBoard(config, rng, startId);
    if (findAllMergeGroups(generated.board).length > 0) continue;
    if (!hasPlayableRotation(generated.board)) continue;
    return generated;
  }

  return fillBoard(config, rng, startId);
}

function baseTimeGain(result: MergeGroup["result"], config: RunConfig): number {
  if (result === "grail") return config.gainGrail;
  if (result === 4) return config.gainTier4;
  if (result === 3) return config.gainTier3;
  return config.gainTier2;
}

function baseScore(result: MergeGroup["result"]): number {
  if (result === "grail") return 5000;
  if (result === 4) return 900;
  if (result === 3) return 300;
  return 100;
}

function chainMultiplier(chain: number, config: RunConfig): number {
  const steps = Math.max(0, chain - 1);
  return Math.min(config.chainCap, 1 + config.chainStep * steps);
}

function mergedPiece(group: MergeGroup, id: number): Piece {
  if (group.result === "grail") {
    return { id, kind: "grail" };
  }
  return {
    id,
    kind: "core",
    color: group.color ?? WHITE,
    tier: group.result,
  };
}

export function applyGravityAndRefill(
  board: Board,
  config: RunConfig,
  rng: Rng,
  idCounter: IdCounter,
  grailsMade = 0,
): GravityResult {
  const moves: GravityMove[] = [];
  const spawned: SpawnedPiece[] = [];

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let writeRow = BOARD_SIZE - 1;

    for (let readRow = BOARD_SIZE - 1; readRow >= 0; readRow -= 1) {
      const piece = board[cellIndex(readRow, col)];
      if (!piece) continue;

      if (readRow !== writeRow) {
        board[cellIndex(readRow, col)] = null;
        board[cellIndex(writeRow, col)] = piece;
        moves.push({
          pieceId: piece.id,
          from: { row: readRow, col },
          to: { row: writeRow, col },
        });
      }
      writeRow -= 1;
    }

    const emptyCount = writeRow + 1;
    for (let row = 0; row <= writeRow; row += 1) {
      const piece = spawnPiece(idCounter.value, config, rng, grailsMade);
      idCounter.value += 1;
      board[cellIndex(row, col)] = piece;
      spawned.push({
        piece,
        from: { row: row - emptyCount, col },
        to: { row, col },
      });
    }
  }

  return { moves, spawned };
}

function resolveCascades(
  board: Board,
  priorityCenter: CellPos,
  config: RunConfig,
  rng: Rng,
  idCounter: IdCounter,
  grailsMade: number,
): CascadeResolution {
  const events: MergeEvent[] = [];
  let chain = 0;
  let lastAnchor: CellPos | null = null;
  let timeGain = 0;
  let scoreGain = 0;
  let grailsGained = 0;
  let currentGrailsMade = grailsMade;
  const itemsAwarded: ItemType[] = [];

  while (chain < 64) {
    const groups = findAllMergeGroups(board);
    if (groups.length === 0) break;

    const group = chooseMergeGroup(groups, lastAnchor, priorityCenter);
    const anchor = { row: group.top, col: group.left };
    const before = cloneBoard(board);
    const eventItems = group.cells.flatMap((position) => {
      const piece = before[cellIndex(position.row, position.col)];
      return piece?.bonus ? [piece.bonus] : [];
    });
    const result = mergedPiece(group, idCounter.value);
    idCounter.value += 1;

    for (const position of group.cells) {
      board[cellIndex(position.row, position.col)] = null;
    }
    board[cellIndex(anchor.row, anchor.col)] = result;

    if (group.result === "grail") {
      grailsGained += 1;
      currentGrailsMade += 1;
    }

    const gravity = applyGravityAndRefill(
      board,
      config,
      rng,
      idCounter,
      currentGrailsMade,
    );
    const after = cloneBoard(board);

    chain += 1;
    const multiplier = chainMultiplier(chain, config);
    const eventTime = baseTimeGain(group.result, config) * multiplier;
    const eventScore = Math.round(baseScore(group.result) * multiplier);

    timeGain += eventTime;
    scoreGain += eventScore;
    itemsAwarded.push(...eventItems);

    events.push({
      chain,
      group,
      anchor,
      result,
      timeGain: eventTime,
      scoreGain: eventScore,
      itemsAwarded: eventItems,
      before,
      moves: gravity.moves,
      spawned: gravity.spawned,
      after,
    });
    lastAnchor = anchor;
  }

  return {
    chain,
    timeGain,
    scoreGain,
    grailsGained,
    itemsAwarded,
    events,
  };
}

export function resolveBoard(
  board: Board,
  rotationCenter: CellPos,
  direction: RotationDirection,
  config: RunConfig,
  rng: Rng,
  idCounter: IdCounter,
  grailsMade = 0,
): RotationOutcome {
  rotateBoardInPlace(board, rotationCenter.row, rotationCenter.col, direction);
  return {
    ...resolveCascades(board, rotationCenter, config, rng, idCounter, grailsMade),
    center: rotationCenter,
    direction,
  };
}

export function resolveExistingCascades(
  board: Board,
  config: RunConfig,
  rng: Rng,
  idCounter: IdCounter,
  priorityCenter: CellPos,
  grailsMade = 0,
): CascadeResolution {
  return resolveCascades(board, priorityCenter, config, rng, idCounter, grailsMade);
}

export function countGrails(board: Board): number {
  return board.filter((piece) => piece?.kind === "grail").length;
}

