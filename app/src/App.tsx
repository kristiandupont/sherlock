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
import { firstBrokenIndex, rewindToLastGood } from "./game/history";
import { generatePuzzle, puzzleStats, type Difficulty } from "./model/generate";
import type { Puzzle } from "./model/types";
import { Board, type InteractionMode } from "./ui/Board";
import { ClueCanvas } from "./ui/ClueCanvas";
import { Confetti } from "./ui/Confetti";
import { Legend } from "./ui/Legend";
import { layoutCluesByKind, type Point } from "./ui/clueLayout";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const STORAGE_KEY = "sherlock:game:v3";

/**
 * A wrong move is not reported straight away — that would amount to a hint on
 * every move. The notice instead begins fading in the moment the grid goes
 * wrong, and takes `NOTICE_FADE_SECONDS` to arrive. It stays imperceptible for
 * the first several of those, so the player learns that something is wrong
 * without learning which move did it.
 *
 * The wait is measured in time rather than in moves, because a player who has
 * gone wrong is often the one who then sits and stares: waiting for moves that
 * never come would leave exactly the wrong person unattended.
 */
const REWIND_HINT = "Return to the last position that had no mistakes";
const NOTICE_FADE_SECONDS = 25;

/** How long a hint's ring stays before it fades out; matches the CSS animation. */
const HINT_VISIBLE_MS = 4500;

type Game = {
  difficulty: Difficulty;
  puzzle: Puzzle;
  /** Board states oldest to newest; the last one is what the player sees. */
  history: BoardState[];
  positions: Point[];
  used: boolean[];
};

type Saved = {
  difficulty: Difficulty;
  seed: number;
  size: number;
  /** Every board of the history, oldest first, so undo and rewind survive a reload. */
  history: Array<{ cells: number[][]; placed: boolean[][] }>;
  positions: Point[];
  used: boolean[];
};

function startGame(difficulty: Difficulty): Game {
  const puzzle = generatePuzzle({ difficulty });
  return {
    difficulty,
    puzzle,
    history: [emptyBoard(puzzle.size)],
    positions: [],
    used: puzzle.clues.map(() => false),
  };
}

/** A puzzle is fully determined by its seed and difficulty, so only those are stored. */
function loadGame(): Game | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    if (!DIFFICULTIES.includes(saved.difficulty)) return null;
    const puzzle = generatePuzzle({ seed: saved.seed, difficulty: saved.difficulty, size: saved.size });
    if (puzzle.seed !== saved.seed || puzzle.clues.length !== saved.used.length) return null;
    if (!Array.isArray(saved.history) || saved.history.length === 0) return null;
    if (saved.history.some((state) => !state?.cells || !state?.placed)) return null;
    return {
      difficulty: saved.difficulty,
      puzzle,
      history: saved.history.map(({ cells, placed }) => ({ size: saved.size, cells, placed })),
      positions: saved.positions,
      used: saved.used,
    };
  } catch {
    return null;
  }
}

export default function App() {
  const [game, setGame] = useState<Game>(() => loadGame() ?? startGame("medium"));
  const [mode, setMode] = useState<InteractionMode>("place");
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
  const [showLegend, setShowLegend] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);

  const board = game.history[game.history.length - 1];
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

  // Held at zero opacity for a frame, then transitioned up.
  useEffect(() => {
    if (!warnWrongTurn) {
      setNoticeVisible(false);
      return;
    }
    const frame = requestAnimationFrame(() => setNoticeVisible(true));
    return () => cancelAnimationFrame(frame);
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
      history: game.history.map(({ cells, placed }) => ({ cells, placed })),
      positions: game.positions,
      used: game.used,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // A full or blocked store just means the game is not resumable.
    }
  }, [game]);

  const pushBoard = useCallback((next: BoardState) => {
    setHint(null);
    setHintCursor(0);
    setGame((current) =>
      next === current.history[current.history.length - 1]
        ? current
        : { ...current, history: [...current.history, next] },
    );
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

  const restart = () => {
    clearNotices();
    setGame((current) => ({ ...current, history: [emptyBoard(current.puzzle.size)] }));
  };

  const newGame = (difficulty: Difficulty) => {
    clearNotices();
    setGame(startGame(difficulty));
  };

  /** Drops every board built on top of the wrong move. */
  const rewind = () => {
    clearNotices();
    setGame((current) => ({
      ...current,
      history: rewindToLastGood(current.history, current.puzzle.solution),
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
      revealNotice();
      return;
    }
    const hints = findHints(board, game.puzzle.clues, game.used);
    if (hints.length === 0) return;
    const pick = hints[hintCursor % hints.length];
    setHintCursor((cursor) => cursor + 1);
    // Cleared first so that ringing the same target twice restarts its animation.
    setHint(null);
    requestAnimationFrame(() => setHint(pick));
  };

  const stopCelebrating = useCallback(() => setCelebrating(false), []);

  const moveClue = useCallback((index: number, point: Point) => {
    setGame((current) => {
      const positions = current.positions.slice();
      positions[index] = point;
      return { ...current, positions };
    });
  }, []);

  const toggleUsed = useCallback((index: number) => {
    setGame((current) => {
      const used = current.used.slice();
      used[index] = !used[index];
      return { ...current, used };
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
        <Button onClick={restart}>Restart</Button>
        <Button onClick={showHint}>Hint</Button>

        <label className="ml-1 flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={mode === "rule-out"}
            onChange={(event) => setMode(event.target.checked ? "rule-out" : "place")}
          />
          Tap to rule out
        </label>

        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
          <span>
            {stats.clueCount} clues · seed {game.puzzle.seed}
          </span>
          <Button onClick={() => setShowLegend((value) => !value)}>
            {showLegend ? "Hide help" : "Help"}
          </Button>
        </div>
      </header>

      {showLegend && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <Legend />
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        <section className="flex w-full shrink-0 flex-col gap-2 lg:w-[520px]">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Board
              board={board}
              mode={mode}
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
              opacity: noticeRevealed || noticeVisible ? 1 : 0,
              visibility: warnWrongTurn ? "visible" : "hidden",
              // No transition while it is hidden, so a grid put right and then
              // broken again starts its fade from zero rather than part-way up.
              transition:
                noticeRevealed || !warnWrongTurn
                  ? "none"
                  : `opacity ${NOTICE_FADE_SECONDS}s linear`,
            }}
            aria-hidden={!warnWrongTurn}
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
            positions={game.positions}
            used={game.used}
            onMove={moveClue}
            onToggleUsed={toggleUsed}
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
