import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  emptyBoard,
  isComplete,
  isSolved,
  placeTile,
  removeCandidate,
  type BoardState,
} from "./game/board";
import { findHints, type Hint } from "./game/hint";
import { firstBrokenIndex, rewindToLastGood, type Snapshot } from "./game/history";
import { DIFFICULTIES, parsePuzzleHash, puzzleHash, type PuzzleLink } from "./game/link";
import { generatePuzzle, puzzleStats, type Difficulty } from "./model/generate";
import type { Puzzle } from "./model/types";
import { Board } from "./ui/Board";
import { ClueCanvas } from "./ui/ClueCanvas";
import { Confetti } from "./ui/Confetti";
import { HelpDialog } from "./ui/HelpDialog";
import { flipsForPuzzle, layoutCluesByKind, type Point } from "./ui/clueLayout";

const STORAGE_KEY = "sherlock:game:v4";

/**
 * A wrong move is not reported straight away — that would amount to a hint on
 * every move. The notice stays completely hidden for `NOTICE_DELAY_MS` after
 * the grid goes wrong, then fades in over `NOTICE_FADE_SECONDS`. An earlier
 * version started the fade at once and relied on it being too faint to notice
 * at first, but any opacity above zero is visible against the page, so the
 * player could tell the moment they had gone wrong.
 *
 * The wait is measured in time rather than in moves, because a player who has
 * gone wrong is often the one who then sits and stares: waiting for moves that
 * never come would leave exactly the wrong person unattended.
 */
const REWIND_HINT = "Return to the last position that had no mistakes";
const NOTICE_DELAY_MS = 20_000;
const NOTICE_FADE_SECONDS = 5;

/** How long a hint's ring stays before it fades out; matches the CSS animation. */
const HINT_VISIBLE_MS = 4500;

type Game = {
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
};

type Saved = {
  difficulty: Difficulty;
  seed: number;
  size: number;
  /** Every snapshot of the history, oldest first, so undo and rewind survive a reload. */
  history: Array<{ cells: number[][]; placed: boolean[][]; used: boolean[] }>;
  positions: Point[];
  flipped?: boolean[];
  hintsUsed?: number;
};

const startSnapshot = (puzzle: Puzzle): Snapshot => ({
  board: emptyBoard(puzzle.size),
  used: puzzle.clues.map(() => false),
});

/**
 * Builds the puzzle a seed produced. A seed returned by `generatePuzzle` is the
 * one its retries settled on, so building from it once, with no clue range to
 * retry for, gives the same puzzle back. Retrying could move past it, when the
 * puzzle was only the closest miss.
 */
const puzzleFromLink = ({ difficulty, size, seed }: PuzzleLink): Puzzle =>
  generatePuzzle({ difficulty, size, seed, clueRange: null });

function newGameState(difficulty: Difficulty, puzzle: Puzzle): Game {
  return {
    difficulty,
    puzzle,
    history: [startSnapshot(puzzle)],
    positions: [],
    flipped: flipsForPuzzle(puzzle.clues, puzzle.seed),
    hintsUsed: 0,
  };
}

const startGame = (difficulty: Difficulty): Game =>
  newGameState(difficulty, generatePuzzle({ difficulty }));

const startLinkedGame = (link: PuzzleLink): Game =>
  newGameState(link.difficulty, puzzleFromLink(link));

const linkOf = (game: Game): PuzzleLink => ({
  difficulty: game.difficulty,
  size: game.puzzle.size,
  seed: game.puzzle.seed,
});

const sameLink = (a: PuzzleLink, b: PuzzleLink): boolean =>
  a.difficulty === b.difficulty && a.size === b.size && a.seed === b.seed;

/**
 * A puzzle named in the address resumes the saved game when it is the same
 * puzzle, and otherwise starts afresh, replacing the saved one.
 */
function initialGame(): Game {
  const link = parsePuzzleHash(window.location.hash);
  const saved = loadGame();
  if (!link) return saved ?? startGame("medium");
  return saved && sameLink(linkOf(saved), link) ? saved : startLinkedGame(link);
}

/** A puzzle is fully determined by its seed and difficulty, so only those are stored. */
function loadGame(): Game | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    if (!DIFFICULTIES.includes(saved.difficulty)) return null;
    const puzzle = puzzleFromLink(saved);
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
    };
  } catch {
    return null;
  }
}

export default function App() {
  const [game, setGame] = useState<Game>(initialGame);
  const [hint, setHint] = useState<Hint | null>(null);
  /** Advances on each Hint press so repeats move through the rest. */
  const [hintCursor, setHintCursor] = useState(0);
  const [noticeVisible, setNoticeVisible] = useState(false);
  /**
   * Shows the notice outright instead of fading it in. Shortening the fade is
   * not enough: once the transition is running, changing its duration does not
   * disturb it, because opacity is already headed for the same value.
   */
  const [noticeRevealed, setNoticeRevealed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const closeHelp = useCallback(() => setShowHelp(false), []);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);

  const { board, used } = game.history[game.history.length - 1];
  const solved = useMemo(() => isSolved(board, game.puzzle.solution), [board, game.puzzle]);
  const complete = useMemo(() => isComplete(board), [board]);
  const [celebrating, setCelebrating] = useState(false);
  // Starts at the loaded game's state, so reopening a finished puzzle does not
  // celebrate it again.
  const solvedBefore = useRef(solved);
  const stats = useMemo(() => puzzleStats(game.puzzle), [game.puzzle]);
  const brokenIndex = useMemo(
    () => firstBrokenIndex(game.history, game.puzzle.solution),
    [game.history, game.puzzle],
  );
  const warnWrongTurn = brokenIndex >= 0;

  const revealNotice = useCallback(() => setNoticeRevealed(true), []);
  const noticeShown = warnWrongTurn && (noticeRevealed || noticeVisible);

  useEffect(() => {
    if (solved && !solvedBefore.current) setCelebrating(true);
    solvedBefore.current = solved;
  }, [solved]);

  // A grid that is full but wrong cannot be worked on any further, so there is
  // nothing left to protect the player from: the notice comes up at once rather
  // than creeping in over the next few moves.
  useEffect(() => {
    if (!complete || brokenIndex < 0) return;
    revealNotice();
  }, [complete, brokenIndex, revealNotice]);

  // A grid put right again forgets that it was ever revealed.
  useEffect(() => {
    if (brokenIndex < 0) setNoticeRevealed(false);
  }, [brokenIndex]);

  // Starts the fade once the grid has been wrong for `NOTICE_DELAY_MS`. Only a
  // grid put right cancels the timer; further moves on a broken grid neither
  // restart the wait nor shorten it.
  useEffect(() => {
    if (!warnWrongTurn) {
      setNoticeVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setNoticeVisible(true), NOTICE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [warnWrongTurn]);

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(null), HINT_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [hint]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setCanvasWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Lay the clues out as soon as the canvas has a width, and whenever a new
  // puzzle arrives with no saved arrangement.
  useEffect(() => {
    if (canvasWidth <= 0) return;
    setGame((current) =>
      current.positions.length === current.puzzle.clues.length
        ? current
        : { ...current, positions: layoutCluesByKind(current.puzzle.clues, canvasWidth) },
    );
  }, [canvasWidth, game.puzzle]);

  useEffect(() => {
    if (game.positions.length !== game.puzzle.clues.length) return;
    const saved: Saved = {
      difficulty: game.difficulty,
      seed: game.puzzle.seed,
      size: game.puzzle.size,
      history: game.history.map(({ board: { cells, placed }, used }) => ({ cells, placed, used })),
      positions: game.positions,
      flipped: game.flipped,
      hintsUsed: game.hintsUsed,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // A full or blocked store just means the game is not resumable.
    }
  }, [game]);

  // The address always names the puzzle on screen, so it can be copied and
  // shared at any point. Replacing the entry rather than pushing one keeps Back
  // from stepping through every puzzle played.
  const currentHash = puzzleHash(linkOf(game));
  useEffect(() => {
    if (window.location.hash !== currentHash) window.history.replaceState(null, "", currentHash);
  }, [currentHash]);

  // A link pasted into the address bar of an open tab changes only the hash,
  // which does not reload the page.
  useEffect(() => {
    const onHashChange = () => {
      const link = parsePuzzleHash(window.location.hash);
      if (!link) return;
      setGame((current) => (sameLink(linkOf(current), link) ? current : startLinkedGame(link)));
      setHint(null);
      setHintCursor(0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const pushBoard = useCallback((next: BoardState) => {
    setHint(null);
    setHintCursor(0);
    setGame((current) => {
      const last = current.history[current.history.length - 1];
      return next === last.board
        ? current
        : { ...current, history: [...current.history, { board: next, used: last.used }] };
    });
  }, []);

  const handlePlace = (row: number, col: number, tile: number) =>
    pushBoard(placeTile(board, row, col, tile));
  const handleRuleOut = (row: number, col: number, tile: number) =>
    pushBoard(removeCandidate(board, row, col, tile));

  const undo = () =>
    setGame((current) =>
      current.history.length < 2
        ? current
        : { ...current, history: current.history.slice(0, -1) },
    );

  const clearNotices = () => {
    setHint(null);
    setHintCursor(0);
  };

  const countHint = () =>
    setGame((current) => ({ ...current, hintsUsed: current.hintsUsed + 1 }));

  const newGame = (difficulty: Difficulty) => {
    clearNotices();
    setGame(startGame(difficulty));
  };

  /**
   * Drops every board built on top of the wrong move. It tells the player where
   * they went wrong, so it counts as a hint.
   */
  const rewind = () => {
    clearNotices();
    setGame((current) => ({
      ...current,
      history: rewindToLastGood(current.history, current.puzzle.solution),
      hintsUsed: current.hintsUsed + 1,
    }));
  };

  /**
   * Rings whatever the player could work out next — a cell, or a clue — and says
   * nothing about what it yields. The ring fades by itself, and pressing again
   * moves on to the next one.
   *
   * On a broken grid nothing can be worked out, so the wrong-turn notice is
   * brought up at once instead. That is the honest answer to "help me", and the
   * player asked for it, so nothing is given away about when the mistake was
   * made.
   */
  const showHint = () => {
    if (brokenIndex >= 0) {
      countHint();
      revealNotice();
      return;
    }
    const hints = findHints(board, game.puzzle.clues, used);
    // Nothing to show, as on a solved grid, so nothing to count.
    if (hints.length === 0) return;
    countHint();
    const pick = hints[hintCursor % hints.length];
    setHintCursor((cursor) => cursor + 1);
    // Cleared first so that ringing the same target twice restarts its animation.
    setHint(null);
    requestAnimationFrame(() => setHint(pick));
  };

  const stopCelebrating = useCallback(() => setCelebrating(false), []);

  const moveClue = useCallback((moves: Array<{ index: number; point: Point }>) => {
    setGame((current) => {
      const positions = current.positions.slice();
      for (const { index, point } of moves) positions[index] = point;
      return { ...current, positions };
    });
  }, []);

  /**
   * Turns cards round, which is a change to the canvas rather than to the game,
   * so it stays off the history the way moving a card does.
   */
  const flipClues = useCallback((indices: number[]) => {
    setGame((current) => {
      const flipped = current.flipped.slice();
      for (const index of indices) flipped[index] = !flipped[index];
      return { ...current, flipped };
    });
  }, []);

  /**
   * Greying a clue out is a step of the game, so it goes onto the history on top
   * of the board it was decided against. Undo and "Go back" then restore which
   * clues were still in play as well as the grid.
   */
  const toggleUsed = useCallback((index: number) => {
    setGame((current) => {
      const last = current.history[current.history.length - 1];
      const used = last.used.slice();
      used[index] = !used[index];
      return { ...current, history: [...current.history, { board: last.board, used }] };
    });
  }, []);

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-800">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <h1 className="mr-2 text-lg font-semibold tracking-tight">Sherlock</h1>

        <select
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          value={game.difficulty}
          onChange={(event) => newGame(event.target.value as Difficulty)}
        >
          {DIFFICULTIES.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {difficulty}
            </option>
          ))}
        </select>

        <Button onClick={() => newGame(game.difficulty)}>New puzzle</Button>
        <Button onClick={undo} disabled={game.history.length < 2}>
          Undo
        </Button>
        <Button
          onClick={showHint}
          title={`Hints used on this puzzle, Go back included: ${game.hintsUsed}`}
        >
          Hint
          {game.hintsUsed > 0 && (
            <span data-hints-used className="ml-1.5 tabular-nums text-amber-700">
              ×{game.hintsUsed}
            </span>
          )}
        </Button>

        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
          <span>
            {stats.clueCount} clues · seed {game.puzzle.seed}
          </span>
          <Button onClick={() => setShowHelp(true)}>Help</Button>
        </div>
      </header>

      <HelpDialog open={showHelp} onClose={closeHelp} />

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        <section className="flex w-full shrink-0 flex-col gap-2 lg:w-[520px]">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Board
              board={board}
              highlight={hint?.kind === "cell" ? hint : null}
              onPlace={handlePlace}
              onRuleOut={handleRuleOut}
            />
          </div>
          {solved && (
            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Solved. Every column is settled.
            </p>
          )}
          {celebrating && <Confetti onDone={stopCelebrating} />}

          {/*
            The notice is always in the document and only its opacity changes.
            Mounting it on the wrong move would resize the column and announce
            itself a beat before the text became readable.
          */}
          <div
            className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            style={{
              opacity: noticeShown ? 1 : 0,
              // Hidden rather than only transparent during the wait, so its
              // Go back button cannot be clicked before it can be seen.
              visibility: noticeShown ? "visible" : "hidden",
              // No transition on the way out, so a grid put right and then
              // broken again starts its fade from zero rather than part-way up.
              transition:
                noticeRevealed || !noticeShown ? "none" : `opacity ${NOTICE_FADE_SECONDS}s linear`,
            }}
            aria-hidden={!noticeShown}
          >
            <span>Something in this grid has gone wrong.</span>
            <Button onClick={rewind} title={REWIND_HINT}>
              Go back
            </Button>
          </div>
        </section>

        <section ref={canvasRef} className="min-h-[320px] min-w-0 flex-1">
          <ClueCanvas
            key={game.puzzle.seed}
            clues={game.puzzle.clues}
            size={game.puzzle.size}
            positions={game.positions}
            used={used}
            flipped={game.flipped}
            onMove={moveClue}
            onToggleUsed={toggleUsed}
            onFlip={flipClues}
            highlight={hint?.kind === "clue" ? hint.clueIndex : null}
          />
        </section>
      </main>
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
