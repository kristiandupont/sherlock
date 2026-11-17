import { describe, expect, it } from "vitest";
import type { Clue } from "../model/types";
import { cluesMentioning } from "./peek";

const t = (row: number, tile: number) => ({ row, tile });

describe("cluesMentioning", () => {
  const clues: Clue[] = [
    { kind: "same-column", a: t(0, 1), b: t(2, 3) },
    { kind: "between", middle: t(1, 0), a: t(0, 1), b: t(4, 4) },
    { kind: "at-an-end", a: t(5, 2) },
    { kind: "next-to-either", a: t(3, 3), b: t(2, 2), c: t(0, 1) },
    { kind: "left-of", left: t(1, 1), right: t(0, 2) },
  ];

  it("finds the tile in any position of any kind of clue", () => {
    expect(cluesMentioning(clues, t(0, 1))).toEqual([0, 1, 3]);
    expect(cluesMentioning(clues, t(5, 2))).toEqual([2]);
  });

  it("matches on row and tile together, not either alone", () => {
    // Tile 3 of row 3 is only in clue 3; tile 3 of row 2 is a different symbol.
    expect(cluesMentioning(clues, t(3, 3))).toEqual([3]);
    expect(cluesMentioning(clues, t(1, 2))).toEqual([]);
  });
});
