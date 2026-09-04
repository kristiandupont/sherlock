import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  emptyBoard,
  isSolved,
  mistakes,
  placeTile,
  removeCandidate,
  type BoardState,
} from "./game/board";
import { findHints } from "./game/hint";
import { generatePuzzle, puzzleStats, type Difficulty } from "./model/generate";
import type { Puzzle } from "./model/types";
import { Board, type InteractionMode } from "./ui/Board";
import { ClueCanvas } from "./ui/ClueCanvas";
import { Legend } from "./ui/Legend";
import { layoutClues, layoutCluesByKind, type Point } from "./ui/clueLayout";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const STORAGE_KEY = "sherlock:game:v1";

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
  cells: number[][];
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
    return {
      difficulty: saved.difficulty,
      puzzle,
      history: [{ size: saved.size, cells: saved.cells }],
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
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [hint, setHint] = useState<{ clueIndex: number | null; message: string } | null>(null);
  /** Advances on each Hint press so repeats cycle through the other clues. */
  const [hintCursor, setHintCursor] = useState(0);
  const [showLegend, setShowLegend] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);

  const board = game.history[game.history.length - 1];
  const solved = useMemo(() => isSolved(board, game.puzzle.solution), [board, game.puzzle]);
  const stats = useMemo(() => puzzleStats(game.puzzle), [game.puzzle]);

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
        : { ...current, positions: layoutClues(current.puzzle.clues, canvasWidth) },
    );
  }, [canvasWidth, game.puzzle]);

  useEffect(() => {
    if (game.positions.length !== game.puzzle.clues.length) return;
    const saved: Saved = {
      difficulty: game.difficulty,
      seed: game.puzzle.seed,
      size: game.puzzle.size,
      cells: board.cells,
      positions: game.positions,
      used: game.used,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // A full or blocked store just means the game is not resumable.
    }
  }, [game, board]);

  const pushBoard = useCallback((next: BoardState) => {
    setFlagged(new Set());
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
    setFlagged(new Set());
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

  const check = () => {
    setFlagged(new Set(mistakes(board, game.puzzle.solution).map(([r, c]) => `${r}:${c}`)));
  };

  /**
   * Rings a clue that still narrows the grid, and says nothing about what it
   * narrows. Pressing again moves to the next-best clue.
   */
  const showHint = () => {
    const hints = findHints(board, game.puzzle.clues, game.used);
    if (hints.length === 0) {
      setHint({
        clueIndex: null,
        message: solved
          ? "Nothing left to work out."
          : "No clue narrows the grid any further, which means something has been ruled out wrongly. Try Check.",
      });
      return;
    }
    const pick = hints[hintCursor % hints.length];
    setHintCursor((cursor) => cursor + 1);
    setHint({
      clueIndex: pick.clueIndex,
      message:
        hints.length > 1
          ? "This clue still narrows the grid. Press Hint again for a different one."
          : "This clue still narrows the grid.",
    });
  };

  const arrange = (grouped: boolean) =>
    setGame((current) => ({
      ...current,
      positions: (grouped ? layoutCluesByKind : layoutClues)(
        current.puzzle.clues,
        canvasWidth || 800,
      ),
    }));

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
        <Button onClick={check}>Check</Button>
        <Button onClick={showHint}>Hint</Button>

        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Button onClick={() => arrange(false)}>Tidy clues</Button>
        <Button onClick={() => arrange(true)}>Group by type</Button>

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
        <section className="flex shrink-0 flex-col gap-2">
          <div className="w-full max-w-[520px] rounded-lg border border-slate-200 bg-white p-3 lg:w-[520px]">
            <Board
              board={board}
              mode={mode}
              flagged={flagged}
              onPlace={handlePlace}
              onRuleOut={handleRuleOut}
            />
          </div>
          {solved && (
            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Solved. Every column is settled.
            </p>
          )}
          {hint && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {hint.message}
            </p>
          )}
          {flagged.size > 0 && (
            <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {flagged.size} cell{flagged.size === 1 ? "" : "s"} rule out the symbol that belongs
              there.
            </p>
          )}
        </section>

        <section ref={canvasRef} className="min-h-[320px] min-w-0 flex-1">
          <ClueCanvas
            key={game.puzzle.seed}
            clues={game.puzzle.clues}
            positions={game.positions}
            used={game.used}
            onMove={moveClue}
            onToggleUsed={toggleUsed}
            highlight={hint?.clueIndex ?? null}
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
