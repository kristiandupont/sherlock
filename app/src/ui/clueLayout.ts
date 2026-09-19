import { makeRng, type Rng } from "../model/rng";
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
      // Tall enough for the arrow under the row, like the other pair cards.
      return { width: 168, height: 72 };
  }
}

/**
 * The axis a card can be mirrored along without changing what it says, or
 * `null` for a card that cannot be mirrored at all. A clue whose whole content
 * is a direction — `left-of`, `immediately-left-of` — would say something else
 * reversed, and a one-tile card has nothing to reverse.
 *
 * Mirroring is for the player's benefit only: it lets them put the shared
 * symbol of two clues next to each other so the eye can follow a chain of them
 * across the canvas. The clue itself is untouched, so the solver and the hints
 * never see the difference.
 */
export function flipAxis(clue: Clue): "horizontal" | "vertical" | null {
  switch (clue.kind) {
    // Drawn as a vertical stack of two tiles, either way up.
    case "same-column":
    case "different-column":
      return "vertical";
    // Drawn as a row whose order the clue does not fix.
    case "adjacent":
    case "apart":
    case "between":
    case "next-to-either":
      return "horizontal";
    case "left-of":
    case "immediately-left-of":
    case "at-an-end":
      return null;
  }
}

export const canFlip = (clue: Clue): boolean => flipAxis(clue) !== null;

/**
 * A starting orientation for each card, mirrored or not at random, so that a
 * kind of card does not always look the same.
 *
 * Two regularities to break. A `next-to-either` card always draws its single
 * tile on the left and the pair it might neighbour on the right, so a row of
 * them reads as one shape. And `allTrueClues` builds every pair clue from two
 * tiles in row order, which puts the earlier row on the left of every
 * `adjacent` and `apart` card and on top of every `same-column` one.
 *
 * Neither says anything about the solution — `maskBetweenOrder` in the
 * generator is what keeps the one clue whose build order would have given the
 * answer away from doing so — but both make the canvas harder to read.
 *
 * Seeded from the puzzle's own seed, so a puzzle looks the same each time it is
 * opened.
 */
export function randomFlips(clues: Clue[], rng: Rng): boolean[] {
  return clues.map((clue) => canFlip(clue) && rng() < 0.5);
}

export const flipsForPuzzle = (clues: Clue[], seed: number): boolean[] =>
  randomFlips(clues, makeRng(seed));

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

/**
 * The card in words, for the tooltip and the accessible name. `flipped` names
 * the pair in the order the card draws them, so the text and the picture agree
 * about which tile is which when a player reads both.
 */
export function describeClue(clue: Clue, flipped = false): string {
  const name = (ref: { row: number; tile: number }) => tileName(ref.row, ref.tile);
  /** The two tiles of a symmetric pair, in the order the card draws them. */
  const pair = (a: { row: number; tile: number }, b: { row: number; tile: number }) =>
    flipped ? ([name(b), name(a)] as const) : ([name(a), name(b)] as const);
  switch (clue.kind) {
    case "same-column": {
      const [first, second] = pair(clue.a, clue.b);
      return `${first} and ${second} are in the same column`;
    }
    case "different-column": {
      const [first, second] = pair(clue.a, clue.b);
      return `${first} and ${second} are not in the same column`;
    }
    case "adjacent": {
      const [first, second] = pair(clue.a, clue.b);
      return `${first} and ${second} are in neighbouring columns`;
    }
    case "left-of":
      return `${name(clue.left)} is somewhere left of ${name(clue.right)}`;
    case "between": {
      const [first, second] = pair(clue.a, clue.b);
      return `${name(clue.middle)} is directly between ${first} and ${second}, in either order`;
    }
    case "immediately-left-of":
      return `${name(clue.left)} is in the column directly left of ${name(clue.right)}`;
    case "apart": {
      const between = clue.distance - 1;
      const [first, second] = pair(clue.a, clue.b);
      return `${first} and ${second} have ${between} column${
        between === 1 ? "" : "s"
      } between them, in either order`;
    }
    case "at-an-end":
      return `${name(clue.a)} is in the first or the last column`;
    // Mirroring this card moves the lone tile to the other side of the pair
    // rather than reordering two tiles, and which side it sits on says nothing,
    // so the sentence reads the same either way.
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
