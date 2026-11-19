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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

export function Legend() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-slate-600">
      <Section title="The puzzle">
        <p className="text-slate-700">
          Sherlock is a deduction puzzle. The grid has six rows, each holding six symbols of one
          kind, and every symbol belongs in exactly one of the six columns. The clues on the canvas
          say how symbols stand in relation to each other — in the same column, next to each other,
          somewhere to the left — and together they pin down the whole grid. Nothing has to be
          guessed: every step can be worked out from the clues and what is already settled.
        </p>
        <p>
          Each cell starts with all six candidates, except that on easy and medium a few are
          already ruled out. Rule out the ones a clue forbids, and place a symbol once you know it
          belongs there. Hint points at something you could work out next,
          and keeps count.
        </p>
      </Section>
      <Section title="The grid">
        <p>Left-click a small symbol to place it, right-click to rule it out.</p>
      </Section>
      <Section title="The clue canvas">
        <p>
          Drag clue cards anywhere on the canvas, and right-click one to grey it out once you have
          used it. Drag a box across empty canvas to select several cards, then drag any of them to
          move the whole group; shift-click adds or removes a single card, and Escape clears the
          selection.
        </p>
        <p>
          Click a card to turn it round. Only cards that say nothing about direction can be
          turned — the pair on an adjacent card may stand either way, so mirroring one changes
          nothing it says, and putting the shared symbol of two clues side by side makes a chain of
          them easier to read.
        </p>
        <p>
          Hold Alt (Option on a Mac) and point at any symbol, on the grid or on a card, to ring
          every clue that mentions it.
        </p>
        <p>
          Scroll to move around the canvas, ⌘/Ctrl-scroll or the buttons in the corner to zoom, and
          Fit to bring every clue into view.
        </p>
      </Section>
      <Section title="False card">
        <p>
          With False card ticked, exactly one card on the canvas is false. Everything else is true,
          including the candidates that start out ruled out, which are marked with a small dot.
        </p>
        <p>
          Look for a few cards that cannot all be true at once. The false card is among them, and
          every card outside that group can be trusted. Then work out which card in the group is
          the false one. It can still be worked out without guessing. Hint never points at a
          single card of that group until you have accused the right one; when nothing else is
          left, it rings the whole group.
        </p>
        <p>
          Drag cards you doubt into the Suspects strip below the canvas, and drag them back out
          once they are cleared. Right-click a suspect to accuse it: an accused card is struck
          through, meaning that what it says is not so. When the grid is solved, the false card is
          marked in red, and accusing the right one earns the full celebration.
        </p>
      </Section>
      <Section title="Reading the clues">
        <div className="grid gap-x-8 gap-y-4 pt-1 sm:grid-cols-2">
          {EXAMPLES.map((clue) => (
            <div key={clue.kind} className="flex items-center gap-3">
              <ClueCard clue={clue} size={DEFAULT_SIZE} used={false} flipped={false} />
              <span>{describeClue(clue)}</span>
            </div>
          ))}
        </div>
      </Section>
      <p className="border-t border-slate-200 pt-3 text-xs text-slate-500">
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
