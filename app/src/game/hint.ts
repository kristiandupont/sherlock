import { isSingle, popCount } from "../model/bits";
import { propagate, type PosMask } from "../model/solver";
import type { Clue } from "../model/types";
import { boardToPositions, type BoardState } from "./board";

export type Hint = {
  clueIndex: number;
  /** Cells this clue settles outright, once the usual bookkeeping follows. */
  placements: number;
  /** Candidates it rules out in total. */
  eliminations: number;
};

export type HintOutcome =
  /** At least one clue still narrows the grid. */
  | { kind: "clue"; hints: Hint[] }
  /** No clue is needed: what is left follows from the symbols already placed. */
  | { kind: "bookkeeping" }
  /** Nothing follows at all, so something has been ruled out wrongly. */
  | { kind: "stuck" };

/**
 * The grid with every mechanical consequence worked through, but no clue
 * applied. Hints are measured against this rather than against the raw grid:
 * the board deliberately leaves placements for the player to make, so a clue
 * must not be credited with bookkeeping they simply have not done yet.
 */
function settled(board: BoardState): PosMask | null {
  const pos = boardToPositions(board);
  return propagate(pos, [], board.size).ok ? pos : null;
}

/**
 * Every clue that still says something about the grid as it stands, best first.
 * A clue qualifies when applying it removes at least one candidate that the
 * grid's own bookkeeping would not have removed anyway.
 */
export function findHints(board: BoardState, clues: Clue[], used: boolean[] = []): Hint[] {
  const baseline = settled(board);
  if (!baseline) return [];
  return rank(baseline, board.size, clues, used);
}

function rank(baseline: PosMask, size: number, clues: Clue[], used: boolean[]): Hint[] {
  const hints: Hint[] = [];

  clues.forEach((clue, clueIndex) => {
    const after = Int32Array.from(baseline);
    if (!propagate(after, [clue], size).ok) return;

    let eliminations = 0;
    let placements = 0;
    for (let i = 0; i < baseline.length; i++) {
      eliminations += popCount(baseline[i]) - popCount(after[i]);
      if (!isSingle(baseline[i]) && isSingle(after[i])) placements++;
    }
    if (eliminations > 0) hints.push({ clueIndex, placements, eliminations });
  });

  // A clue the player has set aside is offered only when nothing else is left.
  return hints.sort((a, b) => {
    const setAside = Number(used[a.clueIndex] ?? false) - Number(used[b.clueIndex] ?? false);
    if (setAside !== 0) return setAside;
    if (b.placements !== a.placements) return b.placements - a.placements;
    return b.eliminations - a.eliminations;
  });
}

/** The best clue to look at next, or null when no single clue moves the grid on. */
export function findHint(board: BoardState, clues: Clue[], used: boolean[] = []): Hint | null {
  return findHints(board, clues, used)[0] ?? null;
}

/** What to tell the player when they ask for a hint. */
export function hintOutcome(
  board: BoardState,
  clues: Clue[],
  used: boolean[] = [],
): HintOutcome {
  const baseline = settled(board);
  if (!baseline) return { kind: "stuck" };

  const hints = rank(baseline, board.size, clues, used);
  if (hints.length > 0) return { kind: "clue", hints };
  // Nothing left for a clue to do. Either the grid is already determined and
  // only needs filling in, or the player has ruled something out wrongly.
  return baseline.every((mask) => isSingle(mask)) ? { kind: "bookkeeping" } : { kind: "stuck" };
}
