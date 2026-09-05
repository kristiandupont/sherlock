import { bit, isSingle, lowestBit, popCount } from "../model/bits";
import { propagate, type PosMask } from "../model/solver";
import type { Clue } from "../model/types";
import { boardToPositions, type BoardState } from "./board";

/** A cell the player can settle now, without consulting any clue. */
export type CellHint = {
  kind: "cell";
  row: number;
  col: number;
  tile: number;
  /**
   * `only-candidate`: every other symbol has been ruled out of this cell.
   * `only-place`: this is the last cell in the row where that symbol can go.
   */
  reason: "only-candidate" | "only-place";
};

export type ClueHint = {
  kind: "clue";
  clueIndex: number;
  /** Cells the clue settles outright, once the usual bookkeeping follows. */
  placements: number;
  /** Candidates it rules out in total. */
  eliminations: number;
};

export type Hint = CellHint | ClueHint;

/**
 * Cells that can be settled from the grid alone, most obvious first: a cell
 * with one symbol left in it, then a cell holding the last home of a symbol.
 * Neither needs a clue, which is why they come before every clue hint.
 */
export function findCellHints(board: BoardState): CellHint[] {
  const { size } = board;
  const onlyCandidate: CellHint[] = [];
  const onlyPlace: CellHint[] = [];
  const seen = new Set<string>();

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board.placed[row][col] || !isSingle(board.cells[row][col])) continue;
      onlyCandidate.push({
        kind: "cell",
        row,
        col,
        tile: lowestBit(board.cells[row][col]),
        reason: "only-candidate",
      });
      seen.add(`${row}:${col}`);
    }

    for (let tile = 0; tile < size; tile++) {
      const tileBit = bit(tile);
      let count = 0;
      let last = -1;
      for (let col = 0; col < size; col++) {
        if (board.cells[row][col] & tileBit) {
          count++;
          last = col;
        }
      }
      if (count !== 1 || board.placed[row][last] || seen.has(`${row}:${last}`)) continue;
      onlyPlace.push({ kind: "cell", row, col: last, tile, reason: "only-place" });
      seen.add(`${row}:${last}`);
    }
  }

  return [...onlyCandidate, ...onlyPlace];
}

/**
 * The grid with every mechanical consequence worked through, but no clue
 * applied. Clue hints are measured against this rather than against the raw
 * grid: the board deliberately leaves placements for the player to make, so a
 * clue must not be credited with bookkeeping they simply have not done yet.
 */
function settled(board: BoardState): PosMask | null {
  const pos = boardToPositions(board);
  return propagate(pos, [], board.size).ok ? pos : null;
}

/**
 * Every clue that still says something about the grid, best first. A clue
 * qualifies when applying it removes at least one candidate that the grid's own
 * bookkeeping would not have removed anyway.
 */
export function findClueHints(
  board: BoardState,
  clues: Clue[],
  used: boolean[] = [],
): ClueHint[] {
  const baseline = settled(board);
  if (!baseline) return [];

  const hints: ClueHint[] = [];
  clues.forEach((clue, clueIndex) => {
    const after = Int32Array.from(baseline);
    if (!propagate(after, [clue], board.size).ok) return;

    let eliminations = 0;
    let placements = 0;
    for (let i = 0; i < baseline.length; i++) {
      eliminations += popCount(baseline[i]) - popCount(after[i]);
      if (!isSingle(baseline[i]) && isSingle(after[i])) placements++;
    }
    if (eliminations > 0) hints.push({ kind: "clue", clueIndex, placements, eliminations });
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
 * Everything worth pointing at, in the order a player would find it: cells that
 * need no clue at all, then the clues that still narrow the grid. Empty means
 * either the grid is finished or something has been ruled out wrongly.
 */
export function findHints(board: BoardState, clues: Clue[], used: boolean[] = []): Hint[] {
  return [...findCellHints(board), ...findClueHints(board, clues, used)];
}

export function findHint(board: BoardState, clues: Clue[], used: boolean[] = []): Hint | null {
  return findHints(board, clues, used)[0] ?? null;
}
