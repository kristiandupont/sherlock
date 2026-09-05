import type { Solution } from "../model/types";
import { hasMistake, type BoardState } from "./board";

/**
 * The player's moves only ever remove candidates, so once a board has ruled out
 * a symbol that belongs somewhere, every later board in the history has too.
 * That makes the history a run of correct boards followed by a run of broken
 * ones, and the boundary is the point worth going back to.
 */
export function firstBrokenIndex(history: BoardState[], solution: Solution): number {
  for (let index = 0; index < history.length; index++)
    if (hasMistake(history[index], solution)) return index;
  return -1;
}

/** Index of the last board that was still correct; the current one if nothing is wrong. */
export function lastGoodIndex(history: BoardState[], solution: Solution): number {
  const broken = firstBrokenIndex(history, solution);
  return broken < 0 ? history.length - 1 : broken - 1;
}

/**
 * The history truncated to the last correct board, discarding everything built
 * on top of the wrong move. Returns the array unchanged when nothing is wrong.
 */
export function rewindToLastGood(history: BoardState[], solution: Solution): BoardState[] {
  const broken = firstBrokenIndex(history, solution);
  // The starting board can never be wrong, so at least one board always remains.
  return broken < 0 ? history : history.slice(0, Math.max(broken, 1));
}
