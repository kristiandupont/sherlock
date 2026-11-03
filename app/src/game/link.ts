import type { Difficulty } from "../model/generate";
import { DEFAULT_SIZE } from "../model/types";

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

/** What a link has to carry to rebuild a puzzle; none of the player's progress. */
export type PuzzleLink = { difficulty: Difficulty; size: number; seed: number };

/**
 * Written as `#<difficulty>-<columns>x<rows>-<seed>`, e.g.
 * `#hard-6x6-1834562211`. Both dimensions are written out although the board
 * is square for now, so that links shared today keep their meaning once the
 * two can differ.
 *
 * A link names the generator's input, not its output, so it stays valid only
 * as long as `generatePuzzle` builds the same puzzle from the same seed.
 */
export function puzzleHash({ difficulty, size, seed }: PuzzleLink): string {
  return `#${difficulty}-${size}x${size}-${seed}`;
}

/** Reads a link written by `puzzleHash`, or returns null for anything else. */
export function parsePuzzleHash(hash: string): PuzzleLink | null {
  const match = /^#?([a-z]+)-(\d+)x(\d+)-(\d+)$/.exec(hash);
  if (!match) return null;
  const difficulty = match[1] as Difficulty;
  const columns = Number(match[2]);
  const rows = Number(match[3]);
  const seed = Number(match[4]);
  if (!DIFFICULTIES.includes(difficulty)) return null;
  // The board only draws the default size so far, and only square.
  if (columns !== DEFAULT_SIZE || rows !== DEFAULT_SIZE) return null;
  if (!Number.isSafeInteger(seed) || seed > 0xffffffff) return null;
  return { difficulty, size: columns, seed };
}
