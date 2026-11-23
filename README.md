# Sherlock

**[Play it here](https://kristiandupont.github.io/sherlock/)**

A browser version of the deduction puzzle. A 6×6 grid holds six rows of six
symbols; every column contains exactly one symbol from each row. Clues say how
the symbols relate across columns, and the grid is worked out from them alone.

Unlike the original, the clues are not pinned to fixed slots. Every clue is a
card on a freeform canvas that the player arranges as they like.

The app is in [`app/`](app):

```
cd app
npm install
npm run dev      # play at http://localhost:5173
npm test         # solver, generator and board tests
npm run build
```

Every push to `main` runs the lint and the tests and then publishes the build to
GitHub Pages ([`deploy.yml`](.github/workflows/deploy.yml)). The site is served
from `/sherlock/`, so Vite's `base` in `app/vite.config.ts` has to match the
repository name.

## Layout

- `app/src/model/` — types, bit helpers, the solver and the generator. No React.
- `app/src/game/` — the player's board, hints, the history used by Go back,
  puzzle links, and the Alt highlight.
- `app/src/ui/` — tile artwork, the board, the clue cards and canvas, confetti.
- `app/src/App.tsx` — controls, undo history, and saving to `localStorage`. A
  save stores the difficulty, the seed and every board of the history; the
  puzzle is rebuilt from the seed.

## How a puzzle is generated

Generation never searches for a clue set. It starts from one that is known to
work and shrinks it, in `app/src/model/generate.ts`:

1. Pick a random solution: an independent permutation of tiles per row.
2. Enumerate every clue that is true for that solution (about 2100 on a 6×6
   grid).
3. Sample from that pool per kind (the difficulty's pool caps), then remove
   clues one at a time, keeping each removal only while the puzzle still
   solves. The result is irreducible: no remaining clue can be dropped.

The test in step 3 is `solveByDeduction` in `app/src/model/solver.ts`: pure
constraint propagation, with no guessing. Each tile holds a bitmask of the
columns still open to it, and each clue kind is a rule that narrows those masks,
applied together with the two structural rules of the grid until nothing
changes. Because the rules only remove placements that are impossible, a
complete solve proves the solution is unique, and every puzzle can be solved by
deduction alone. `countSolutions` checks this independently with backtracking,
and the tests assert that the two agree.

A puzzle link (`#hard-6x6-1834562211`, or `#hard-falsecard-6x6-…` for a
false-card puzzle) names the generator's input, so it stays
valid only as long as the generator builds the same puzzle from the same seed.

## The clues

Nine kinds, all about which column a tile is in:

| kind | says |
| --- | --- |
| `same-column` | two tiles share a column |
| `different-column` | two tiles never share a column |
| `at-an-end` | a tile is in the first or the last column |
| `adjacent` | two tiles are in neighbouring columns, either way round |
| `immediately-left-of` | one tile is in the column directly before another |
| `apart` | a given number of columns stand between two tiles, either way round |
| `left-of` | one tile is somewhere left of another |
| `between` | a tile is directly between two others, which may be either way round |
| `next-to-either` | a tile neighbours one of a named pair, or both |

The `apart` card draws the columns between the pair as empty cells, because a
number could be read either as the count of columns between them or as the
distance. The gap is capped at three.

Adding a kind means a variant on the `Clue` union, a case in `applyClue`, an
emitter in `allTrueClues`, a card, a description and a pool cap. The compiler
reports most of the places through exhaustive switches; `allTrueClues` is the
one it cannot, since a kind it never emits is simply absent. The generator, the
minimiser and the property tests need no changes.

## Difficulty

Minimisation ends at roughly 20–25 clues whatever the settings, so difficulty
comes from which kinds those clues are. `same-column` clues are the easiest to
act on and `between` clues need the longest chains of reasoning.
`DIFFICULTY_PRESETS` sets the pool caps, the accepted clue count and the number
of exclusions offered:

| preset | clues | exclusions | `between` + `next-to-either` share |
| ------ | ----- | ---------- | --------------------------------- |
| easy   | 21–26 | ~6 (1–11)  | ~11%                              |
| medium | 19–24 | ~3 (1–6)   | ~19%                              |
| hard   | 17–22 | none       | ~51%                              |

An exclusion is a candidate ruled out on the grid before play starts. The
generator draws `exclusionPool` wrong candidates, minimises the clues with all
of them in place, and then drops every exclusion the clues can do without, so
each one shown is needed. Removing information never lets propagation reach
further, so the clues stay irreducible. About a third of the exclusions offered
survive, and each replaces about half a clue. Hard draws none, and so builds
the same puzzles it did before exclusions existed.

## False card

An optional mode, in `app/src/model/falseCard.ts`: exactly one card is false,
and the player is told so. The exclusions stay true and are drawn as dots, so
they can be told apart from the player's own eliminations.

The generator builds a normal minimal puzzle, then adds a false card taken
from a near miss of the solution (two tiles of one row swapped), so it looks
like the rest. It accepts the puzzle only if it is fair (`falseCardIsFair`):

- without the false card, the other cards solve the grid;
- some group of at most `falseGroup` cards cannot all be true (2 on easy, 3 on
  medium, 4 on hard); and
- for every smallest such group, trusting the cards outside it and propagating
  gives a grid that the false card contradicts on its own.

Every contradicting group contains the false card, since the true cards all
hold for the solution, so finding one clears every card outside it. The third
condition is what lets the player settle which card in the group is false
without supposing anything: they work the grid with the trusted cards, then hold
each suspect up against it, and only the false one does not fit. An earlier
version only required that supposing any other card false would eventually lead
to a contradiction, which in practice could mean playing most of the puzzle
under that supposition. Where the trusted cards do not narrow the grid enough,
true cards are added from the pool, and the result is minimised again under the
same condition.

The group search is exhaustive and is most of the cost: generation takes about
0.15–0.5 s on average (hard is the slowest, up to about 1.7 s), compared with a
few milliseconds for a normal puzzle. It runs on the main thread, so the page
pauses while a false-card puzzle is built.

Below the canvas, a Suspects strip holds the cards the player doubts. Cards are
dragged in and out of it, and right-clicking one there accuses it (one at a
time). An accused card is struck through, since a false card means its opposite
is true. When the grid is solved the accusation is judged: the full confetti
needs the right card accused, and anything else costs as much as one hint. The
strip and the accusation are saved but are not part of the undo history, like
card positions (`app/src/game/suspects.ts`).

The solver treats the false card as saying nothing. A player who reads "false"
as "its opposite is true" knows more than that, so nothing the solver relies on
is out of their reach. Until the false card has been accused, hints leave out
every card of the smallest contradicting group, since with two suspects left,
pointing at one names the other; when only those cards are left to work with,
the hint rings the group together (`findFalseCardHints`). The false card is
marked once the grid is solved. These puzzles have about 24 cards whatever the
difficulty, so the clue-count range is not applied.

## The tiles

Six rows: letters, dice, shapes, symbols, things and travel. All thirty-six
names are distinct, because a player works through a clue by saying it to
themselves ("A is next to three"), and a name has to identify its tile without a
qualifier. An earlier set had digits, roman numerals and dice, so "three" named
three tiles. `app/src/ui/tileSets.test.ts` enforces the rule.

Within a row the glyph tells tiles apart, and across rows the hue does, so each
row is drawn in a single colour. Colour is only ever a secondary cue. Glyphs are
bold silhouettes without interior detail, so they stay legible at 18px.

## The clue canvas

- **Moving:** drag a card, or drag across empty canvas to select several and
  drag any of them to move the group. Shift-click adds or removes one card, and
  Escape clears the selection. Scrolling and middle-drag pan; ⌘/Ctrl-scroll and
  the buttons zoom.
- **Turning:** clicking a card whose meaning does not depend on direction
  mirrors it, so that the shared symbol of two clues can be placed side by side.
  `flipAxis` says which way each kind turns, if at all. Cards start turned at
  random, seeded from the puzzle, so that the drawing order says nothing about
  the solution.
- **Greying out:** right-click a card once it has been used.
- **Alt highlight:** holding Alt (Option on a Mac) while pointing at a symbol,
  on the grid or on a card, rings every card that mentions it. It is not counted
  as a hint.

Positions and turns are tidying rather than moves, so they are saved but are not
part of the undo history. The geometry (band selection, drag bounds, zoom to
fit) is in `app/src/ui/clueLayout.ts` and is tested without a browser.

## Hints

A hint rings something the player could work out next, without saying what it
yields, and the ring fades after four and a half seconds. Pressing Hint again
moves to the next one. `app/src/game/hint.ts` orders them:

1. A cell with one symbol left in it.
2. A cell that is the last place in its row for some symbol.
3. The clues that still narrow the grid, preferring ones that settle a cell, and
   leaving greyed-out cards until last.

Clue hints are measured against the grid with its mechanical consequences
already applied, so a clue is not credited with bookkeeping the player has not
done. They use the same `applyClue` as the solver. The tests solve every
generated puzzle by following nothing but its own hints.

## Going back after a wrong move

Moves only ever remove candidates, so once a correct symbol has been ruled out,
every later board in the history has that mistake too. `app/src/game/history.ts`
finds the first broken board, and Go back truncates the history to the board
before it.

A wrong move is not reported when it is made, because that would be a hint on
every move. The notice stays hidden for 20 seconds after the grid goes wrong and
then fades in over five, so the player learns that something is wrong without
learning which move it was. The wait is measured in time rather than moves,
since a player who has gone wrong often stops making moves. Asking for a hint on
a broken grid, or filling the last cell of a wrong grid, shows the notice at
once. Go back is only offered inside the notice; a button that was always
visible would report mistakes immediately.

## Finishing

A correct grid gets confetti in the six tile colours (`app/src/ui/Confetti.tsx`).
The fewer hints used, Go back included, the more volleys are fired
(`app/src/ui/celebration.ts`). Positions are computed from the time since each
piece was fired, so the result is the same at any frame rate. It is a canvas
with no dependency, it is skipped when the system asks for reduced motion, and a
puzzle that was already finished is not celebrated again when it is reopened.
