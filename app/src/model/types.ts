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
  | { kind: "between"; middle: TileRef; a: TileRef; b: TileRef };

export type ClueKind = Clue["kind"];

export const CLUE_KINDS: ClueKind[] = [
  "same-column",
  "different-column",
  "adjacent",
  "left-of",
  "between",
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

/** Every tile a clue mentions, in display order. */
export function clueTiles(clue: Clue): TileRef[] {
  switch (clue.kind) {
    case "left-of":
      return [clue.left, clue.right];
    case "between":
      return [clue.a, clue.middle, clue.b];
    default:
      return [clue.a, clue.b];
  }
}

export const sameTile = (a: TileRef, b: TileRef): boolean =>
  a.row === b.row && a.tile === b.tile;

/** The column `ref` occupies in `solution`, or -1 if the reference is out of range. */
export function columnOf(solution: Solution, ref: TileRef): number {
  return solution[ref.row]?.indexOf(ref.tile) ?? -1;
}
