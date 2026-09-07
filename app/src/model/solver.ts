import {
  bitsAbove,
  bitsBelow,
  fullMask,
  highestBit,
  isSingle,
  lowestBit,
  neighbours,
  shiftDown,
  shiftUp,
} from "./bits";
import { tileId, type Clue, type Solution } from "./types";

/**
 * Solver state: `pos[tileId]` is the set of columns still possible for that
 * tile, as a bitmask. This is the transpose of the board the player sees, where
 * a cell holds the set of tiles still possible for one row/column pair.
 */
export type PosMask = Int32Array;

export type SolveResult = {
  /** False if the clues contradict each other. */
  ok: boolean;
  /** True if every tile was narrowed to a single column. */
  solved: boolean;
  /** Propagation passes to reach a fixpoint; a rough difficulty measure. */
  passes: number;
  pos: PosMask;
};

export const openPositions = (size: number): PosMask =>
  new Int32Array(size * size).fill(fullMask(size));

/**
 * Narrows `pos` by repeatedly applying every clue plus the two structural rules
 * of the grid, until nothing changes. Every rule only removes columns that no
 * valid solution could use, so a run that pins all tiles proves the solution is
 * unique — and it does so without ever guessing, which means a player can
 * reproduce the same reasoning.
 */
/** What applying one rule did to the board. */
export type RuleEffect = "unchanged" | "changed" | "contradiction";

/**
 * Applies a single clue to `pos`. Split out from `propagate` so that the hint
 * finder asks the same question the solver does — "what does this one clue
 * settle right now?" — against the same rules.
 */
export function applyClue(pos: PosMask, clue: Clue, size: number): RuleEffect {
  const full = fullMask(size);
  const up2 = (mask: number) => (mask << 2) & full;
  const down2 = (mask: number) => mask >> 2;

  switch (clue.kind) {
    case "same-column": {
      const a = tileId(clue.a, size);
      const b = tileId(clue.b, size);
      const shared = pos[a] & pos[b];
      if (shared === 0) return "contradiction";
      if (pos[a] === shared && pos[b] === shared) return "unchanged";
      pos[a] = shared;
      pos[b] = shared;
      return "changed";
    }
    case "different-column": {
      const a = tileId(clue.a, size);
      const b = tileId(clue.b, size);
      let changed = false;
      // Only informative once one side is pinned to a single column.
      if (isSingle(pos[a]) && pos[b] & pos[a]) {
        pos[b] &= ~pos[a];
        if (pos[b] === 0) return "contradiction";
        changed = true;
      }
      if (isSingle(pos[b]) && pos[a] & pos[b]) {
        pos[a] &= ~pos[b];
        if (pos[a] === 0) return "contradiction";
        changed = true;
      }
      return changed ? "changed" : "unchanged";
    }
    case "adjacent": {
      const a = tileId(clue.a, size);
      const b = tileId(clue.b, size);
      const na = pos[a] & neighbours(pos[b], size);
      const nb = pos[b] & neighbours(pos[a], size);
      if (na === 0 || nb === 0) return "contradiction";
      if (na === pos[a] && nb === pos[b]) return "unchanged";
      pos[a] = na;
      pos[b] = nb;
      return "changed";
    }
    case "left-of": {
      const l = tileId(clue.left, size);
      const r = tileId(clue.right, size);
      const nl = pos[r] === 0 ? 0 : pos[l] & bitsBelow(highestBit(pos[r]));
      const nr = pos[l] === 0 ? 0 : pos[r] & bitsAbove(lowestBit(pos[l]), size);
      if (nl === 0 || nr === 0) return "contradiction";
      if (nl === pos[l] && nr === pos[r]) return "unchanged";
      pos[l] = nl;
      pos[r] = nr;
      return "changed";
    }
    case "between": {
      const m = tileId(clue.middle, size);
      const a = tileId(clue.a, size);
      const b = tileId(clue.b, size);
      const A = pos[a];
      const B = pos[b];
      const M = pos[m];
      // `a` left of `middle` and `b` right of it, or the mirror image.
      const nm = M & ((shiftUp(A, size) & shiftDown(B)) | (shiftUp(B, size) & shiftDown(A)));
      const na = A & ((shiftDown(M) & down2(B)) | (shiftUp(M, size) & up2(B)));
      const nb = B & ((shiftDown(M) & down2(A)) | (shiftUp(M, size) & up2(A)));
      if (nm === 0 || na === 0 || nb === 0) return "contradiction";
      if (nm === M && na === A && nb === B) return "unchanged";
      pos[m] = nm;
      pos[a] = na;
      pos[b] = nb;
      return "changed";
    }
    case "immediately-left-of": {
      const l = tileId(clue.left, size);
      const r = tileId(clue.right, size);
      const nl = pos[l] & shiftDown(pos[r]);
      const nr = pos[r] & shiftUp(pos[l], size);
      if (nl === 0 || nr === 0) return "contradiction";
      if (nl === pos[l] && nr === pos[r]) return "unchanged";
      pos[l] = nl;
      pos[r] = nr;
      return "changed";
    }
    case "apart": {
      const a = tileId(clue.a, size);
      const b = tileId(clue.b, size);
      // Either side of every column the other tile could be in.
      const spread = (mask: number) => (((mask << clue.distance) & full) | (mask >> clue.distance));
      const na = pos[a] & spread(pos[b]);
      const nb = pos[b] & spread(pos[a]);
      if (na === 0 || nb === 0) return "contradiction";
      if (na === pos[a] && nb === pos[b]) return "unchanged";
      pos[a] = na;
      pos[b] = nb;
      return "changed";
    }
    case "at-an-end": {
      const a = tileId(clue.a, size);
      const na = pos[a] & (1 | (1 << (size - 1)));
      if (na === 0) return "contradiction";
      if (na === pos[a]) return "unchanged";
      pos[a] = na;
      return "changed";
    }
    case "next-to-either": {
      const a = tileId(clue.a, size);
      const b = tileId(clue.b, size);
      const c = tileId(clue.c, size);
      const na = pos[a] & (neighbours(pos[b], size) | neighbours(pos[c], size));
      if (na === 0) return "contradiction";

      // Whichever of the pair still could neighbour `a` is not pinned down by
      // this clue. But if one of them cannot, the other one has to, and that
      // narrows it.
      const reach = neighbours(na, size);
      let nb = pos[b];
      let nc = pos[c];
      if ((pos[b] & reach) === 0) nc = pos[c] & reach;
      if ((pos[c] & reach) === 0) nb = pos[b] & reach;
      if (nb === 0 || nc === 0) return "contradiction";
      if (na === pos[a] && nb === pos[b] && nc === pos[c]) return "unchanged";
      pos[a] = na;
      pos[b] = nb;
      pos[c] = nc;
      return "changed";
    }
  }
}

/**
 * The two rules that follow from the shape of the grid rather than from any
 * clue: a tile pinned to a column takes it from its row-mates, and a column
 * left open to only one tile of a row belongs to that tile.
 */
export function applyGridRules(pos: PosMask, size: number): RuleEffect {
  let changed = false;
  for (let row = 0; row < size; row++) {
    const base = row * size;
    for (let t = 0; t < size; t++) {
      const mask = pos[base + t];
      if (mask === 0) return "contradiction";
      if (!isSingle(mask)) continue;
      for (let u = 0; u < size; u++) {
        if (u === t || !(pos[base + u] & mask)) continue;
        pos[base + u] &= ~mask;
        if (pos[base + u] === 0) return "contradiction";
        changed = true;
      }
    }
    for (let col = 0; col < size; col++) {
      const colBit = 1 << col;
      let count = 0;
      let last = -1;
      for (let t = 0; t < size; t++) {
        if (pos[base + t] & colBit) {
          count++;
          last = base + t;
        }
      }
      if (count === 0) return "contradiction";
      if (count === 1 && pos[last] !== colBit) {
        pos[last] = colBit;
        changed = true;
      }
    }
  }
  return changed ? "changed" : "unchanged";
}

/**
 * Narrows `pos` by repeatedly applying every clue plus the two structural rules
 * of the grid, until nothing changes. Every rule only removes columns that no
 * valid solution could use, so a run that pins all tiles proves the solution is
 * unique — and it does so without ever guessing, which means a player can
 * reproduce the same reasoning.
 */
export function propagate(
  pos: PosMask,
  clues: Clue[],
  size: number,
): { ok: boolean; passes: number } {
  let changed = true;
  let passes = 0;

  while (changed) {
    changed = false;
    passes++;

    for (const clue of clues) {
      const effect = applyClue(pos, clue, size);
      if (effect === "contradiction") return { ok: false, passes };
      if (effect === "changed") changed = true;
    }

    const grid = applyGridRules(pos, size);
    if (grid === "contradiction") return { ok: false, passes };
    if (grid === "changed") changed = true;
  }

  return { ok: true, passes };
}

/** Solves using propagation alone — no guessing, the way a player would. */
export function solveByDeduction(clues: Clue[], size: number): SolveResult {
  const pos = openPositions(size);
  const { ok, passes } = propagate(pos, clues, size);
  let solved = ok;
  if (ok) {
    for (let i = 0; i < pos.length; i++) {
      if (!isSingle(pos[i])) {
        solved = false;
        break;
      }
    }
  }
  return { ok, solved, passes, pos };
}

/** True if the clues pin down the whole grid by deduction alone. */
export const isDeducible = (clues: Clue[], size: number): boolean =>
  solveByDeduction(clues, size).solved;

/**
 * Counts solutions with propagation plus backtracking, stopping at `limit`.
 * Not used during generation — it is the independent check that the deduction
 * solver's answer really is the only one.
 */
export function countSolutions(clues: Clue[], size: number, limit = 2): number {
  let found = 0;

  const search = (pos: PosMask): void => {
    if (found >= limit) return;
    const { ok } = propagate(pos, clues, size);
    if (!ok) return;

    let branch = -1;
    let branchCount = Infinity;
    for (let i = 0; i < pos.length; i++) {
      const n = popCountFast(pos[i]);
      if (n > 1 && n < branchCount) {
        branchCount = n;
        branch = i;
      }
    }
    if (branch === -1) {
      found++;
      return;
    }
    for (let col = 0; col < size; col++) {
      if (!(pos[branch] & (1 << col))) continue;
      const next = Int32Array.from(pos);
      next[branch] = 1 << col;
      search(next);
      if (found >= limit) return;
    }
  };

  search(openPositions(size));
  return found;
}

function popCountFast(mask: number): number {
  let n = 0;
  while (mask) {
    mask &= mask - 1;
    n++;
  }
  return n;
}

/** Reads a fully solved `PosMask` back as `solution[row][col]`. */
export function positionsToSolution(pos: PosMask, size: number): Solution {
  const solution: Solution = Array.from({ length: size }, () => new Array<number>(size).fill(-1));
  for (let row = 0; row < size; row++) {
    for (let t = 0; t < size; t++) {
      const mask = pos[row * size + t];
      if (!isSingle(mask)) throw new Error(`tile ${row}/${t} is not pinned to one column`);
      solution[row][lowestBit(mask)] = t;
    }
  }
  return solution;
}

/** True if every clue holds for `solution`. */
export function clueHolds(clue: Clue, solution: Solution): boolean {
  const col = (ref: { row: number; tile: number }) => solution[ref.row].indexOf(ref.tile);
  switch (clue.kind) {
    case "same-column":
      return col(clue.a) === col(clue.b);
    case "different-column":
      return col(clue.a) !== col(clue.b);
    case "adjacent":
      return Math.abs(col(clue.a) - col(clue.b)) === 1;
    case "left-of":
      return col(clue.left) < col(clue.right);
    case "between": {
      const m = col(clue.middle);
      const a = col(clue.a);
      const b = col(clue.b);
      return (a === m - 1 && b === m + 1) || (b === m - 1 && a === m + 1);
    }
    case "immediately-left-of":
      return col(clue.left) + 1 === col(clue.right);
    case "apart":
      return Math.abs(col(clue.a) - col(clue.b)) === clue.distance;
    case "at-an-end": {
      const at = col(clue.a);
      return at === 0 || at === solution[clue.a.row].length - 1;
    }
    case "next-to-either": {
      const at = col(clue.a);
      return Math.abs(at - col(clue.b)) === 1 || Math.abs(at - col(clue.c)) === 1;
    }
  }
}
