import { describe, expect, it } from "vitest";
import { generatePuzzle } from "../model/generate";
import {
  boardFromSolution,
  candidatesAt,
  emptyBoard,
  isComplete,
  isReadyToPlace,
  isSolved,
  mistakes,
  placeTile,
  placedTile,
  removeCandidate,
} from "./board";

const SIZE = 6;

describe("board", () => {
  it("starts with every tile possible everywhere", () => {
    const board = emptyBoard(SIZE);
    expect(candidatesAt(board, 0, 0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(isComplete(board)).toBe(false);
  });

  it("takes a placed tile out of the rest of its row", () => {
    const board = placeTile(emptyBoard(SIZE), 2, 3, 4);
    expect(placedTile(board, 2, 3)).toBe(4);
    for (let col = 0; col < SIZE; col++)
      if (col !== 3) expect(candidatesAt(board, 2, col)).not.toContain(4);
    // Other rows are untouched.
    expect(candidatesAt(board, 1, 3)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("leaves the last candidate in a cell for the player to claim", () => {
    let board = emptyBoard(SIZE);
    for (const tile of [0, 1, 2, 3, 4]) board = removeCandidate(board, 1, 1, tile);

    expect(candidatesAt(board, 1, 1)).toEqual([5]);
    expect(placedTile(board, 1, 1)).toBe(-1);
    expect(isReadyToPlace(board, 1, 1)).toBe(true);
    // Until it is claimed it constrains nothing.
    expect(candidatesAt(board, 1, 0)).toContain(5);

    board = placeTile(board, 1, 1, 5);
    expect(placedTile(board, 1, 1)).toBe(5);
    expect(candidatesAt(board, 1, 0)).not.toContain(5);
  });

  it("does not place a symbol just because only one column in the row can hold it", () => {
    let board = emptyBoard(SIZE);
    for (let col = 1; col < SIZE; col++) board = removeCandidate(board, 0, col, 2);
    expect(placedTile(board, 0, 0)).toBe(-1);
    expect(candidatesAt(board, 0, 0)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("cascades from a placement without making the next placement", () => {
    let board = emptyBoard(SIZE);
    for (const col of [0, 1]) for (const tile of [2, 3, 4, 5])
      board = removeCandidate(board, 0, col, tile);
    expect(candidatesAt(board, 0, 1)).toEqual([0, 1]);

    board = placeTile(board, 0, 0, 0);
    // The placement narrows its neighbour, and stops there.
    expect(candidatesAt(board, 0, 1)).toEqual([1]);
    expect(placedTile(board, 0, 1)).toBe(-1);
    expect(isReadyToPlace(board, 0, 1)).toBe(true);

    board = placeTile(board, 0, 1, 1);
    expect(placedTile(board, 0, 1)).toBe(1);
  });

  it("refuses to place a symbol that has been ruled out in that cell", () => {
    const board = removeCandidate(emptyBoard(SIZE), 0, 0, 3);
    expect(placeTile(board, 0, 0, 3)).toBe(board);
  });

  it("is unfinished while symbols are still waiting to be claimed", () => {
    const { solution } = generatePuzzle({ seed: 12 });
    let board = emptyBoard(SIZE);
    for (let row = 0; row < SIZE; row++)
      for (let col = 0; col < SIZE; col++)
        for (let tile = 0; tile < SIZE; tile++)
          if (tile !== solution[row][col]) board = removeCandidate(board, row, col, tile);

    // Every cell is down to the right symbol, but none of them was claimed.
    expect(mistakes(board, solution)).toEqual([]);
    expect(isComplete(board)).toBe(false);

    for (let row = 0; row < SIZE; row++)
      for (let col = 0; col < SIZE; col++) board = placeTile(board, row, col, solution[row][col]);
    expect(isComplete(board)).toBe(true);
    expect(isSolved(board, solution)).toBe(true);
  });

  it("refuses to remove a cell's last candidate", () => {
    const board = placeTile(emptyBoard(SIZE), 0, 0, 3);
    expect(removeCandidate(board, 0, 0, 3)).toBe(board);
    expect(placedTile(board, 0, 0)).toBe(3);
  });

  it("ignores removing a candidate that is already gone", () => {
    const board = removeCandidate(emptyBoard(SIZE), 0, 0, 1);
    expect(removeCandidate(board, 0, 0, 1)).toBe(board);
  });

  it("leaves the original board untouched when it changes", () => {
    const before = emptyBoard(SIZE);
    const cells = before.cells.map((row) => row.slice());
    const placed = before.placed.map((row) => row.slice());
    placeTile(before, 0, 0, 0);
    removeCandidate(before, 3, 3, 3);
    expect(before.cells).toEqual(cells);
    expect(before.placed).toEqual(placed);
  });

  it("reports a ruled-out correct tile as a mistake", () => {
    const puzzle = generatePuzzle({ seed: 9 });
    const correct = puzzle.solution[0][0];
    const wrong = (correct + 1) % SIZE;
    const board = placeTile(emptyBoard(SIZE), 0, 0, wrong);
    expect(mistakes(board, puzzle.solution)).toContainEqual([0, 0]);
    expect(isSolved(board, puzzle.solution)).toBe(false);
  });

  it("recognises the finished puzzle", () => {
    const puzzle = generatePuzzle({ seed: 9 });
    const board = boardFromSolution(puzzle.solution);
    expect(isComplete(board)).toBe(true);
    expect(mistakes(board, puzzle.solution)).toEqual([]);
    expect(isSolved(board, puzzle.solution)).toBe(true);
  });
});
