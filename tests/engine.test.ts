import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/game/config";
import { GameEngine } from "../src/game/engine";
import { cellIndex, type Board, type Piece } from "../src/game/types";

function put(board: Board, row: number, col: number, piece: Piece): void {
  board[cellIndex(row, col)] = piece;
}

describe("item use", () => {
  it("uses a wildcard item on a core piece and consumes exactly one", () => {
    const engine = new GameEngine(
      { ...DEFAULT_CONFIG, bonusChance: 0 },
      "wildcard-item-engine-test",
    );
    engine.start();
    engine.board = Array(64).fill(null);
    put(engine.board, 0, 0, {
      id: 900,
      kind: "core",
      color: "red",
      tier: 4,
      bonus: "upgrade",
    });
    put(engine.board, 0, 1, { id: 901, kind: "grail" });
    put(engine.board, 0, 2, { id: 902, kind: "wildcard" });
    engine.items.wildcard = 2;

    const result = engine.useItem("wildcard");
    expect(result?.position).toEqual({ row: 0, col: 0 });
    expect(result?.before).toMatchObject({ id: 900, kind: "core", tier: 4 });
    expect(result?.after.kind).toBe("wildcard");
    expect(engine.items.wildcard).toBe(1);
    expect(engine.board[cellIndex(0, 0)]).toEqual({ id: 900, kind: "wildcard" });
    expect(engine.board[cellIndex(0, 1)]?.kind).toBe("grail");
    expect(engine.board[cellIndex(0, 2)]?.kind).toBe("wildcard");
  });

  it("uses an upgrade item on a tier-two core piece and consumes exactly one", () => {
    const engine = new GameEngine(
      { ...DEFAULT_CONFIG, bonusChance: 0 },
      "upgrade-item-engine-test",
    );
    engine.start();
    engine.board = Array(64).fill(null);
    put(engine.board, 2, 3, { id: 910, kind: "core", color: "yellow", tier: 2 });
    put(engine.board, 2, 4, { id: 911, kind: "core", color: "red", tier: 3 });
    put(engine.board, 2, 5, { id: 912, kind: "wildcard" });
    put(engine.board, 2, 6, { id: 913, kind: "grail" });
    engine.items.upgrade = 2;

    const result = engine.useItem("upgrade");
    expect(result?.position).toEqual({ row: 2, col: 3 });
    expect(result?.before).toMatchObject({ id: 910, kind: "core", tier: 2 });
    expect(result?.after).toMatchObject({
      id: 910,
      kind: "core",
      color: "yellow",
      tier: 3,
    });
    expect(engine.items.upgrade).toBe(1);
    expect(engine.board[cellIndex(2, 3)]).toMatchObject({
      id: 910,
      kind: "core",
      color: "yellow",
      tier: 3,
    });
  });

  it("turns a tier-one core into tier two with the same color", () => {
    const engine = new GameEngine(
      { ...DEFAULT_CONFIG, bonusChance: 0 },
      "upgrade-tier-one-engine-test",
    );
    engine.start();
    engine.board = Array(64).fill(null);
    put(engine.board, 4, 4, { id: 920, kind: "core", color: "black", tier: 1 });
    engine.items.upgrade = 1;

    const result = engine.useItem("upgrade");
    expect(result?.after).toMatchObject({
      id: 920,
      kind: "core",
      color: "black",
      tier: 2,
    });
    expect(engine.items.upgrade).toBe(0);
  });

  it("keeps the item when no legal target exists", () => {
    const engine = new GameEngine(
      { ...DEFAULT_CONFIG, bonusChance: 0 },
      "item-no-target-engine-test",
    );
    engine.start();
    engine.board = Array(64).fill(null);
    put(engine.board, 0, 0, { id: 930, kind: "grail" });
    put(engine.board, 0, 1, { id: 931, kind: "wildcard" });
    put(engine.board, 0, 2, { id: 932, kind: "core", color: "white", tier: 3 });
    put(engine.board, 0, 3, { id: 933, kind: "core", color: "white", tier: 4 });
    engine.items.wildcard = 1;
    engine.items.upgrade = 1;

    expect(engine.useItem("upgrade")).toBeNull();
    expect(engine.items.upgrade).toBe(1);

    engine.board = Array(64).fill(null);
    put(engine.board, 0, 0, { id: 940, kind: "grail" });
    put(engine.board, 0, 1, { id: 941, kind: "wildcard" });
    expect(engine.useItem("wildcard")).toBeNull();
    expect(engine.items.wildcard).toBe(1);
  });
});

