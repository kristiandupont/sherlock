import { describe, expect, it } from "vitest";
import { generatePuzzle } from "../model/generate";
import { emptyBoard, hasMistake, placeTile, removeCandidate, type BoardState } from "./board";
import { firstBrokenIndex, lastGoodIndex, rewindToLastGood, type Snapshot } from "./history";

const puzzle = generatePuzzle({ seed: 21 });
const { solution, size } = puzzle;

const noneUsed = puzzle.clues.map(() => false);
const start: Snapshot = { board: emptyBoard(size), used: noneUsed };

/** The next snapshot, keeping whichever clues were greyed out before. */
const after = (previous: Snapshot, board: BoardState): Snapshot => ({ board, used: previous.used });

/** A move that keeps the grid correct: rule out a symbol that does not belong. */
function correctMove(previous: Snapshot, row: number, col: number): Snapshot {
  for (let tile = 0; tile < size; tile++) {
    if (tile === solution[row][col]) continue;
    const next = removeCandidate(previous.board, row, col, tile);
    if (next !== previous.board) return after(previous, next);
  }
  return previous;
}

/** A move that breaks the grid: rule out the symbol that does belong. */
const wrongMove = (previous: Snapshot, row: number, col: number): Snapshot =>
  after(previous, removeCandidate(previous.board, row, col, solution[row][col]));

/** Greying a clue out: a step of its own, leaving the grid as it was. */
function useClue(previous: Snapshot, index: number): Snapshot {
  const used = previous.used.slice();
  used[index] = !used[index];
  return { board: previous.board, used };
}

describe("history", () => {
  it("reports nothing broken while every move is correct", () => {
    const history = [start];
    for (let col = 0; col < 4; col++) history.push(correctMove(history[history.length - 1], 0, col));
    expect(firstBrokenIndex(history, solution)).toBe(-1);
    expect(lastGoodIndex(history, solution)).toBe(history.length - 1);
    expect(rewindToLastGood(history, solution)).toBe(history);
  });

  it("finds the move that broke the grid", () => {
    const history = [start];
    history.push(correctMove(history[0], 0, 0));
    history.push(correctMove(history[1], 1, 0));
    history.push(wrongMove(history[2], 2, 0));
    history.push(correctMove(history[3], 3, 0));
    history.push(correctMove(history[4], 4, 0));

    expect(firstBrokenIndex(history, solution)).toBe(3);
    expect(lastGoodIndex(history, solution)).toBe(2);
  });

  it("rewinds to the last correct board, dropping everything built on the mistake", () => {
    const history = [start];
    history.push(correctMove(history[0], 0, 0));
    const lastGood = history[history.length - 1];
    history.push(wrongMove(lastGood, 2, 0));
    history.push(correctMove(history[2], 3, 0));

    const rewound = rewindToLastGood(history, solution);
    expect(rewound).toHaveLength(2);
    expect(rewound[rewound.length - 1]).toBe(lastGood);
    expect(hasMistake(rewound[rewound.length - 1].board, solution)).toBe(false);
    // Undo still works afterwards, because the earlier boards are untouched.
    expect(rewound[0]).toBe(history[0]);
  });

  it("keeps the starting board even if the very first move was wrong", () => {
    const history = [start, wrongMove(start, 0, 0)];
    const rewound = rewindToLastGood(history, solution);
    expect(rewound).toEqual([start]);
    expect(hasMistake(rewound[0].board, solution)).toBe(false);
  });

  it("treats a wrong placement the same as a wrong elimination", () => {
    const wrongTile = (solution[0][0] + 1) % size;
    const history = [start, after(start, placeTile(start.board, 0, 0, wrongTile))];
    expect(firstBrokenIndex(history, solution)).toBe(1);
    expect(rewindToLastGood(history, solution)).toEqual([start]);
  });

  it("puts back the clues that were greyed out on top of the mistake", () => {
    const history = [start];
    history.push(useClue(history[0], 0));
    const lastGood = history[history.length - 1];
    history.push(wrongMove(lastGood, 2, 0));
    // The clue greyed out while reasoning from the wrong grid.
    history.push(useClue(history[2], 1));

    const rewound = rewindToLastGood(history, solution);
    expect(rewound[rewound.length - 1].used).toEqual(
      noneUsed.map((_, index) => index === 0),
    );
  });

  it("never calls a snapshot broken over its greyed-out clues alone", () => {
    const history = [start, useClue(start, 0)];
    expect(firstBrokenIndex(history, solution)).toBe(-1);
  });
});
