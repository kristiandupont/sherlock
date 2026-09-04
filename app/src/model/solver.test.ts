import { describe, expect, it } from "vitest";
import { bit, fullMask } from "./bits";
import { allTrueClues, generatePuzzle, randomSolution } from "./generate";
import { makeRng } from "./rng";
import {
  clueHolds,
  countSolutions,
  openPositions,
  positionsToSolution,
  propagate,
  solveByDeduction,
} from "./solver";
import { tileId, type Clue, type Solution } from "./types";

const SIZE = 6;

/** `pos` with every tile pinned to the column it occupies in `solution`. */
function pinned(solution: Solution) {
  const size = solution.length;
  const pos = new Int32Array(size * size);
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) pos[tileId({ row, tile: solution[row][col] }, size)] = bit(col);
  return pos;
}

describe("propagation rules", () => {
  it("never contradicts the solution they were derived from", () => {
    for (let seed = 0; seed < 40; seed++) {
      const solution = randomSolution(SIZE, makeRng(seed));
      const pool = allTrueClues(solution);
      const result = propagate(pinned(solution), pool, SIZE);
      expect(result.ok, `seed ${seed}`).toBe(true);
    }
  });

  it("never eliminates a column the solution actually uses", () => {
    for (let seed = 0; seed < 40; seed++) {
      const solution = randomSolution(SIZE, makeRng(seed));
      const pos = openPositions(SIZE);
      expect(propagate(pos, allTrueClues(solution), SIZE).ok).toBe(true);
      for (let row = 0; row < SIZE; row++)
        for (let col = 0; col < SIZE; col++)
          expect(pos[tileId({ row, tile: solution[row][col] }, SIZE)] & bit(col)).not.toBe(0);
    }
  });

  it("solves the grid outright from the full clue pool", () => {
    for (let seed = 0; seed < 20; seed++) {
      const solution = randomSolution(SIZE, makeRng(seed));
      const result = solveByDeduction(allTrueClues(solution), SIZE);
      expect(result.solved).toBe(true);
      expect(positionsToSolution(result.pos, SIZE)).toEqual(solution);
    }
  });

  it("reports a contradiction when a clue is false", () => {
    const solution = randomSolution(SIZE, makeRng(7));
    const a = { row: 0, tile: solution[0][0] };
    const b = { row: 1, tile: solution[1][3] };
    // These two tiles are in columns 0 and 3, so claiming they are adjacent is false.
    const clues: Clue[] = [...allTrueClues(solution), { kind: "adjacent", a, b }];
    expect(propagate(pinned(solution), clues, SIZE).ok).toBe(false);
  });
});

describe("individual rules", () => {
  const size = 4;
  const a = { row: 0, tile: 0 };
  const b = { row: 1, tile: 0 };
  const c = { row: 2, tile: 0 };
  const narrow = (clues: Clue[], setup: (pos: Int32Array) => void) => {
    const pos = openPositions(size);
    setup(pos);
    const ok = propagate(pos, clues, size).ok;
    return { ok, pos };
  };

  it("adjacent keeps only neighbouring columns", () => {
    const { pos } = narrow([{ kind: "adjacent", a, b }], (p) => {
      p[tileId(b, size)] = bit(0);
    });
    expect(pos[tileId(a, size)]).toBe(bit(1));
  });

  it("left-of bounds both tiles", () => {
    const { pos } = narrow([{ kind: "left-of", left: a, right: b }], () => {});
    expect(pos[tileId(a, size)]).toBe(fullMask(size) & ~bit(size - 1));
    expect(pos[tileId(b, size)]).toBe(fullMask(size) & ~bit(0));
  });

  it("between pins the middle from either side", () => {
    const { pos } = narrow([{ kind: "between", middle: a, a: b, b: c }], (p) => {
      p[tileId(b, size)] = bit(0);
    });
    expect(pos[tileId(a, size)]).toBe(bit(1));
    expect(pos[tileId(c, size)]).toBe(bit(2));
  });

  it("between rejects an impossible middle", () => {
    const { ok } = narrow([{ kind: "between", middle: a, a: b, b: c }], (p) => {
      p[tileId(b, size)] = bit(0);
      p[tileId(c, size)] = bit(0);
    });
    expect(ok).toBe(false);
  });

  it("different-column only fires once one side is pinned", () => {
    const { pos } = narrow([{ kind: "different-column", a, b }], (p) => {
      p[tileId(a, size)] = bit(2);
    });
    expect(pos[tileId(b, size)] & bit(2)).toBe(0);
  });
});

describe("countSolutions", () => {
  it("agrees with deduction that a generated puzzle has one solution", () => {
    for (let seed = 0; seed < 8; seed++) {
      const puzzle = generatePuzzle({ seed, size: SIZE });
      expect(countSolutions(puzzle.clues, SIZE, 2)).toBe(1);
    }
  });

  it("finds several solutions when clues are removed", () => {
    const puzzle = generatePuzzle({ seed: 3, size: SIZE });
    const fewer = puzzle.clues.slice(0, puzzle.clues.length - 3);
    expect(countSolutions(fewer, SIZE, 2)).toBe(2);
    expect(fewer.every((clue) => clueHolds(clue, puzzle.solution))).toBe(true);
  });
});
