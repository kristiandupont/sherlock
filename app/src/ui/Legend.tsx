import type { Clue } from "../model/types";
import { ClueCard } from "./ClueCard";
import { describeClue } from "./clueLayout";

const a = { row: 0, tile: 0 };
const b = { row: 1, tile: 2 };
const c = { row: 4, tile: 5 };

const EXAMPLES: Clue[] = [
  { kind: "same-column", a, b },
  { kind: "different-column", a, b },
  { kind: "adjacent", a, b },
  { kind: "left-of", left: a, right: b },
  { kind: "between", middle: b, a, b: c },
];

export function Legend() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <p className="mb-3 text-slate-600">
        Left-click a small symbol to place it, right-click to rule it out. Drag clue cards anywhere
        on the board to the right; click a card to grey it out once you have used it.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((clue) => (
          <div key={clue.kind} className="flex items-center gap-3">
            <ClueCard clue={clue} used={false} />
            <span className="text-slate-600">{describeClue(clue)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
