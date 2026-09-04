import { makeRng, shuffle, type Rng } from "./rng";
import { isDeducible, solveByDeduction } from "./solver";
import {
  CLUE_KINDS,
  DEFAULT_SIZE,
  type Clue,
  type ClueKind,
  type Puzzle,
  type Solution,
} from "./types";

/**
 * How many clues of each kind are offered to the minimiser. Every true clue of
 * a kind is a candidate, but a `between` clue constrains far more than a
 * `different-column` one, so offering all of them would produce puzzles made
 * almost entirely of `between`. Capping the pool per kind sets the mix of the
 * finished puzzle; scaled by size, since the pool grows with the grid.
 */
export type CluePoolCaps = Record<ClueKind, number>;

export type Difficulty = "easy" | "medium" | "hard";

/**
 * Minimisation lands on 20-25 clues whatever the caps, so difficulty is set by
 * which kinds those clues are. `same-column` clues are the easiest to act on;
 * `between` clues force the longest chains of reasoning, so a hard puzzle
 * offers few of the former and leans on the latter.
 */
export const DIFFICULTY_PRESETS: Record<
  Difficulty,
  { poolCaps: CluePoolCaps; clueRange: [number, number] }
> = {
  easy: {
    poolCaps: { "same-column": 90, adjacent: 70, "left-of": 60, between: 20, "different-column": 60 },
    clueRange: [23, 28],
  },
  medium: {
    poolCaps: { "same-column": 90, adjacent: 55, "left-of": 55, between: 35, "different-column": 60 },
    clueRange: [20, 25],
  },
  hard: {
    poolCaps: { "same-column": 8, adjacent: 8, "left-of": 10, between: 14, "different-column": 4 },
    clueRange: [17, 22],
  },
};

export const DEFAULT_POOL_CAPS: CluePoolCaps = DIFFICULTY_PRESETS.medium.poolCaps;

export type GenerateOptions = {
  size?: number;
  seed?: number;
  difficulty?: Difficulty;
  /** Per-kind limits on the clues offered to the minimiser. Overrides the difficulty preset. */
  poolCaps?: Partial<CluePoolCaps>;
  /**
   * Retry with successive seeds until the clue count falls in this range.
   * Defaults to the difficulty preset's range; pass `null` to accept the first result.
   */
  clueRange?: [number, number] | null;
  /** Allow clues that relate two tiles from the same row. */
  allowSameRowClues?: boolean;
};

/** A random solution: each row is an independent permutation of its tiles. */
export function randomSolution(size: number, rng: Rng): Solution {
  return Array.from({ length: size }, () =>
    shuffle(
      Array.from({ length: size }, (_, i) => i),
      rng,
    ),
  );
}

/**
 * Every clue of every kind that is true for `solution`. This pool always
 * determines the solution, so minimisation only ever has to shrink it.
 */
export function allTrueClues(solution: Solution, allowSameRow = true): Clue[] {
  const size = solution.length;
  const clues: Clue[] = [];
  const refs = solution.flatMap((_, row) =>
    Array.from({ length: size }, (_, tile) => ({ row, tile })),
  );
  const colOf = new Map(refs.map((r) => [`${r.row}:${r.tile}`, solution[r.row].indexOf(r.tile)]));
  const col = (r: { row: number; tile: number }) => colOf.get(`${r.row}:${r.tile}`)!;

  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      const a = refs[i];
      const b = refs[j];
      const sameRow = a.row === b.row;
      const ca = col(a);
      const cb = col(b);

      // Two tiles of one row can never share a column, so neither column clue
      // says anything about them.
      if (!sameRow) clues.push({ kind: ca === cb ? "same-column" : "different-column", a, b });
      if (sameRow && !allowSameRow) continue;
      if (Math.abs(ca - cb) === 1) clues.push({ kind: "adjacent", a, b });
      if (ca < cb) clues.push({ kind: "left-of", left: a, right: b });
      else if (cb < ca) clues.push({ kind: "left-of", left: b, right: a });
    }
  }

  for (const middle of refs) {
    const cm = col(middle);
    if (cm === 0 || cm === size - 1) continue;
    for (const a of refs) {
      if (col(a) !== cm - 1) continue;
      for (const b of refs) {
        if (col(b) !== cm + 1) continue;
        if (!allowSameRow && (a.row === middle.row || b.row === middle.row || a.row === b.row))
          continue;
        clues.push({ kind: "between", middle, a, b });
      }
    }
  }

  return clues;
}

/**
 * Drops clues one at a time, keeping a removal whenever the puzzle still solves
 * by deduction. The result is irreducible: every remaining clue is needed.
 */
export function minimise(pool: Clue[], size: number, rng: Rng): Clue[] {
  const order = shuffle(
    pool.map((_, index) => index),
    rng,
  );

  const kept = new Uint8Array(pool.length).fill(1);
  const live = () => pool.filter((_, i) => kept[i] === 1);

  // The pool is highly redundant, so start by dropping clues in blocks. This
  // only decides which clues reach the final pass; it cannot leave a removable
  // clue behind, because the pass below still tries every survivor on its own.
  for (const blockSize of [64, 8]) {
    const pending = order.filter((index) => kept[index] === 1);
    for (let start = 0; start < pending.length; start += blockSize) {
      const block = pending.slice(start, start + blockSize);
      for (const index of block) kept[index] = 0;
      if (!isDeducible(live(), size)) for (const index of block) kept[index] = 1;
    }
  }

  for (const index of order) {
    if (kept[index] === 0) continue;
    kept[index] = 0;
    if (!isDeducible(live(), size)) kept[index] = 1;
  }
  return live();
}

/** Hides which side of `middle` each outer tile is on. */
const maskBetweenOrder = (clue: Clue, rng: Rng): Clue =>
  clue.kind === "between" && rng() < 0.5
    ? { kind: "between", middle: clue.middle, a: clue.b, b: clue.a }
    : clue;

/**
 * Draws up to `caps[kind]` clues of each kind at random. Same-column clues
 * alone fix which tiles share a column but never which column that is, so the
 * draw is repeated with wider caps until the pool determines the solution.
 */
export function samplePool(pool: Clue[], caps: CluePoolCaps, size: number, rng: Rng): Clue[] {
  const byKind = new Map<ClueKind, Clue[]>(CLUE_KINDS.map((kind) => [kind, []]));
  for (const clue of pool) byKind.get(clue.kind)!.push(clue);

  for (let scale = 1; scale <= 16; scale *= 2) {
    const sampled = CLUE_KINDS.flatMap((kind) =>
      shuffle(byKind.get(kind)!, rng).slice(0, Math.ceil(caps[kind] * scale)),
    );
    if (isDeducible(sampled, size)) return sampled;
  }
  return pool;
}

/** Builds exactly one puzzle from `seed`, with no retries. */
function buildPuzzle(seed: number, size: number, caps: CluePoolCaps, allowSameRow: boolean): Puzzle {
  const rng = makeRng(seed);
  const solution = randomSolution(size, rng);
  const pool = samplePool(allTrueClues(solution, allowSameRow), caps, size, rng);
  const clues = minimise(pool, size, rng).map((clue) => maskBetweenOrder(clue, rng));
  return { size, solution, clues: shuffle(clues, rng), seed };
}

const MAX_ATTEMPTS = 20;

/**
 * The returned puzzle's `seed` is the one that produced it, so passing it back
 * reproduces the same puzzle exactly, retries included.
 */
export function generatePuzzle(options: GenerateOptions = {}): Puzzle {
  const size = options.size ?? DEFAULT_SIZE;
  const difficulty = options.difficulty ?? "medium";
  const preset = DIFFICULTY_PRESETS[difficulty];
  const caps = { ...preset.poolCaps, ...options.poolCaps };
  const allowSameRow = options.allowSameRowClues ?? true;
  const range = options.clueRange === undefined ? preset.clueRange : options.clueRange;
  const firstSeed = options.seed ?? Math.floor(Math.random() * 0x7fffffff);

  let closest: Puzzle | null = null;
  let closestMiss = Infinity;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const puzzle = buildPuzzle((firstSeed + attempt) >>> 0, size, caps, allowSameRow);
    if (!range) return puzzle;
    const [min, max] = range;
    const count = puzzle.clues.length;
    if (count >= min && count <= max) return puzzle;
    const miss = count < min ? min - count : count - max;
    if (miss < closestMiss) {
      closestMiss = miss;
      closest = puzzle;
    }
  }
  return closest!;
}

export type PuzzleStats = {
  clueCount: number;
  byKind: Record<ClueKind, number>;
  /** Propagation passes needed to solve; higher means longer chains of reasoning. */
  passes: number;
};

export function puzzleStats(puzzle: Puzzle): PuzzleStats {
  const byKind = Object.fromEntries(CLUE_KINDS.map((k) => [k, 0])) as Record<ClueKind, number>;
  for (const clue of puzzle.clues) byKind[clue.kind]++;
  return {
    clueCount: puzzle.clues.length,
    byKind,
    passes: solveByDeduction(puzzle.clues, puzzle.size).passes,
  };
}
