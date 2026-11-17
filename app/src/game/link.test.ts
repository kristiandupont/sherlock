import { describe, expect, it } from "vitest";
import { generatePuzzle } from "../model/generate";
import { parsePuzzleHash, puzzleHash } from "./link";

describe("puzzle links", () => {
  it("reads back what it writes", () => {
    const link = { difficulty: "hard" as const, falseCard: false, size: 6, seed: 1834562211 };
    expect(puzzleHash(link)).toBe("#hard-6x6-1834562211");
    expect(parsePuzzleHash(puzzleHash(link))).toEqual(link);
  });

  it("marks a false-card puzzle, and reads it back", () => {
    const link = { difficulty: "easy" as const, falseCard: true, size: 6, seed: 42 };
    expect(puzzleHash(link)).toBe("#easy-falsecard-6x6-42");
    expect(parsePuzzleHash(puzzleHash(link))).toEqual(link);
  });

  it("accepts the hash without its leading #", () => {
    expect(parsePuzzleHash("easy-6x6-42")).toEqual({
      difficulty: "easy",
      falseCard: false,
      size: 6,
      seed: 42,
    });
  });

  it("rejects anything it did not write", () => {
    expect(parsePuzzleHash("")).toBeNull();
    expect(parsePuzzleHash("#")).toBeNull();
    expect(parsePuzzleHash("#brutal-6x6-42")).toBeNull();
    expect(parsePuzzleHash("#easy-6-42")).toBeNull();
    expect(parsePuzzleHash("#easy-5x5-42")).toBeNull();
    expect(parsePuzzleHash("#easy-6x4-42")).toBeNull();
    expect(parsePuzzleHash("#easy-6x6-")).toBeNull();
    expect(parsePuzzleHash("#easy-6x6-99999999999")).toBeNull();
    expect(parsePuzzleHash("#easy-6x6-42-extra")).toBeNull();
    expect(parsePuzzleHash("#easy-6x6-falsecard-42")).toBeNull();
  });

  it("rebuilds the same puzzle from a linked seed", () => {
    const original = generatePuzzle({ difficulty: "medium" });
    const rebuilt = generatePuzzle({
      difficulty: "medium",
      size: original.size,
      seed: original.seed,
      clueRange: null,
    });
    expect(rebuilt).toEqual(original);
  });
});
