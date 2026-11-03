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
        <p className="text-slate-700">
          Sherlock is a deduction puzzle. The grid has six rows, each holding six symbols of one
          kind, and every symbol belongs in exactly one of the six columns. The clues on the canvas
          say how symbols stand in relation to each other — in the same column, next to each other,
          somewhere to the left — and together they pin down the whole grid. Nothing has to be
          guessed: every step can be worked out from the clues and what is already settled.
        </p>
        <p>
          Each cell starts with all six candidates. Rule out the ones a clue forbids, and place a
          symbol once you know it belongs there. Hint points at something you could work out next,
          and keeps count.
        </p>
        <p>
          Left-click a small symbol to place it, right-click to rule it out.
        </p>
        <p>
          Drag clue cards anywhere on the canvas, and right-click one to grey it out once you have
          used it. Drag a box across empty canvas to select several cards, then drag any of them to move
          the whole group; shift-click adds or removes a single card, and Escape clears the
          selection.
        </p>
        <p>
          Click a card to turn it round. Only cards that say nothing about direction can be
          turned — the pair on an adjacent card may stand either way, so mirroring one changes
          nothing it says, and putting the shared symbol of two clues side by side makes a chain of
          them easier to read.
        </p>
        <p>
          Scroll to move around the canvas, ⌘/Ctrl-scroll or the buttons in the corner to zoom, and
          Fit to bring every clue into view.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((clue) => (
          <div key={clue.kind} className="flex items-center gap-3">
            <ClueCard clue={clue} size={DEFAULT_SIZE} used={false} flipped={false} />
            <span className="text-slate-600">{describeClue(clue)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">
        Based on{" "}
        <a
          className="text-indigo-700 underline hover:text-indigo-900"
          href="https://www.kaser.com/sherwin.html"
          target="_blank"
          rel="noreferrer"
        >
          Sherlock by Everett Kaser
        </a>
        , the original game this one follows.
      </p>
    </div>
  );
}
