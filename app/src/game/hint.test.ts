import { describe, expect, it } from "vitest";
import { popCount } from "../model/bits";
import { generatePuzzle } from "../model/generate";
import { propagate } from "../model/solver";
import type { Clue } from "../model/types";
import {
  boardFromSolution,
  boardToPositions,
  emptyBoard,
  isComplete,
  isSolved,
  mistakes,
  placeTile,
  positionsToBoard,
  removeCandidate,
  type BoardState,
} from "./board";
import { findCellHints, findClueHints, findHint, findHints, type Hint } from "./hint";

/** The eliminations a clue yields, without placing anything for the player. */
function applyClue(board: BoardState, clue: Clue): BoardState {
  const pos = boardToPositions(board);
  propagate(pos, [clue], board.size);
  return { size: board.size, cells: positionsToBoard(pos, board.size).cells, placed: board.placed };
}

/** Acts on a hint the way a player would: claim the cell, or work the clue through. */
const act = (board: BoardState, hint: Hint, clues: Clue[]): BoardState =>
  hint.kind === "cell"
    ? placeTile(board, hint.row, hint.col, hint.tile)
    : applyClue(board, clues[hint.clueIndex]);

const totalCandidates = (board: BoardState): number =>
  board.cells.reduce((sum, row) => sum + row.reduce((n, mask) => n + popCount(mask), 0), 0);

describe("findCellHints", () => {
  const { size } = generatePuzzle({ seed: 3 });

  it("offers nothing on an untouched grid", () => {
    expect(findCellHints(emptyBoard(size))).toEqual([]);
  });

  it("points at a cell with one symbol left in it", () => {
    let board = emptyBoard(size);
    for (const tile of [0, 1, 2, 3, 4]) board = removeCandidate(board, 2, 3, tile);
    expect(findCellHints(board)).toEqual([
      { kind: "cell", row: 2, col: 3, tile: 5, reason: "only-candidate" },
    ]);
  });

  it("points at the last cell in a row that can hold a symbol", () => {
    let board = emptyBoard(size);
    for (let col = 0; col < size; col++)
      if (col !== 4) board = removeCandidate(board, 1, col, 2);
    expect(findCellHints(board)).toEqual([
      { kind: "cell", row: 1, col: 4, tile: 2, reason: "only-place" },
    ]);
  });

  it("puts the cell with one symbol left before the cell that is a symbol's last home", () => {
    let board = emptyBoard(size);
    for (let col = 0; col < size; col++)
      if (col !== 4) board = removeCandidate(board, 1, col, 2);
    for (const tile of [0, 1, 2, 3, 4]) board = removeCandidate(board, 2, 3, tile);

    const hints = findCellHints(board);
    expect(hints.map((hint) => hint.reason)).toEqual(["only-candidate", "only-place"]);
  });

  it("says nothing about a cell the player has already claimed", () => {
    let board = emptyBoard(size);
    for (const tile of [0, 1, 2, 3, 4]) board = removeCandidate(board, 2, 3, tile);
    expect(findCellHints(board)).toHaveLength(1);
    board = placeTile(board, 2, 3, 5);
    expect(findCellHints(board)).toEqual([]);
  });

  it("never names the same cell twice", () => {
    const { solution, size: n } = generatePuzzle({ seed: 4 });
    let board = emptyBoard(n);
    for (let row = 0; row < n; row++)
      for (let col = 0; col < n; col++)
        for (let tile = 0; tile < n; tile++)
          if (tile !== solution[row][col]) board = removeCandidate(board, row, col, tile);

    const hints = findCellHints(board);
    expect(new Set(hints.map((hint) => `${hint.row}:${hint.col}`)).size).toBe(hints.length);
    expect(hints).toHaveLength(n * n);
  });
});

describe("findHints", () => {
  it("puts every cell hint before every clue hint", () => {
    const { clues, size } = generatePuzzle({ seed: 5 });
    let board = emptyBoard(size);
    for (const tile of [0, 1, 2, 3, 4]) board = removeCandidate(board, 2, 3, tile);

    const hints = findHints(board, clues);
    const lastCell = hints.map((hint) => hint.kind).lastIndexOf("cell");
    const firstClue = hints.map((hint) => hint.kind).indexOf("clue");
    expect(lastCell).toBeGreaterThanOrEqual(0);
    expect(firstClue).toBeGreaterThan(lastCell);
  });

  it("offers a clue on a fresh board, since no cell can be settled yet", () => {
    const { clues, size } = generatePuzzle({ seed: 5 });
    const hint = findHint(emptyBoard(size), clues);
    expect(hint?.kind).toBe("clue");
  });

  it("solves any puzzle by following its own hints", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      for (let seed = 0; seed < 5; seed++) {
        const puzzle = generatePuzzle({ seed, difficulty });
        let board = emptyBoard(puzzle.size);
        let steps = 0;
        while (!isComplete(board)) {
          const hint = findHint(board, puzzle.clues);
          expect(hint, `${difficulty} seed ${seed} stalled after ${steps} hints`).not.toBeNull();
          board = act(board, hint!, puzzle.clues);
          expect(++steps).toBeLessThan(500);
        }
        expect(isSolved(board, puzzle.solution), `${difficulty} seed ${seed}`).toBe(true);
      }
    }
  });

  it("has nothing to offer on a finished board", () => {
    const puzzle = generatePuzzle({ seed: 7 });
    expect(findHints(boardFromSolution(puzzle.solution), puzzle.clues)).toEqual([]);
  });
});

describe("findClueHints", () => {
  it("only ever names a clue that really does change the grid", () => {
    const puzzle = generatePuzzle({ seed: 6 });
    let board = emptyBoard(puzzle.size);
    for (let step = 0; step < 5; step++) {
      const hints = findClueHints(board, puzzle.clues);
      for (const hint of hints) {
        const before = totalCandidates(board);
        const after = totalCandidates(applyClue(board, puzzle.clues[hint.clueIndex]));
        expect(after).toBeLessThan(before);
      }
      if (hints.length === 0) break;
      board = applyClue(board, puzzle.clues[hints[0].clueIndex]);
    }
  });

  it("does not credit a clue with bookkeeping the player has not done", () => {
    const { solution, clues, size } = generatePuzzle({ seed: 13 });
    // Narrow every cell to the right symbol by elimination alone, claiming
    // none of them. The grid is fully determined, so no clue has anything left
    // to say, and none should be offered as though it had.
    let board = emptyBoard(size);
    for (let row = 0; row < size; row++)
      for (let col = 0; col < size; col++)
        for (let tile = 0; tile < size; tile++)
          if (tile !== solution[row][col]) board = removeCandidate(board, row, col, tile);

    expect(findClueHints(board, clues)).toEqual([]);
    // There is still plenty to point at: every cell is waiting to be claimed.
    expect(findHints(board, clues).every((hint) => hint.kind === "cell")).toBe(true);
  });

  it("leaves clues the player has set aside until last", () => {
    const puzzle = generatePuzzle({ seed: 8 });
    const board = emptyBoard(puzzle.size);
    const best = findClueHints(board, puzzle.clues)[0];
    const used = puzzle.clues.map((_, index) => index === best.clueIndex);

    const ranked = findClueHints(board, puzzle.clues, used);
    expect(ranked[0].clueIndex).not.toBe(best.clueIndex);
    expect(ranked[ranked.length - 1].clueIndex).toBe(best.clueIndex);
  });

  it("never offers a clue that the player's grid already contradicts", () => {
    const puzzle = generatePuzzle({ seed: 9 });
    const clue = puzzle.clues.find((c) => c.kind === "same-column")!;
    if (clue.kind !== "same-column") throw new Error("expected a same-column clue");
    // Put the pair in two different columns, which this clue forbids.
    let board = placeTile(emptyBoard(puzzle.size), clue.a.row, 0, clue.a.tile);
    board = placeTile(board, clue.b.row, 1, clue.b.tile);
    const offered = findClueHints(board, puzzle.clues).map((hint) => puzzle.clues[hint.clueIndex]);
    expect(offered).not.toContain(clue);
  });

  it("keeps offering hints elsewhere after a wrong elimination", () => {
    const puzzle = generatePuzzle({ seed: 9 });
    // Rule the true symbol out of every cell of row 0. Row 0 is now unsolvable,
    // but the other rows still have plenty to say, so a hint is no promise that
    // the grid so far is right.
    let board = emptyBoard(puzzle.size);
    for (let col = 0; col < puzzle.size; col++)
      board = removeCandidate(board, 0, col, puzzle.solution[0][col]);
    expect(mistakes(board, puzzle.solution).length).toBeGreaterThan(0);
    expect(findHint(board, puzzle.clues)).not.toBeNull();
  });
});
