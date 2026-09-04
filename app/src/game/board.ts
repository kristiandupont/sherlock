import { bit, bitList, fullMask, isSingle, lowestBit, popCount } from "../model/bits";
import type { Solution } from "../model/types";

/**
 * What the player sees: `cells[row][col]` is the set of tiles still possible in
 * that cell, as a bitmask. This is the transpose of the solver's PosMask.
 */
export type BoardState = {
  size: number;
  cells: number[][];
};

export const emptyBoard = (size: number): BoardState => ({
  size,
  cells: Array.from({ length: size }, () => new Array<number>(size).fill(fullMask(size))),
});

const cloneCells = (board: BoardState): number[][] => board.cells.map((row) => row.slice());

/**
 * Bookkeeping that follows from the shape of the grid alone: a tile placed in a
 * column cannot appear elsewhere in its row, and a tile with only one column
 * left belongs there. This is not deduction from clues — that stays the
 * player's job.
 */
function settle(size: number, cells: number[][]): number[][] {
  let changed = true;
  while (changed) {
    changed = false;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const mask = cells[row][col];
        if (!isSingle(mask)) continue;
        for (let other = 0; other < size; other++) {
          if (other === col || !(cells[row][other] & mask)) continue;
          cells[row][other] &= ~mask;
          changed = true;
        }
      }
      for (let tile = 0; tile < size; tile++) {
        const tileBit = bit(tile);
        let count = 0;
        let last = -1;
        for (let col = 0; col < size; col++) {
          if (cells[row][col] & tileBit) {
            count++;
            last = col;
          }
        }
        if (count === 1 && cells[row][last] !== tileBit) {
          cells[row][last] = tileBit;
          changed = true;
        }
      }
    }
  }
  return cells;
}

/** Places `tile` in this cell, discarding the cell's other candidates. */
export function placeTile(board: BoardState, row: number, col: number, tile: number): BoardState {
  const cells = cloneCells(board);
  cells[row][col] = bit(tile);
  return { size: board.size, cells: settle(board.size, cells) };
}

/**
 * Rules out `tile` here. Removing a cell's last candidate would leave the board
 * with no reading at all, so that is refused and the board comes back unchanged.
 */
export function removeCandidate(
  board: BoardState,
  row: number,
  col: number,
  tile: number,
): BoardState {
  const mask = board.cells[row][col];
  if (!(mask & bit(tile)) || isSingle(mask)) return board;
  const cells = cloneCells(board);
  cells[row][col] = mask & ~bit(tile);
  return { size: board.size, cells: settle(board.size, cells) };
}

export const candidatesAt = (board: BoardState, row: number, col: number): number[] =>
  bitList(board.cells[row][col]);

export const candidateCount = (board: BoardState, row: number, col: number): number =>
  popCount(board.cells[row][col]);

/** The tile placed in this cell, or -1 while more than one remains possible. */
export const placedTile = (board: BoardState, row: number, col: number): number =>
  isSingle(board.cells[row][col]) ? lowestBit(board.cells[row][col]) : -1;

export const isComplete = (board: BoardState): boolean =>
  board.cells.every((row) => row.every(isSingle));

/** Cells where the player has ruled out the tile that actually belongs there. */
export function mistakes(board: BoardState, solution: Solution): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let row = 0; row < board.size; row++)
    for (let col = 0; col < board.size; col++)
      if (!(board.cells[row][col] & bit(solution[row][col]))) out.push([row, col]);
  return out;
}

export const isSolved = (board: BoardState, solution: Solution): boolean =>
  isComplete(board) && mistakes(board, solution).length === 0;

export function boardFromSolution(solution: Solution): BoardState {
  const size = solution.length;
  return {
    size,
    cells: solution.map((row) => row.map((tile) => bit(tile))),
  };
}
