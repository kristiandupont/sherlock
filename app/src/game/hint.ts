import { popCount } from "../model/bits";
import { isSingle } from "../model/bits";
import { propagate } from "../model/solver";
import type { Clue } from "../model/types";
import { boardToPositions, type BoardState } from "./board";

export type Hint = {
  clueIndex: number;
  /** Cells this clue settles outright, once the usual bookkeeping follows. */
  placements: number;
  /** Candidates it rules out in total. */
  eliminations: number;
};

/**
 * Every clue that still says something about the grid as it stands, best first.
 * A clue qualifies when applying it removes at least one candidate the player
 * has not removed already — which is what "this clue reveals a move" means.
 * The hint names the clue and nothing else: what it reveals is left to the
 * player to work out.
 */
export function findHints(board: BoardState, clues: Clue[], used: boolean[] = []): Hint[] {
  const before = boardToPositions(board);
  const hints: Hint[] = [];

  clues.forEach((clue, clueIndex) => {
    const after = Int32Array.from(before);
    // One clue at a time, but with the grid's own rules following it, since the
    // board applies those automatically as soon as the player acts.
    if (!propagate(after, [clue], board.size).ok) return;

    let eliminations = 0;
    let placements = 0;
    for (let i = 0; i < before.length; i++) {
      eliminations += popCount(before[i]) - popCount(after[i]);
      if (!isSingle(before[i]) && isSingle(after[i])) placements++;
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

/**
 * The best clue to look at next, or null when no single clue moves the grid on
 * — which on an unfinished board means the player has ruled something out
 * wrongly.
 */
export function findHint(board: BoardState, clues: Clue[], used: boolean[] = []): Hint | null {
  return findHints(board, clues, used)[0] ?? null;
}
