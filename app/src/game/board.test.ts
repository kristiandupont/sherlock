import { describe, expect, it } from "vitest";
import { generatePuzzle } from "../model/generate";
import {
  boardFromSolution,
  candidatesAt,
  emptyBoard,
  isComplete,
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

  it("places a tile once it is the only candidate left in a cell", () => {
    let board = emptyBoard(SIZE);
    for (const tile of [0, 1, 2, 3]) board = removeCandidate(board, 1, 1, tile);
    expect(placedTile(board, 1, 1)).toBe(-1);
    board = removeCandidate(board, 1, 1, 4);
    expect(placedTile(board, 1, 1)).toBe(5);
  });

  it("places a tile once only one column in its row can hold it", () => {
    let board = emptyBoard(SIZE);
    for (let col = 1; col < SIZE; col++) board = removeCandidate(board, 0, col, 2);
    expect(placedTile(board, 0, 0)).toBe(2);
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
    const snapshot = before.cells.map((row) => row.slice());
    placeTile(before, 0, 0, 0);
    removeCandidate(before, 3, 3, 3);
    expect(before.cells).toEqual(snapshot);
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
