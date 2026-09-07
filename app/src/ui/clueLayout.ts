import { CLUE_KINDS, type Clue, type ClueKind } from "../model/types";
import { tileName } from "./tileSets";

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = Point & Size;

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
    case "immediately-left-of":
      return { width: 96, height: 72 };
    case "apart":
      // One cell per column standing between the pair.
      return { width: 96 + 14 * (clue.distance - 1), height: 72 };
    case "at-an-end":
      return { width: 62, height: 76 };
    case "next-to-either":
      return { width: 168, height: 56 };
  }
}

const GAP = 12;

/**
 * The order the kinds are grouped in, roughly from the plainest to the most
 * involved. Anything missing from the list is appended rather than dropped: a
 * clue with no position would be rendered in the corner, on top of the others.
 */
const KIND_ORDER: ClueKind[] = (() => {
  const preferred: ClueKind[] = [
    "same-column",
    "different-column",
    "at-an-end",
    "adjacent",
    "immediately-left-of",
    "apart",
    "left-of",
    "between",
    "next-to-either",
  ];
  return [...preferred, ...CLUE_KINDS.filter((kind) => !preferred.includes(kind))];
})();

/**
 * The starting arrangement: cards grouped by kind, each kind on its own row.
 * From there the player drags them wherever they like, which is the point of
 * the canvas, so nothing rearranges them again.
 */
export function layoutCluesByKind(clues: Clue[], width: number): Point[] {
  const positions = new Array<Point>(clues.length);
  const usable = Math.max(width - GAP, 200);
  let y = GAP;

  for (const kind of KIND_ORDER) {
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
    case "immediately-left-of":
      return `${name(clue.left)} is in the column directly left of ${name(clue.right)}`;
    case "apart": {
      const between = clue.distance - 1;
      return `${name(clue.a)} and ${name(clue.b)} have ${between} column${
        between === 1 ? "" : "s"
      } between them, in either order`;
    }
    case "at-an-end":
      return `${name(clue.a)} is in the first or the last column`;
    case "next-to-either":
      return `${name(clue.a)} is next to ${name(clue.b)} or next to ${name(clue.c)}`;
  }
}

/** The rectangle spanned by two corners dragged in any direction. */
export function rectFromCorners(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/**
 * Indices of the clues whose cards overlap `rect`. A band of no width and no
 * height is a click rather than a drag and catches nothing, but one flat in a
 * single direction still sweeps up whatever it crosses.
 */
export function cluesWithin(clues: Clue[], positions: Point[], rect: Rect): number[] {
  if (rect.width === 0 && rect.height === 0) return [];
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  return clues.reduce<number[]>((found, clue, index) => {
    const point = positions[index];
    if (!point) return found;
    const box = cardSize(clue);
    const overlaps =
      point.x < right &&
      point.x + box.width > rect.x &&
      point.y < bottom &&
      point.y + box.height > rect.y;
    return overlaps ? [...found, index] : found;
  }, []);
}

/** The area the cards cover, with room to drop one at the far edge. */
export function contentBounds(clues: Clue[], positions: Point[]): Size {
  let width = 0;
  let height = 0;
  clues.forEach((clue, index) => {
    const point = positions[index] ?? { x: 0, y: 0 };
    const box = cardSize(clue);
    width = Math.max(width, point.x + box.width);
    height = Math.max(height, point.y + box.height);
  });
  return { width: width + GAP * 2, height: height + GAP * 2 };
}

/**
 * The largest zoom that brings all the cards into view. Never above 1: blowing
 * a handful of cards up to fill the space would look absurd.
 */
export function fitZoom(content: Size, viewport: Size, min: number, max: number): number {
  if (content.width <= 0 || content.height <= 0) return 1;
  const fits = Math.min(viewport.width / content.width, viewport.height / content.height, 1);
  return Math.min(max, Math.max(min, fits));
}
