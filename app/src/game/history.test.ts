import { describe, expect, it } from "vitest";
import { generatePuzzle } from "../model/generate";
import { emptyBoard, hasMistake, placeTile, removeCandidate, type BoardState } from "./board";
import { firstBrokenIndex, lastGoodIndex, rewindToLastGood } from "./history";

const puzzle = generatePuzzle({ seed: 21 });
const { solution, size } = puzzle;

/** A move that keeps the grid correct: rule out a symbol that does not belong. */
function correctMove(board: BoardState, row: number, col: number): BoardState {
  for (let tile = 0; tile < size; tile++) {
    if (tile === solution[row][col]) continue;
    const next = removeCandidate(board, row, col, tile);
    if (next !== board) return next;
  }
  return board;
}

/** A move that breaks the grid: rule out the symbol that does belong. */
const wrongMove = (board: BoardState, row: number, col: number): BoardState =>
  removeCandidate(board, row, col, solution[row][col]);

describe("history", () => {
  it("reports nothing broken while every move is correct", () => {
    const history = [emptyBoard(size)];
    for (let col = 0; col < 4; col++) history.push(correctMove(history[history.length - 1], 0, col));
    expect(firstBrokenIndex(history, solution)).toBe(-1);
    expect(lastGoodIndex(history, solution)).toBe(history.length - 1);
    expect(rewindToLastGood(history, solution)).toBe(history);
  });

  it("finds the move that broke the grid", () => {
    const history = [emptyBoard(size)];
    history.push(correctMove(history[0], 0, 0));
    history.push(correctMove(history[1], 1, 0));
    history.push(wrongMove(history[2], 2, 0));
    history.push(correctMove(history[3], 3, 0));
    history.push(correctMove(history[4], 4, 0));

    expect(firstBrokenIndex(history, solution)).toBe(3);
    expect(lastGoodIndex(history, solution)).toBe(2);
  });

  it("rewinds to the last correct board, dropping everything built on the mistake", () => {
    const history = [emptyBoard(size)];
    history.push(correctMove(history[0], 0, 0));
    const lastGood = history[history.length - 1];
    history.push(wrongMove(lastGood, 2, 0));
    history.push(correctMove(history[2], 3, 0));

    const rewound = rewindToLastGood(history, solution);
    expect(rewound).toHaveLength(2);
    expect(rewound[rewound.length - 1]).toBe(lastGood);
    expect(hasMistake(rewound[rewound.length - 1], solution)).toBe(false);
    // Undo still works afterwards, because the earlier boards are untouched.
    expect(rewound[0]).toBe(history[0]);
  });

  it("keeps the starting board even if the very first move was wrong", () => {
    const start = emptyBoard(size);
    const history = [start, wrongMove(start, 0, 0)];
    const rewound = rewindToLastGood(history, solution);
    expect(rewound).toEqual([start]);
    expect(hasMistake(rewound[0], solution)).toBe(false);
  });

  it("treats a wrong placement the same as a wrong elimination", () => {
    const start = emptyBoard(size);
    const wrongTile = (solution[0][0] + 1) % size;
    const history = [start, placeTile(start, 0, 0, wrongTile)];
    expect(firstBrokenIndex(history, solution)).toBe(1);
    expect(rewindToLastGood(history, solution)).toEqual([start]);
  });
});
