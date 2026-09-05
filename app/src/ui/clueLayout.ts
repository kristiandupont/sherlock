import type { Clue } from "../model/types";
import { tileName } from "./tileSets";

export type Point = { x: number; y: number };

/**
 * Exact card footprints. ClueCard renders at these sizes, so the arrangements
 * below place cards without having to measure them.
 */
export function cardSize(clue: Clue): { width: number; height: number } {
  switch (clue.kind) {
    case "same-column":
      return { width: 56, height: 90 };
    case "different-column":
      return { width: 56, height: 104 };
    case "adjacent":
      return { width: 96, height: 72 };
    case "left-of":
      return { width: 116, height: 56 };
    case "between":
      return { width: 138, height: 72 };
  }
}

const GAP = 12;

/**
 * The starting arrangement: cards grouped by kind, each kind on its own row.
 * From there the player drags them wherever they like, which is the point of
 * the canvas, so nothing rearranges them again.
 */
export function layoutCluesByKind(clues: Clue[], width: number): Point[] {
  const order = ["same-column", "different-column", "adjacent", "left-of", "between"] as const;
  const positions = new Array<Point>(clues.length);
  const usable = Math.max(width - GAP, 200);
  let y = GAP;

  for (const kind of order) {
    const indices = clues.map((clue, index) => ({ clue, index })).filter((e) => e.clue.kind === kind);
    if (indices.length === 0) continue;
    let x = GAP;
    let rowHeight = 0;
    for (const { clue, index } of indices) {
      const { width: w, height: h } = cardSize(clue);
      if (x + w > usable && x > GAP) {
        x = GAP;
        y += rowHeight + GAP;
        rowHeight = 0;
      }
      positions[index] = { x, y };
      x += w + GAP;
      rowHeight = Math.max(rowHeight, h);
    }
    y += rowHeight + GAP * 2;
  }
  return positions;
}

export function describeClue(clue: Clue): string {
  const name = (ref: { row: number; tile: number }) => tileName(ref.row, ref.tile);
  switch (clue.kind) {
    case "same-column":
      return `${name(clue.a)} and ${name(clue.b)} are in the same column`;
    case "different-column":
      return `${name(clue.a)} and ${name(clue.b)} are not in the same column`;
    case "adjacent":
      return `${name(clue.a)} and ${name(clue.b)} are in neighbouring columns`;
    case "left-of":
      return `${name(clue.left)} is somewhere left of ${name(clue.right)}`;
    case "between":
      return `${name(clue.middle)} is directly between ${name(clue.a)} and ${name(clue.b)}, in either order`;
  }
}
