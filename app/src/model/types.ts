/** Board size: the puzzle has `size` rows, `size` tiles per row, and `size` columns. */
export const DEFAULT_SIZE = 6;

/**
 * Identifies one tile by the row (category) it belongs to and its index within
 * that row. A clue never refers to a column — which column a tile occupies is
 * exactly what the player has to work out.
 */
export type TileRef = { row: number; tile: number };

export type Clue =
  /** `a` and `b` occupy the same column. */
  | { kind: "same-column"; a: TileRef; b: TileRef }
  /** `a` and `b` never occupy the same column. */
  | { kind: "different-column"; a: TileRef; b: TileRef }
  /** `a` and `b` occupy neighbouring columns, in either order. */
  | { kind: "adjacent"; a: TileRef; b: TileRef }
  /** `left` occupies a column somewhere left of `right`, not necessarily next to it. */
  | { kind: "left-of"; left: TileRef; right: TileRef }
  /** `middle` sits in the column directly between `a` and `b`, which may be either way round. */
  | { kind: "between"; middle: TileRef; a: TileRef; b: TileRef }
  /** `left` occupies the column immediately before `right`. */
  | { kind: "immediately-left-of"; left: TileRef; right: TileRef }
  /**
   * `a` and `b` are exactly `distance` columns apart, in either order — that is
   * `distance - 1` columns stand between them, which is what the card draws.
   * Always 2 or more, since a distance of 1 is `adjacent`.
   */
  | { kind: "apart"; a: TileRef; b: TileRef; distance: number }
  /** `a` occupies either the first or the last column. */
  | { kind: "at-an-end"; a: TileRef }
  /** `a` neighbours `b`, or `c`, or both. Which one is not said. */
  | { kind: "next-to-either"; a: TileRef; b: TileRef; c: TileRef };

export type ClueKind = Clue["kind"];

export const CLUE_KINDS: ClueKind[] = [
  "same-column",
  "different-column",
  "adjacent",
  "left-of",
  "between",
  "immediately-left-of",
  "apart",
  "at-an-end",
  "next-to-either",
];

/** `solution[row][col]` is the index of the tile from `row` placed in `col`. */
export type Solution = number[][];

export type Puzzle = {
  size: number;
  solution: Solution;
  clues: Clue[];
  seed: number;
};

/** Index used by the solver: rows laid end to end, `size` tiles each. */
export const tileId = (ref: TileRef, size: number): number => ref.row * size + ref.tile;

export const tileRef = (id: number, size: number): TileRef => ({
  row: Math.floor(id / size),
  tile: id % size,
});

/**
 * Every tile a clue mentions, in display order. Deliberately without a
 * `default` case: clue kinds do not share a shape, so a new one must be
 * answered for here rather than falling through to a guess.
 */
export function clueTiles(clue: Clue): TileRef[] {
  switch (clue.kind) {
    case "same-column":
    case "different-column":
    case "adjacent":
      return [clue.a, clue.b];
    case "left-of":
    case "immediately-left-of":
      return [clue.left, clue.right];
    case "between":
      return [clue.a, clue.middle, clue.b];
    case "apart":
      return [clue.a, clue.b];
    case "at-an-end":
      return [clue.a];
    case "next-to-either":
      return [clue.a, clue.b, clue.c];
  }
}

export const sameTile = (a: TileRef, b: TileRef): boolean =>
  a.row === b.row && a.tile === b.tile;

/** The column `ref` occupies in `solution`, or -1 if the reference is out of range. */
export function columnOf(solution: Solution, ref: TileRef): number {
  return solution[ref.row]?.indexOf(ref.tile) ?? -1;
}
