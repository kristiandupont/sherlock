import { DIFFICULTIES } from "../game/link";
import type { Difficulty } from "../model/generate";
import { Button } from "./Button";

type Props = {
  difficulty: Difficulty;
  falseCard: boolean;
  /** Starts a new puzzle; the difficulty select and the false-card box both call it. */
  onNewGame: (difficulty: Difficulty, falseCard: boolean) => void;
  canUndo: boolean;
  onUndo: () => void;
  onHint: () => void;
  hintsUsed: number;
  clueCount: number;
  seed: number;
  onHelp: () => void;
};

export function Toolbar({
  difficulty,
  falseCard,
  onNewGame,
  canUndo,
  onUndo,
  onHint,
  hintsUsed,
  clueCount,
  seed,
  onHelp,
}: Props) {
  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
      <h1 className="mr-2 text-lg font-semibold tracking-tight">Sherlock</h1>

      <select
        className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
        value={difficulty}
        onChange={(event) => onNewGame(event.target.value as Difficulty, falseCard)}
      >
        {DIFFICULTIES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <label
        className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
        title="One card is false. Find it, and solve the grid from the rest."
      >
        <input
          type="checkbox"
          checked={falseCard}
          onChange={(event) => onNewGame(difficulty, event.target.checked)}
        />
        False card
      </label>

      <Button onClick={() => onNewGame(difficulty, falseCard)}>New puzzle</Button>
      <Button onClick={onUndo} disabled={!canUndo}>
        Undo
      </Button>
      <Button onClick={onHint} title={`Hints used on this puzzle, Go back included: ${hintsUsed}`}>
        Hint
        {hintsUsed > 0 && (
          <span data-hints-used className="ml-1.5 tabular-nums text-amber-700">
            ×{hintsUsed}
          </span>
        )}
      </Button>

      <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
        <span>
          {clueCount} clues{falseCard ? ", one false" : ""} · seed {seed}
        </span>
        <Button onClick={onHelp}>Help</Button>
      </div>
    </header>
  );
}
