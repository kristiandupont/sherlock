import { describe, expect, it } from "vitest";
import {
  conflictGroups,
  falseCardIsDeducible,
  falseCardIsFair,
  falseCardStandsOut,
  smallestConflict,
  trustedGrid,
} from "./falseCard";
import { DIFFICULTY_PRESETS, generatePuzzle, type Difficulty } from "./generate";
import { clueHolds, countSolutions, propagate } from "./solver";
import type { Clue, Puzzle } from "./types";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const t = (row: number, tile: number) => ({ row, tile });

const puzzles: Array<[string, Difficulty, Puzzle]> = DIFFICULTIES.flatMap((difficulty) =>
  [1, 2].map((seed): [string, Difficulty, Puzzle] => [
    `${difficulty} seed ${seed}`,
    difficulty,
    generatePuzzle({ seed, difficulty, falseCard: true }),
  ]),
);

const withoutIndex = (clues: Clue[], index: number) => clues.filter((_, i) => i !== index);

describe("false-card puzzles", () => {
  it("have exactly one false card, and the rest solve the grid uniquely", () => {
    for (const [where, , puzzle] of puzzles) {
      const falseIndex = puzzle.falseClue!;
      expect(falseIndex, where).not.toBeNull();
      expect(clueHolds(puzzle.clues[falseIndex], puzzle.solution), where).toBe(false);
      const truths = withoutIndex(puzzle.clues, falseIndex);
      for (const clue of truths) expect(clueHolds(clue, puzzle.solution), where).toBe(true);
      expect(countSolutions(truths, puzzle.size, 2, puzzle.exclusions), where).toBe(1);
    }
  });

  it("leave no solution at all if any other card is taken to be the false one", () => {
    // An independent check of the propagation-only condition, by backtracking.
    for (const [where, , puzzle] of puzzles) {
      for (let j = 0; j < puzzle.clues.length; j++) {
        if (j === puzzle.falseClue) continue;
        const trusted = withoutIndex(puzzle.clues, j);
        expect(countSolutions(trusted, puzzle.size, 1, puzzle.exclusions), `${where}, card ${j}`).toBe(
          0,
        );
      }
    }
  });

  it("can be worked out by deduction, with a contradiction no larger than the preset allows", () => {
    for (const [where, difficulty, puzzle] of puzzles) {
      const { clues, falseClue, size, exclusions } = puzzle;
      expect(falseCardIsDeducible(clues, falseClue!, size, exclusions), where).toBe(true);
      const group = smallestConflict(clues, falseClue!, size, exclusions, 6);
      expect(group, where).not.toBeNull();
      expect(group!.length, where).toBeLessThanOrEqual(DIFFICULTY_PRESETS[difficulty].falseGroup);
      expect(group, where).toContain(falseClue);
    }
  });

  it("let the false card be found without supposing anything", () => {
    // Whichever smallest group the player finds: trusting every card outside
    // it gives a grid that the false card contradicts on its own, while each
    // other card of the group still fits.
    for (const [where, difficulty, puzzle] of puzzles) {
      const { clues, falseClue, size, exclusions } = puzzle;
      const groups = conflictGroups(
        clues,
        falseClue!,
        size,
        exclusions,
        DIFFICULTY_PRESETS[difficulty].falseGroup,
      );
      expect(groups.length, where).toBeGreaterThan(0);
      for (const group of groups) {
        const grid = trustedGrid(clues, group, size, exclusions)!;
        expect(grid, where).not.toBeNull();
        for (const index of group) {
          const fits = propagate(Int32Array.from(grid), [clues[index]], size).ok;
          expect(fits, `${where}, card ${index} of group ${group}`).toBe(index !== falseClue);
        }
        expect(falseCardStandsOut(clues, falseClue!, group, size, exclusions), where).toBe(true);
      }
    }
  });

  it("have no card that could be dropped while the puzzle stays fair", () => {
    const [where, difficulty, puzzle] = puzzles[2];
    const falseIndex = puzzle.falseClue!;
    const maxGroup = DIFFICULTY_PRESETS[difficulty].falseGroup;
    for (let i = 0; i < puzzle.clues.length; i++) {
      if (i === falseIndex) continue;
      const fewer = withoutIndex(puzzle.clues, i);
      const shifted = i < falseIndex ? falseIndex - 1 : falseIndex;
      expect(
        falseCardIsFair(fewer, shifted, puzzle.size, puzzle.exclusions, maxGroup),
        `${where}, card ${i} was removable`,
      ).toBeNull();
    }
  });

  it("are rebuilt exactly from the seed they report", () => {
    const [, difficulty, puzzle] = puzzles[0];
    const again = generatePuzzle({ seed: puzzle.seed, difficulty, falseCard: true, clueRange: null });
    expect(again).toEqual(puzzle);
  });
});

describe("smallestConflict", () => {
  // A is at an end and right of B, so propagation puts it in the last column,
  // where it cannot be immediately left of C. "C is left of A" contradicts that
  // last card on its own.
  const A = t(0, 0);
  const B = t(1, 0);
  const C = t(2, 0);
  const atEnd: Clue = { kind: "at-an-end", a: A };
  const bLeftOfA: Clue = { kind: "left-of", left: B, right: A };
  const cLeftOfA: Clue = { kind: "left-of", left: C, right: A };
  const aBeforeC: Clue = { kind: "immediately-left-of", left: A, right: C };

  it("finds a pair before a larger group", () => {
    expect(smallestConflict([atEnd, bLeftOfA, cLeftOfA, aBeforeC], 3, 6, [], 4)).toEqual([3, 2]);
  });

  it("finds a group of three when no pair contradicts", () => {
    expect(smallestConflict([atEnd, bLeftOfA, aBeforeC], 2, 6, [], 4)).toEqual([2, 0, 1]);
  });

  it("returns null when no group within the limit contradicts", () => {
    expect(smallestConflict([atEnd, bLeftOfA, aBeforeC], 2, 6, [], 2)).toBeNull();
  });
});
