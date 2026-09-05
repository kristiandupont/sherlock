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
import { findHint, findHints, hintOutcome } from "./hint";

/** Works out everything the clue settles, as a player following the hint would. */
function applyClue(board: BoardState, clue: Clue): BoardState {
  const pos = boardToPositions(board);
  propagate(pos, [clue], board.size);
  return positionsToBoard(pos, board.size);
}

const totalCandidates = (board: BoardState): number =>
  board.cells.reduce((sum, row) => sum + row.reduce((n, mask) => n + popCount(mask), 0), 0);

describe("findHint", () => {
  it("offers a clue on a fresh board", () => {
    const puzzle = generatePuzzle({ seed: 5 });
    const hint = findHint(emptyBoard(puzzle.size), puzzle.clues);
    expect(hint).not.toBeNull();
    expect(hint!.eliminations).toBeGreaterThan(0);
  });

  it("only ever names a clue that really does change the grid", () => {
    const puzzle = generatePuzzle({ seed: 6 });
    let board = emptyBoard(puzzle.size);
    for (let step = 0; step < 5; step++) {
      const hints = findHints(board, puzzle.clues);
      for (const hint of hints) {
        const before = totalCandidates(board);
        const after = totalCandidates(applyClue(board, puzzle.clues[hint.clueIndex]));
        expect(before - after, `clue ${hint.clueIndex}`).toBe(hint.eliminations);
        expect(after).toBeLessThan(before);
      }
      if (hints.length === 0) break;
      board = applyClue(board, puzzle.clues[hints[0].clueIndex]);
    }
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
          board = applyClue(board, puzzle.clues[hint!.clueIndex]);
          expect(++steps).toBeLessThan(500);
        }
        expect(isSolved(board, puzzle.solution), `${difficulty} seed ${seed}`).toBe(true);
      }
    }
  });

  it("has nothing to offer on a finished board", () => {
    const puzzle = generatePuzzle({ seed: 7 });
    expect(findHint(boardFromSolution(puzzle.solution), puzzle.clues)).toBeNull();
  });

  it("leaves clues the player has set aside until last", () => {
    const puzzle = generatePuzzle({ seed: 8 });
    const board = emptyBoard(puzzle.size);
    const best = findHint(board, puzzle.clues)!;
    const used = puzzle.clues.map((_, index) => index === best.clueIndex);
    const next = findHint(board, puzzle.clues, used)!;
    expect(next.clueIndex).not.toBe(best.clueIndex);
    // It is still offered, just last.
    const ranked = findHints(board, puzzle.clues, used);
    expect(ranked[ranked.length - 1].clueIndex).toBe(best.clueIndex);
  });

  it("never offers a clue that the player's grid already contradicts", () => {
    const puzzle = generatePuzzle({ seed: 9 });
    const clue = puzzle.clues.find((c) => c.kind === "same-column")!;
    if (clue.kind !== "same-column") throw new Error("expected a same-column clue");
    // Put the pair in two different columns, which this clue forbids.
    let board = placeTile(emptyBoard(puzzle.size), clue.a.row, 0, clue.a.tile);
    board = placeTile(board, clue.b.row, 1, clue.b.tile);
    const offered = findHints(board, puzzle.clues).map((hint) => puzzle.clues[hint.clueIndex]);
    expect(offered).not.toContain(clue);
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

    expect(findHints(board, clues)).toEqual([]);
    expect(hintOutcome(board, clues).kind).toBe("bookkeeping");
  });

  it("reports a grid that cannot be finished as stuck rather than as bookkeeping", () => {
    const { clues, size } = generatePuzzle({ seed: 13 });
    // Rule one symbol out of every cell of a row, leaving it nowhere to go.
    let board = emptyBoard(size);
    for (let col = 0; col < size; col++) board = removeCandidate(board, 0, col, 2);
    expect(hintOutcome(board, clues).kind).toBe("stuck");
  });

  it("still offers a clue while the grid is only part-way narrowed", () => {
    const { clues, size } = generatePuzzle({ seed: 13 });
    expect(hintOutcome(emptyBoard(size), clues).kind).toBe("clue");
  });

  it("keeps offering hints elsewhere after a wrong elimination", () => {
    const puzzle = generatePuzzle({ seed: 9 });
    // Rule the true tile out of every cell of row 0. Row 0 is now unsolvable,
    // but clues about the other rows still say plenty, so a hint is no promise
    // that the grid so far is right — that is what Check is for.
    let board = emptyBoard(puzzle.size);
    for (let col = 0; col < puzzle.size; col++)
      board = removeCandidate(board, 0, col, puzzle.solution[0][col]);
    expect(mistakes(board, puzzle.solution).length).toBeGreaterThan(0);
    expect(findHint(board, puzzle.clues)).not.toBeNull();
  });
});
