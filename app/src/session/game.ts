import { startingBoard, type BoardState } from "../game/board";
import { findFalseCardHints, findHints, type Hint } from "../game/hint";
import { rewindToLastGood, type Snapshot } from "../game/history";
import type { PuzzleLink } from "../game/link";
import {
  accuse,
  addSuspects,
  clearSuspect,
  noSuspects,
  withdrawWrongAccusation,
  type Suspects,
} from "../game/suspects";
import { smallestConflict } from "../model/falseCard";
import { DIFFICULTY_PRESETS, generatePuzzle, type Difficulty } from "../model/generate";
import type { Puzzle } from "../model/types";
import { flipsForPuzzle, layoutCluesByKind, type Point } from "../ui/clueLayout";

/**
 * One game in progress: the puzzle, the player's moves, and how they have
 * arranged the cards. Every change to it is a function here that takes a game
 * and returns the next one, leaving the argument untouched.
 */
export type Game = {
  difficulty: Difficulty;
  puzzle: Puzzle;
  /**
   * Snapshots oldest to newest; the last one is what the player sees. Where the
   * cards lie is not part of a snapshot: arranging the canvas is not a move, and
   * undo moving cards the player had just tidied up would be a nuisance.
   */
  history: Snapshot[];
  positions: Point[];
  /**
   * Which cards are drawn mirrored. Like `positions`, and for the same reason,
   * this is not part of a snapshot: turning a card round is tidying the canvas
   * rather than a move, so undo leaves it alone.
   */
  flipped: boolean[];
  /**
   * Presses of Hint and Go back. Kept off the history, so undoing a move does
   * not take back the help that came before it.
   */
  hintsUsed: number;
  /** The suspects strip of a false-card puzzle. Off the history, like `positions`. */
  suspects: Suspects;
};

export const startSnapshot = (puzzle: Puzzle): Snapshot => ({
  board: startingBoard(puzzle.size, puzzle.exclusions),
  used: puzzle.clues.map(() => false),
});

/**
 * Builds the puzzle a seed produced. A seed returned by `generatePuzzle` is the
 * one its retries settled on, so building from it once, with no clue range to
 * retry for, gives the same puzzle back. Retrying could move past it, when the
 * puzzle was only the closest miss.
 */
export const puzzleFromLink = ({ difficulty, falseCard, size, seed }: PuzzleLink): Puzzle =>
  generatePuzzle({ difficulty, falseCard, size, seed, clueRange: null });

/** A game on `puzzle` with no moves made and the cards not yet laid out. */
export function newGameState(difficulty: Difficulty, puzzle: Puzzle): Game {
  return {
    difficulty,
    puzzle,
    history: [startSnapshot(puzzle)],
    positions: [],
    flipped: flipsForPuzzle(puzzle.clues, puzzle.seed),
    hintsUsed: 0,
    suspects: noSuspects,
  };
}

/** A game on a freshly generated puzzle with a random seed. */
export const startGame = (difficulty: Difficulty, falseCard: boolean): Game =>
  newGameState(difficulty, generatePuzzle({ difficulty, falseCard }));

export const startLinkedGame = (link: PuzzleLink): Game =>
  newGameState(link.difficulty, puzzleFromLink(link));

export const linkOf = (game: Game): PuzzleLink => ({
  difficulty: game.difficulty,
  falseCard: game.puzzle.falseClue !== null,
  size: game.puzzle.size,
  seed: game.puzzle.seed,
});

export const sameLink = (a: PuzzleLink, b: PuzzleLink): boolean =>
  a.difficulty === b.difficulty &&
  a.falseCard === b.falseCard &&
  a.size === b.size &&
  a.seed === b.seed;

/**
 * The game to open with. A puzzle named in the address resumes the saved game
 * when it is the same puzzle, and otherwise starts afresh, replacing the saved
 * one. With no puzzle in the address, the saved game is resumed, or a medium
 * puzzle is started when there is none.
 */
export function resumeOrStart(link: PuzzleLink | null, saved: Game | null): Game {
  if (!link) return saved ?? startGame("medium", false);
  return saved && sameLink(linkOf(saved), link) ? saved : startLinkedGame(link);
}

/** The snapshot the player sees. */
export const currentSnapshot = (game: Game): Snapshot => game.history[game.history.length - 1];

/**
 * Puts `next` on top of the history, carrying over which clues are greyed out.
 * Returns `game` itself when `next` is the board already shown, which is what a
 * move that changed nothing gives back.
 */
export function pushBoard(game: Game, next: BoardState): Game {
  const last = currentSnapshot(game);
  return next === last.board
    ? game
    : { ...game, history: [...game.history, { board: next, used: last.used }] };
}

/** Drops the latest snapshot. The first one, the puzzle's start, always stays. */
export const undo = (game: Game): Game =>
  game.history.length < 2 ? game : { ...game, history: game.history.slice(0, -1) };

export const countHint = (game: Game): Game => ({ ...game, hintsUsed: game.hintsUsed + 1 });

/**
 * Drops every board built on top of the wrong move, and withdraws an
 * accusation of a true card. It tells the player where they went wrong, so it
 * counts as a hint.
 */
export const rewind = (game: Game): Game => ({
  ...game,
  history: rewindToLastGood(game.history, game.puzzle.solution),
  suspects: withdrawWrongAccusation(game.suspects, game.puzzle.falseClue),
  hintsUsed: game.hintsUsed + 1,
});

/**
 * Greying a clue out is a step of the game, so it goes onto the history on top
 * of the board it was decided against. Undo and "Go back" then restore which
 * clues were still in play as well as the grid.
 */
export function toggleUsed(game: Game, index: number): Game {
  const last = currentSnapshot(game);
  const used = last.used.slice();
  used[index] = !used[index];
  return { ...game, history: [...game.history, { board: last.board, used }] };
}

/**
 * Lays the cards out for a canvas `width` wide, unless they already have
 * positions, saved or placed by the player.
 */
export const withLayout = (game: Game, width: number): Game =>
  game.positions.length === game.puzzle.clues.length
    ? game
    : { ...game, positions: layoutCluesByKind(game.puzzle.clues, width) };

export function moveCards(game: Game, moves: Array<{ index: number; point: Point }>): Game {
  const positions = game.positions.slice();
  for (const { index, point } of moves) positions[index] = point;
  return { ...game, positions };
}

/**
 * Turns cards round, which is a change to the canvas rather than to the game,
 * so it stays off the history the way moving a card does.
 */
export function flipCards(game: Game, indices: number[]): Game {
  const flipped = game.flipped.slice();
  for (const index of indices) flipped[index] = !flipped[index];
  return { ...game, flipped };
}

export const suspectCards = (game: Game, indices: number[]): Game => ({
  ...game,
  suspects: addSuspects(game.suspects, indices),
});

/** Takes a card out of the suspects strip and puts it on the canvas at `point`. */
export function unsuspectCard(game: Game, index: number, point: Point): Game {
  const positions = game.positions.slice();
  positions[index] = point;
  return { ...game, positions, suspects: clearSuspect(game.suspects, index) };
}

export const accuseCard = (game: Game, index: number): Game => ({
  ...game,
  suspects: accuse(game.suspects, index),
});

/**
 * The cards of the smallest contradicting group, which Hint holds back until
 * the false card has been accused. The generator kept it within the
 * difficulty's limit, so searching up to that size finds it. Empty for a puzzle
 * without a false card.
 */
export function conflictGroup(puzzle: Puzzle, difficulty: Difficulty): number[] {
  if (puzzle.falseClue === null) return [];
  const limit = DIFFICULTY_PRESETS[difficulty].falseGroup;
  return (
    smallestConflict(puzzle.clues, puzzle.falseClue, puzzle.size, puzzle.exclusions, limit) ?? [
      puzzle.falseClue,
    ]
  );
}

/**
 * Everything Hint could point at next, in the order it offers them. `group` is
 * the puzzle's `conflictGroup`, passed in because finding it is a search.
 */
export function hintsFor(game: Game, group: readonly number[]): Hint[] {
  const { board, used } = currentSnapshot(game);
  const { clues, falseClue } = game.puzzle;
  return falseClue === null
    ? findHints(board, clues, used)
    : findFalseCardHints(board, clues, used, falseClue, group, game.suspects.accused === falseClue);
}
