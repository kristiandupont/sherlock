# Sherlock

A browser version of the deduction puzzle. A 6×6 grid holds six rows of six
symbols; every column contains exactly one symbol from each row. Clues say how
the symbols relate across columns, and the grid is worked out from them alone.

Unlike the original, the clues are not pinned to fixed slots. Every clue is a
card on a freeform canvas: drag it anywhere, put a same-column clue next to the
adjacency clue it interacts with, and click a card to grey it out once it has
been used.

```
npm install
npm run dev      # play at http://localhost:5173
npm test         # solver, generator and board tests
npm run build
```

## How a puzzle is generated

Generation never searches for a clue set. It starts from a set that is known to
work and shrinks it, in `src/model/generate.ts`:

1. Pick a random solution — an independent permutation of tiles per row.
2. Enumerate every clue of every kind that is true for that solution. For a 6×6
   grid that is roughly 2100 clues, which trivially determine the solution.
3. Sample from that pool per kind (`DEFAULT_POOL_CAPS`), then remove clues one
   at a time, keeping each removal only while the puzzle still solves. The
   result is irreducible: no remaining clue can be dropped.

The test used in step 3 is `solveByDeduction` in `src/model/solver.ts`, which is
pure constraint propagation with no guessing. Each tile holds a bitmask of the
columns still open to it, and every clue kind is a rule that narrows those
masks; the two structural rules of the grid are applied alongside them until
nothing changes.

Using a guess-free solver as the acceptance test gives two properties at once.
Every generated puzzle can be solved by deduction alone, and because the rules
only ever eliminate genuinely impossible placements, a complete propagation
solve proves the solution is unique. `countSolutions` implements backtracking
search as an independent check of that claim, and the tests assert the two
agree.

## Difficulty

Minimisation lands on 20–25 clues whatever the settings, so difficulty comes
from which kinds those clues are rather than how many there are. `same-column`
clues are the easiest to act on and `between` clues force the longest chains of
reasoning, so `DIFFICULTY_PRESETS` varies the pool caps and filters on the
resulting clue count:

| preset | clues | `between` share |
| --- | --- | --- |
| easy | 23–28 | ~13% |
| medium | 20–25 | ~20% |
| hard | 17–22 | ~43% |

## Layout

- `src/model/` — types, bit helpers, the solver, and the generator. No React.
- `src/game/board.ts` — the player's grid state. It applies the bookkeeping that
  follows from the shape of the grid, and never reasons from clues.
- `src/ui/` — tile artwork, the board, the clue cards, and the canvas.
- `src/App.tsx` — controls, undo history, and saving to `localStorage`. A saved
  game stores only the seed and difficulty, because a puzzle is reproducible
  from those two values.
