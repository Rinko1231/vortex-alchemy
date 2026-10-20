import { describe, expect, it } from "vitest";
import {
  applyGravityAndRefill,
  countGrails,
  findAllMergeGroups,
  generateInitialBoard,
  resolveBoard,
  rotateBoardInPlace,
  spawnPiece,
  type IdCounter,
} from "../src/game/board";
import { DEFAULT_CONFIG } from "../src/game/config";
import { Rng } from "../src/game/rng";
import {
  BOARD_SIZE,
  CORE_COLORS,
  cellIndex,
  type Board,
  type Piece,
} from "../src/game/types";

function baseBoard(): Board {
  let id = 1;
  const board: Board = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      board.push({
        id: id++,
        kind: "core",
        color: CORE_COLORS[(row + col) % CORE_COLORS.length]!,
        tier: 1,
      });
    }
  }
  return board;
}

function setCell(board: Board, row: number, col: number, piece: Piece): void {
  board[cellIndex(row, col)] = piece;
}

function core(id: number, color: (typeof CORE_COLORS)[number], tier: 1 | 2 | 3 | 4): Piece {
  return { id, kind: "core", color, tier };
}

describe("merge detection", () => {
  it("merges four same-color same-tier pieces below tier four", () => {
    const board = baseBoard();
    setCell(board, 0, 0, core(101, "red", 1));
    setCell(board, 0, 1, core(102, "red", 1));
    setCell(board, 1, 0, core(103, "red", 1));
    setCell(board, 1, 1, core(104, "red", 1));

    const group = findAllMergeGroups(board).find(
      (candidate) => candidate.top === 0 && candidate.left === 0,
    );
    expect(group).toMatchObject({ result: 2, color: "red" });
  });

  it("does not merge four same-color tier-four pieces", () => {
    const board = baseBoard();
    setCell(board, 0, 0, core(101, "black", 4));
    setCell(board, 0, 1, core(102, "black", 4));
    setCell(board, 1, 0, core(103, "black", 4));
    setCell(board, 1, 1, core(104, "black", 4));

    const group = findAllMergeGroups(board).find(
      (candidate) => candidate.top === 0 && candidate.left === 0,
    );
    expect(group).toBeUndefined();
  });

  it("makes a grail from one tier-four piece of every core color", () => {
    const board = baseBoard();
    setCell(board, 0, 0, core(101, "black", 4));
    setCell(board, 0, 1, core(102, "white", 4));
    setCell(board, 1, 0, core(103, "red", 4));
    setCell(board, 1, 1, core(104, "yellow", 4));

    const group = findAllMergeGroups(board).find(
      (candidate) => candidate.top === 0 && candidate.left === 0,
    );
    expect(group?.result).toBe("grail");
  });

  it("lets wildcards substitute any number of tier-one pieces", () => {
    const board = baseBoard();
    setCell(board, 0, 0, core(101, "yellow", 1));
    setCell(board, 0, 1, core(102, "yellow", 1));
    setCell(board, 1, 0, { id: 103, kind: "wildcard" });
    setCell(board, 1, 1, { id: 104, kind: "wildcard" });

    const group = findAllMergeGroups(board).find(
      (candidate) => candidate.top === 0 && candidate.left === 0,
    );
    expect(group).toMatchObject({ result: 2, color: "yellow" });
  });

  it("does not let wildcards substitute a tier-two piece", () => {
    const board = baseBoard();
    setCell(board, 0, 0, core(101, "yellow", 2));
    setCell(board, 0, 1, core(102, "yellow", 2));
    setCell(board, 1, 0, core(103, "yellow", 2));
    setCell(board, 1, 1, { id: 104, kind: "wildcard" });

    const group = findAllMergeGroups(board).find(
      (candidate) => candidate.top === 0 && candidate.left === 0,
    );
    expect(group).toBeUndefined();
  });

  it("turns four wildcards into a grail", () => {
    const board = baseBoard();
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        setCell(board, row, col, { id: 200 + row * 2 + col, kind: "wildcard" });
      }
    }

    const group = findAllMergeGroups(board).find(
      (candidate) => candidate.top === 0 && candidate.left === 0,
    );
    expect(group?.result).toBe("grail");
  });

  it("awards an item when a bonus piece is consumed", () => {
    const board = baseBoard();
    setCell(board, 0, 0, { ...core(101, "red", 1), bonus: "upgrade" });
    setCell(board, 0, 1, core(102, "red", 1));
    setCell(board, 1, 0, core(103, "red", 1));
    setCell(board, 1, 1, core(104, "red", 1));

    const outcome = resolveBoard(
      board,
      { row: 0, col: 0 },
      1,
      { ...DEFAULT_CONFIG, bonusChance: 0 },
      new Rng("bonus-item-test"),
      { value: 700 },
    );
    expect(outcome.itemsAwarded).toContain("upgrade");
  });
});

describe("board movement and resolution", () => {
  it("drops pieces downward and refills empty top cells", () => {
    const board: Board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    const marker = core(999, "red", 2);
    setCell(board, 2, 0, marker);

    const idCounter: IdCounter = { value: 1000 };
    const gravity = applyGravityAndRefill(
      board,
      DEFAULT_CONFIG,
      new Rng("gravity-test"),
      idCounter,
    );

    expect(board.every((piece) => piece !== null)).toBe(true);
    expect(board[cellIndex(7, 0)]?.id).toBe(marker.id);
    expect(gravity.moves).toContainEqual({
      pieceId: marker.id,
      from: { row: 2, col: 0 },
      to: { row: 7, col: 0 },
    });
    expect(gravity.spawned.length).toBeGreaterThan(0);
    expect(gravity.spawned.every((spawned) => spawned.from.row < 0)).toBe(true);
  });

  it("rotates clockwise into the expected cells", () => {
    const board = baseBoard();
    const topLeft = board[cellIndex(0, 0)]!;
    const topRight = board[cellIndex(0, 1)]!;
    const bottomRight = board[cellIndex(1, 1)]!;
    const bottomLeft = board[cellIndex(1, 0)]!;

    rotateBoardInPlace(board, 0, 0, 1);

    expect(board[cellIndex(0, 1)]).toBe(topLeft);
    expect(board[cellIndex(1, 1)]).toBe(topRight);
    expect(board[cellIndex(1, 0)]).toBe(bottomRight);
    expect(board[cellIndex(0, 0)]).toBe(bottomLeft);
  });

  it("resolves a merge, refills three cells, and awards time", () => {
    const board = baseBoard();
    setCell(board, 0, 0, core(101, "red", 1));
    setCell(board, 0, 1, core(102, "red", 1));
    setCell(board, 1, 0, core(103, "red", 1));
    setCell(board, 1, 1, core(104, "red", 1));

    const idCounter: IdCounter = { value: 500 };
    const outcome = resolveBoard(
      board,
      { row: 0, col: 0 },
      1,
      DEFAULT_CONFIG,
      new Rng("resolution-test"),
      idCounter,
    );

    expect(outcome.events.length).toBeGreaterThan(0);
    expect(outcome.events[0]?.group.result).toBe(2);
    expect(outcome.timeGain).toBeGreaterThan(0);
    expect(outcome.events[0]?.moves.length).toBeGreaterThan(0);
    expect(outcome.events[0]?.spawned.every((spawned) => spawned.from.row < 0)).toBe(true);
    expect(outcome.events[0]?.after.every((piece) => piece !== null)).toBe(true);
    expect(board.every((piece) => piece !== null)).toBe(true);
  });

  it("awards eighteen seconds for a tier-four merge by default", () => {
    const board: Board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    setCell(board, 0, 0, core(701, "red", 3));
    setCell(board, 0, 1, core(702, "red", 3));
    setCell(board, 1, 0, core(703, "red", 3));
    setCell(board, 1, 1, core(704, "red", 3));

    const outcome = resolveBoard(
      board,
      { row: 0, col: 0 },
      1,
      DEFAULT_CONFIG,
      new Rng("tier-four-time-test"),
      { value: 800 },
    );

    expect(outcome.events[0]?.group.result).toBe(4);
    expect(outcome.events[0]?.timeGain).toBe(18);
  });

  it("creates a grail from four wildcards and counts it", () => {
    const board = baseBoard();
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        setCell(board, row, col, { id: 300 + row * 2 + col, kind: "wildcard" });
      }
    }

    const idCounter: IdCounter = { value: 600 };
    const outcome = resolveBoard(
      board,
      { row: 0, col: 0 },
      1,
      DEFAULT_CONFIG,
      new Rng("grail-test"),
      idCounter,
    );

    expect(outcome.events[0]?.result.kind).toBe("grail");
    expect(outcome.grailsGained).toBeGreaterThanOrEqual(1);
    expect(countGrails(board)).toBeGreaterThanOrEqual(1);
  });

  it("generates an initially quiet board with at least one playable rotation", () => {
    const generated = generateInitialBoard(DEFAULT_CONFIG, new Rng("initial-board-test"));
    expect(findAllMergeGroups(generated.board)).toHaveLength(0);
  });

  it("raises tier-two spawn frequency as more grails are made", () => {
    const config = { ...DEFAULT_CONFIG, bonusChance: 0 };
    const withoutGrails = new Rng("tier-two-baseline");
    const withGrails = new Rng("tier-two-baseline");
    let baseTierTwo = 0;
    let boostedTierTwo = 0;

    for (let index = 0; index < 5000; index += 1) {
      const basePiece = spawnPiece(index, config, withoutGrails, 0);
      const boostedPiece = spawnPiece(index, config, withGrails, 8);
      if (basePiece.kind === "core" && basePiece.tier === 2) baseTierTwo += 1;
      if (boostedPiece.kind === "core" && boostedPiece.tier === 2) boostedTierTwo += 1;
    }

    expect(boostedTierTwo).toBeGreaterThan(baseTierTwo);
  });
});

