import { DEFAULT_SIZE, type Clue } from "../model/types";
import { ClueCard } from "./ClueCard";
import { describeClue } from "./clueLayout";

const a = { row: 0, tile: 0 };
const b = { row: 1, tile: 2 };
const c = { row: 4, tile: 5 };

const EXAMPLES: Clue[] = [
  { kind: "same-column", a, b },
  { kind: "different-column", a, b },
  { kind: "adjacent", a, b },
  { kind: "immediately-left-of", left: a, right: b },
  { kind: "left-of", left: a, right: b },
  { kind: "apart", a, b, distance: 3 },
  { kind: "between", middle: b, a, b: c },
  { kind: "next-to-either", a, b, c },
  { kind: "at-an-end", a },
];

export function Legend() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="mb-3 space-y-1.5 text-slate-600">
        <p>
          Left-click a small symbol to place it, right-click to rule it out.
        </p>
        <p>
          Drag clue cards anywhere on the canvas, and click one to grey it out once you have used
          it. Drag a box across empty canvas to select several cards, then drag any of them to move
          the whole group; shift-click adds or removes a single card, and Escape clears the
          selection.
        </p>
        <p>
          Scroll to move around the canvas, ⌘/Ctrl-scroll or the buttons in the corner to zoom, and
          Fit to bring every clue into view.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((clue) => (
          <div key={clue.kind} className="flex items-center gap-3">
            <ClueCard clue={clue} size={DEFAULT_SIZE} used={false} />
            <span className="text-slate-600">{describeClue(clue)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
