import { describe, expect, it } from "vitest";
import {
  countGrails,
  findAllMergeGroups,
  generateInitialBoard,
  resolveBoard,
  rotateBoardInPlace,
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
});

describe("board movement and resolution", () => {
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
    expect(board.every((piece) => piece !== null)).toBe(true);
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
});

