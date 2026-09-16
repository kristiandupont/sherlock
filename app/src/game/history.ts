import type { Solution } from "../model/types";
import { hasMistake, type BoardState } from "./board";

/**
 * One step of the game. Crossing a clue off is a move like any other, so it
 * belongs in the history beside the board: undo and rewind then put the clue
 * cards back the way they were at that point as well as the grid.
 */
export type Snapshot = {
  board: BoardState;
  /** One flag per clue, true once the player has greyed that clue out. */
  used: boolean[];
};

/**
 * The player's moves only ever remove candidates, so once a board has ruled out
 * a symbol that belongs somewhere, every later board in the history has too.
 * That makes the history a run of correct boards followed by a run of broken
 * ones, and the boundary is the point worth going back to.
 *
 * Only the board can be wrong: greying out a clue the player still needs costs
 * them nothing that the grid records.
 */
export function firstBrokenIndex(history: Snapshot[], solution: Solution): number {
  for (let index = 0; index < history.length; index++)
    if (hasMistake(history[index].board, solution)) return index;
  return -1;
}

/** Index of the last snapshot that was still correct; the current one if nothing is wrong. */
export function lastGoodIndex(history: Snapshot[], solution: Solution): number {
  const broken = firstBrokenIndex(history, solution);
  return broken < 0 ? history.length - 1 : broken - 1;
}

/**
 * The history truncated to the last correct snapshot, discarding everything
 * built on top of the wrong move. Returns the array unchanged when nothing is
 * wrong.
 */
export function rewindToLastGood(history: Snapshot[], solution: Solution): Snapshot[] {
  const broken = firstBrokenIndex(history, solution);
  // The starting board can never be wrong, so at least one snapshot always remains.
  return broken < 0 ? history : history.slice(0, Math.max(broken, 1));
}
