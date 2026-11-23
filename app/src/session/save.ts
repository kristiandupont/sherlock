import { LEGACY_STORAGE_KEY } from "../game/legacySave";
import { DIFFICULTIES } from "../game/link";
import { restoreSuspects, type Suspects } from "../game/suspects";
import type { Difficulty } from "../model/generate";
import { flipsForPuzzle, type Point } from "../ui/clueLayout";
import { puzzleFromLink, type Game } from "./game";

export const STORAGE_KEY = "sherlock:game:v5";

/**
 * A game as written to storage. A puzzle is fully determined by its seed and
 * difficulty, so only those are stored, and the puzzle is rebuilt on load.
 */
export type Saved = {
  difficulty: Difficulty;
  /** Absent in saves written before false-card puzzles existed. */
  falseCard?: boolean;
  seed: number;
  size: number;
  /** Every snapshot of the history, oldest first, so undo and rewind survive a reload. */
  history: Array<{ cells: number[][]; placed: boolean[][]; used: boolean[] }>;
  positions: Point[];
  flipped?: boolean[];
  hintsUsed?: number;
  suspects?: Suspects;
};

export function toSaved(game: Game): Saved {
  return {
    difficulty: game.difficulty,
    falseCard: game.puzzle.falseClue !== null,
    seed: game.puzzle.seed,
    size: game.puzzle.size,
    history: game.history.map(({ board: { cells, placed }, used }) => ({ cells, placed, used })),
    positions: game.positions,
    flipped: game.flipped,
    hintsUsed: game.hintsUsed,
    suspects: game.suspects,
  };
}

/**
 * Reads a game back from the text `toSaved` was written as. Null for anything
 * that cannot be read or does not fit the puzzle it names. `legacy` is set for
 * text read from `LEGACY_STORAGE_KEY`, of which only hard games are kept.
 */
export function fromSaved(raw: string, legacy: boolean): Game | null {
  try {
    const saved = JSON.parse(raw) as Saved;
    if (!DIFFICULTIES.includes(saved.difficulty)) return null;
    if (legacy && saved.difficulty !== "hard") return null;
    const puzzle = puzzleFromLink({ ...saved, falseCard: saved.falseCard ?? false });
    if (!Array.isArray(saved.history) || saved.history.length === 0) return null;
    if (saved.history.some((state) => !state?.cells || !state?.placed)) return null;
    if (saved.history.some((state) => state.used?.length !== puzzle.clues.length)) return null;
    return {
      difficulty: saved.difficulty,
      puzzle,
      history: saved.history.map(({ cells, placed, used }) => ({
        board: { size: saved.size, cells, placed },
        used,
      })),
      positions: saved.positions,
      // Saves written before cards could be turned round have no orientations,
      // so the puzzle's own are used and the game carries on.
      flipped:
        saved.flipped?.length === puzzle.clues.length
          ? saved.flipped
          : flipsForPuzzle(puzzle.clues, puzzle.seed),
      hintsUsed: typeof saved.hintsUsed === "number" ? saved.hintsUsed : 0,
      suspects: restoreSuspects(saved.suspects, puzzle.clues.length),
    };
  } catch {
    return null;
  }
}

/** The saved game, falling back to a legacy save when there is no current one. */
export function loadGame(storage: Storage = localStorage): Game | null {
  try {
    const current = storage.getItem(STORAGE_KEY);
    const legacy = current ? null : storage.getItem(LEGACY_STORAGE_KEY);
    const raw = current ?? legacy;
    if (!raw) return null;
    return fromSaved(raw, legacy !== null);
  } catch {
    return null;
  }
}

/**
 * Saves `game`, unless its cards have not been laid out yet. A full or blocked
 * store just means the game is not resumable.
 */
export function storeGame(game: Game, storage: Storage = localStorage): void {
  if (game.positions.length !== game.puzzle.clues.length) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(toSaved(game)));
    // Removed here rather than when it is read: the read happens in a state
    // initialiser, which React may call twice, and the second call would find
    // the save already gone.
    storage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Nothing to do; see above.
  }
}
