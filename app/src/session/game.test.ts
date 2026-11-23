import { describe, expect, it } from "vitest";
import { hasMistake, removeCandidate } from "../game/board";
import { accuse, addSuspects } from "../game/suspects";
import { generatePuzzle } from "../model/generate";
import {
  conflictGroup,
  currentSnapshot,
  flipCards,
  hintsFor,
  linkOf,
  moveCards,
  newGameState,
  pushBoard,
  resumeOrStart,
  rewind,
  toggleUsed,
  undo,
  withLayout,
  type Game,
} from "./game";

const plainGame = (): Game => newGameState("medium", generatePuzzle({ seed: 1 }));
const falseCardGame = (): Game =>
  newGameState("easy", generatePuzzle({ difficulty: "easy", falseCard: true, seed: 1 }));

/** Rules out the symbol that belongs in the top-left cell, which is always a mistake. */
const wrongMove = (game: Game): Game => {
  const { board } = currentSnapshot(game);
  return pushBoard(game, removeCandidate(board, 0, 0, game.puzzle.solution[0][0]));
};

describe("game moves", () => {
  it("ignores a move that leaves the board as it was", () => {
    const game = plainGame();
    expect(pushBoard(game, currentSnapshot(game).board)).toBe(game);
  });

  it("puts a move on the history, carrying the greyed-out clues over", () => {
    const game = toggleUsed(plainGame(), 0);
    const next = wrongMove(game);
    expect(next.history).toHaveLength(game.history.length + 1);
    expect(currentSnapshot(next).used).toBe(currentSnapshot(game).used);
  });

  it("undoes a greyed-out clue, and never drops the starting snapshot", () => {
    const start = plainGame();
    const greyed = toggleUsed(start, 2);
    expect(currentSnapshot(greyed).used[2]).toBe(true);
    expect(currentSnapshot(undo(greyed)).used[2]).toBe(false);
    expect(undo(start)).toBe(start);
  });

  it("keeps moving and turning cards off the history", () => {
    const game = withLayout(plainGame(), 800);
    const moved = moveCards(game, [{ index: 1, point: { x: 7, y: 9 } }]);
    const flipped = flipCards(moved, [0, 3]);
    expect(flipped.history).toBe(game.history);
    expect(flipped.positions[1]).toEqual({ x: 7, y: 9 });
    expect(flipped.flipped[0]).toBe(!game.flipped[0]);
    expect(flipped.flipped[3]).toBe(!game.flipped[3]);
    expect(game.positions[1]).not.toEqual({ x: 7, y: 9 });
  });

  it("lays the cards out once, and leaves an existing layout alone", () => {
    const laidOut = withLayout(plainGame(), 800);
    expect(laidOut.positions).toHaveLength(laidOut.puzzle.clues.length);
    expect(withLayout(laidOut, 400)).toBe(laidOut);
  });
});

describe("rewind", () => {
  it("drops the wrong move and counts as a hint", () => {
    const game = wrongMove(plainGame());
    expect(hasMistake(currentSnapshot(game).board, game.puzzle.solution)).toBe(true);
    const back = rewind(game);
    expect(back.history).toHaveLength(1);
    expect(back.hintsUsed).toBe(1);
  });

  it("withdraws an accusation of a true card and keeps one of the false card", () => {
    const game = falseCardGame();
    const falseClue = game.puzzle.falseClue!;
    const trueClue = falseClue === 0 ? 1 : 0;
    const suspects = addSuspects(game.suspects, [falseClue, trueClue]);

    const wrong = { ...game, suspects: accuse(suspects, trueClue) };
    expect(rewind(wrong).suspects.accused).toBeNull();

    const right = { ...game, suspects: accuse(suspects, falseClue) };
    expect(rewind(right).suspects.accused).toBe(falseClue);
  });
});

describe("resumeOrStart", () => {
  it("resumes the saved game when the address names no puzzle or the same one", () => {
    const saved = plainGame();
    expect(resumeOrStart(null, saved)).toBe(saved);
    expect(resumeOrStart(linkOf(saved), saved)).toBe(saved);
  });

  it("starts the linked puzzle when it differs from the saved one", () => {
    const saved = plainGame();
    const link = { ...linkOf(saved), seed: saved.puzzle.seed + 1000 };
    const game = resumeOrStart(link, saved);
    expect(linkOf(game)).toEqual(link);
    expect(game.history).toHaveLength(1);
  });

  it("starts a medium puzzle with no false card when there is nothing to resume", () => {
    const game = resumeOrStart(null, null);
    expect(game.difficulty).toBe("medium");
    expect(game.puzzle.falseClue).toBeNull();
  });
});

describe("hints", () => {
  it("has no conflict group without a false card, and one containing it with", () => {
    const plain = plainGame();
    expect(conflictGroup(plain.puzzle, plain.difficulty)).toEqual([]);
    const game = falseCardGame();
    expect(conflictGroup(game.puzzle, game.difficulty)).toContain(game.puzzle.falseClue);
  });

  it("never points at the false card's group before it is accused", () => {
    const game = falseCardGame();
    const group = conflictGroup(game.puzzle, game.difficulty);
    const hints = hintsFor(game, group);
    expect(hints.length).toBeGreaterThan(0);
    for (const hint of hints) if (hint.kind === "clue") expect(group).not.toContain(hint.clueIndex);
  });
});
