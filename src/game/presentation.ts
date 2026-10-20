import { CORE_COLORS, type Piece } from "./types";

const colorIndex = new Map(CORE_COLORS.map((color, index) => [color, index]));

export function pieceFrame(piece: Piece): number {
  if (piece.kind === "wildcard") return 4;
  if (piece.kind === "grail") return 5;
  return (piece.tier - 1) * 6 + (colorIndex.get(piece.color) ?? 0);
}

export function formatTime(milliseconds: number): string {
  const safe = Math.max(0, milliseconds);
  const totalSeconds = safe / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((safe % 1000) / 100);
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${tenths}`;
}

export function formatScore(score: number): string {
  return score.toLocaleString("zh-CN");
}

