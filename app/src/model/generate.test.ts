import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_PRESETS,
  allTrueClues,
  generatePuzzle,
  puzzleStats,
  randomSolution,
  type Difficulty,
} from "./generate";
import { makeRng } from "./rng";
import { clueHolds, countSolutions, isDeducible } from "./solver";
import { columnOf, type Clue } from "./types";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

describe("randomSolution", () => {
  it("gives every row a permutation of its tiles", () => {
    const solution = randomSolution(6, makeRng(1));
    for (const row of solution) expect(row.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("allTrueClues", () => {
  it("only contains clues that hold for the solution", () => {
    const solution = randomSolution(6, makeRng(11));
    for (const clue of allTrueClues(solution)) expect(clueHolds(clue, solution)).toBe(true);
  });

  it("never claims two tiles of one row share a column", () => {
    const solution = randomSolution(6, makeRng(12));
    const columnClues = allTrueClues(solution).filter(
      (clue): clue is Extract<Clue, { kind: "same-column" | "different-column" }> =>
        clue.kind === "same-column" || clue.kind === "different-column",
    );
    for (const clue of columnClues) expect(clue.a.row).not.toBe(clue.b.row);
  });
});

describe("generatePuzzle", () => {
  it("produces clues that are all true, and a solvable, unique puzzle", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 6; seed++) {
        const puzzle = generatePuzzle({ seed, difficulty });
        const where = `${difficulty} seed ${seed}`;
        for (const clue of puzzle.clues) expect(clueHolds(clue, puzzle.solution), where).toBe(true);
        expect(isDeducible(puzzle.clues, puzzle.size), where).toBe(true);
        expect(countSolutions(puzzle.clues, puzzle.size, 2), where).toBe(1);
      }
    }
  });

  it("returns an irreducible clue set: dropping any one clue breaks it", () => {
    const puzzle = generatePuzzle({ seed: 42 });
    for (let i = 0; i < puzzle.clues.length; i++) {
      const without = puzzle.clues.filter((_, index) => index !== i);
      expect(isDeducible(without, puzzle.size), `clue ${i} was removable`).toBe(false);
    }
  });

  it("reproduces the same puzzle from the seed it reports", () => {
    const first = generatePuzzle({ seed: 4711, difficulty: "hard" });
    const again = generatePuzzle({ seed: first.seed, difficulty: "hard" });
    expect(again).toEqual(first);
  });

  it("keeps the clue count inside each difficulty band", () => {
    for (const difficulty of DIFFICULTIES) {
      const [min, max] = DIFFICULTY_PRESETS[difficulty].clueRange;
      for (let seed = 20; seed < 32; seed++) {
        const count = generatePuzzle({ seed, difficulty }).clues.length;
        expect(count, `${difficulty} seed ${seed}`).toBeGreaterThanOrEqual(min);
        expect(count).toBeLessThanOrEqual(max);
      }
    }
  });

  it("makes hard puzzles lean on between-clues more than easy ones", () => {
    const share = (difficulty: Difficulty) => {
      let between = 0;
      let total = 0;
      for (let seed = 60; seed < 72; seed++) {
        const stats = puzzleStats(generatePuzzle({ seed, difficulty }));
        between += stats.byKind.between;
        total += stats.clueCount;
      }
      return between / total;
    };
    expect(share("hard")).toBeGreaterThan(share("easy") * 2);
  });

  it("does not leak which side of the middle each between-tile is on", () => {
    let leftFirst = 0;
    let rightFirst = 0;
    for (let seed = 0; seed < 30; seed++) {
      const puzzle = generatePuzzle({ seed, difficulty: "hard" });
      for (const clue of puzzle.clues) {
        if (clue.kind !== "between") continue;
        const middle = columnOf(puzzle.solution, clue.middle);
        if (columnOf(puzzle.solution, clue.a) < middle) leftFirst++;
        else rightFirst++;
      }
    }
    expect(leftFirst).toBeGreaterThan(0);
    expect(rightFirst).toBeGreaterThan(0);
    // Roughly balanced: neither ordering should be more than 2:1.
    expect(Math.max(leftFirst, rightFirst) / Math.min(leftFirst, rightFirst)).toBeLessThan(2);
  });

  it("works on smaller grids", () => {
    for (const size of [4, 5]) {
      const puzzle = generatePuzzle({ seed: 5, size, clueRange: null });
      expect(puzzle.size).toBe(size);
      expect(countSolutions(puzzle.clues, size, 2)).toBe(1);
      for (const clue of puzzle.clues) expect(clueHolds(clue, puzzle.solution)).toBe(true);
    }
  });
});
