import { bit, bitList, fullMask, isSingle, lowestBit, popCount } from "../model/bits";
import type { Solution } from "../model/types";

/**
 * What the player sees: `cells[row][col]` is the set of tiles still possible in
 * that cell, as a bitmask. This is the transpose of the solver's PosMask.
 *
 * `placed[row][col]` records that the player put that symbol there themselves.
 * A cell down to its last candidate is *not* placed: seeing the one remaining
 * option and clicking it is the move, and the cascade it sets off is the reward
 * for having worked it out. So the board never places a symbol on the player's
 * behalf.
 */
export type BoardState = {
  size: number;
  cells: number[][];
  placed: boolean[][];
};

export const emptyBoard = (size: number): BoardState => ({
  size,
  cells: Array.from({ length: size }, () => new Array<number>(size).fill(fullMask(size))),
  placed: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
});

const cloneCells = (board: BoardState): number[][] => board.cells.map((row) => row.slice());

/**
 * The one consequence a placement carries: a symbol the player has placed in a
 * column cannot also be somewhere else in its row. Nothing here ever places a
 * symbol, so it cannot cascade into further placements.
 */
function applyPlacements(size: number, cells: number[][], placed: boolean[][]): number[][] {
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      if (!placed[row][col]) continue;
      const mask = cells[row][col];
      for (let other = 0; other < size; other++) {
        if (other === col) continue;
        cells[row][other] &= ~mask;
      }
    }
  return cells;
}

/**
 * Places `tile` in this cell, discarding the cell's other candidates. Refused
 * if the symbol has already been ruled out here, which keeps two cells of a row
 * from claiming the same symbol.
 */
export function placeTile(board: BoardState, row: number, col: number, tile: number): BoardState {
  if (!(board.cells[row][col] & bit(tile))) return board;
  if (board.placed[row][col] && board.cells[row][col] === bit(tile)) return board;
  const cells = cloneCells(board);
  const placed = board.placed.map((r) => r.slice());
  cells[row][col] = bit(tile);
  placed[row][col] = true;
  return { size: board.size, cells: applyPlacements(board.size, cells, placed), placed };
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
  return { size: board.size, cells, placed: board.placed };
}

export const candidatesAt = (board: BoardState, row: number, col: number): number[] =>
  bitList(board.cells[row][col]);

export const candidateCount = (board: BoardState, row: number, col: number): number =>
  popCount(board.cells[row][col]);

/** The tile the player has placed in this cell, or -1 if they have not. */
export const placedTile = (board: BoardState, row: number, col: number): number =>
  board.placed[row][col] ? lowestBit(board.cells[row][col]) : -1;

/** One candidate left, waiting for the player to claim it. */
export const isReadyToPlace = (board: BoardState, row: number, col: number): boolean =>
  !board.placed[row][col] && isSingle(board.cells[row][col]);

export const isComplete = (board: BoardState): boolean =>
  board.placed.every((row) => row.every(Boolean));

/** Whether any cell has ruled out the tile that belongs there. Stops at the first. */
export function hasMistake(board: BoardState, solution: Solution): boolean {
  for (let row = 0; row < board.size; row++)
    for (let col = 0; col < board.size; col++)
      if (!(board.cells[row][col] & bit(solution[row][col]))) return true;
  return false;
}

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

/**
 * The solver works per tile ("which columns are still open to it"), the board
 * per cell ("which tiles are still possible here"). These are transposes of one
 * another.
 */
export function boardToPositions(board: BoardState): Int32Array {
  const { size } = board;
  const pos = new Int32Array(size * size);
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      for (let tile = 0; tile < size; tile++)
        if (board.cells[row][col] & bit(tile)) pos[row * size + tile] |= bit(col);
  return pos;
}

/**
 * Reads solver positions back as a board. Anything the solver narrowed to one
 * candidate counts as placed, since this represents reasoning carried through
 * rather than a grid the player is part-way across.
 */
export function positionsToBoard(pos: Int32Array, size: number): BoardState {
  const cells = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  for (let row = 0; row < size; row++)
    for (let tile = 0; tile < size; tile++)
      for (let col = 0; col < size; col++)
        if (pos[row * size + tile] & bit(col)) cells[row][col] |= bit(tile);
  return { size, cells, placed: cells.map((row) => row.map(isSingle)) };
}

export function boardFromSolution(solution: Solution): BoardState {
  const size = solution.length;
  return {
    size,
    cells: solution.map((row) => row.map((tile) => bit(tile))),
    placed: solution.map((row) => row.map(() => true)),
  };
}
