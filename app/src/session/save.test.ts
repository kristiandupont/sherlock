import { describe, expect, it } from "vitest";
import { LEGACY_STORAGE_KEY } from "../game/legacySave";
import { addSuspects } from "../game/suspects";
import { generatePuzzle } from "../model/generate";
import { flipsForPuzzle } from "../ui/clueLayout";
import { flipCards, newGameState, toggleUsed, withLayout, type Game } from "./game";
import { fromSaved, loadGame, STORAGE_KEY, storeGame, toSaved } from "./save";

function memoryStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, String(value)),
  };
}

const laidOut = (difficulty: "easy" | "hard", falseCard = false): Game =>
  withLayout(newGameState(difficulty, generatePuzzle({ difficulty, falseCard, seed: 7 })), 800);

const text = (game: Game, change: (saved: Record<string, unknown>) => void = () => {}) => {
  const saved = toSaved(game) as unknown as Record<string, unknown>;
  change(saved);
  return JSON.stringify(saved);
};

describe("fromSaved", () => {
  it("reads back what toSaved wrote", () => {
    const original = laidOut("easy", true);
    const game = {
      ...flipCards(toggleUsed(original, 1), [0]),
      hintsUsed: 3,
      suspects: addSuspects(original.suspects, [2, 4]),
    };
    const restored = fromSaved(text(game), false);
    expect(restored).not.toBeNull();
    expect(restored!.puzzle).toEqual(game.puzzle);
    expect(restored!.history).toEqual(game.history);
    expect(restored!.positions).toEqual(game.positions);
    expect(restored!.flipped).toEqual(game.flipped);
    expect(restored!.hintsUsed).toBe(3);
    expect(restored!.suspects).toEqual(game.suspects);
  });

  it("keeps only hard games from a legacy save", () => {
    expect(fromSaved(text(laidOut("easy")), true)).toBeNull();
    expect(fromSaved(text(laidOut("hard")), true)).not.toBeNull();
  });

  it("falls back to the puzzle's own orientations and no hints in older saves", () => {
    const game = laidOut("easy");
    const restored = fromSaved(
      text(game, (saved) => {
        delete saved.flipped;
        delete saved.hintsUsed;
      }),
      false,
    );
    expect(restored!.flipped).toEqual(flipsForPuzzle(game.puzzle.clues, game.puzzle.seed));
    expect(restored!.hintsUsed).toBe(0);
  });

  it("rejects saves that do not fit the puzzle or cannot be read", () => {
    const game = laidOut("easy");
    expect(fromSaved("not json", false)).toBeNull();
    expect(fromSaved(text(game, (saved) => (saved.difficulty = "extreme")), false)).toBeNull();
    expect(fromSaved(text(game, (saved) => (saved.history = [])), false)).toBeNull();
    const shortUsed = text(game, (saved) => {
      saved.history = [{ ...toSaved(game).history[0], used: [false] }];
    });
    expect(fromSaved(shortUsed, false)).toBeNull();
  });
});

describe("loadGame and storeGame", () => {
  it("stores a laid-out game, loads it back, and removes the legacy save", () => {
    const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: text(laidOut("hard")) });
    const game = laidOut("easy");
    storeGame(game, storage);
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(loadGame(storage)?.puzzle.seed).toBe(game.puzzle.seed);
  });

  it("does not store a game whose cards have not been laid out", () => {
    const storage = memoryStorage();
    const game = laidOut("easy");
    storeGame({ ...game, positions: [] }, storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("reads the legacy save only when there is no current one", () => {
    const hard = laidOut("hard");
    expect(loadGame(memoryStorage({ [LEGACY_STORAGE_KEY]: text(hard) }))?.difficulty).toBe("hard");
    const both = memoryStorage({
      [STORAGE_KEY]: text(laidOut("easy")),
      [LEGACY_STORAGE_KEY]: text(hard),
    });
    expect(loadGame(both)?.difficulty).toBe("easy");
  });

  it("returns null when storage cannot be read", () => {
    const blocked = memoryStorage();
    blocked.getItem = () => {
      throw new Error("blocked");
    };
    expect(loadGame(blocked)).toBeNull();
  });
});
