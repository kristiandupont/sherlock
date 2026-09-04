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

## Check and Hint

**Check** compares the grid against the stored solution and flags every cell
where the symbol that belongs there has been ruled out. It is an oracle: it
reads the answer rather than reasoning about it.

**Hint** does not. It asks the solver which clues still say something about the
grid as it stands — a clue qualifies when applying it would remove at least one
candidate the player has not removed already — and rings the best one. It never
says what the clue implies, or where. Pressing again moves to the next-best
clue. Ranking prefers clues that settle a cell outright over ones that only
narrow candidates, and leaves clues the player has greyed out until last.

`findHints` in `src/game/hint.ts` calls the same `applyClue` the solver uses, so
a hint cannot disagree with the solver about what a clue means. The tests solve
every generated puzzle by following nothing but its own hints.

Note that a hint being available is no promise that the grid so far is correct:
a wrong elimination in one row leaves clues about the other rows still saying
plenty. Only Check answers that question. Hints run out entirely when no clue
can act at all, which on an unfinished grid does mean something has gone wrong.

## Going back after a wrong move

The player's moves only ever remove candidates, so once a symbol that belongs
somewhere has been ruled out, every later board in the history has that mistake
too. The history is therefore a run of correct boards followed by a run of
broken ones, and `src/game/history.ts` finds the boundary. Going back is a
truncation of the history array, which leaves undo working on what remains.

A wrong move is not reported when it happens — that would amount to a hint on
every move. Instead:

1. The notice waits a random two to four further moves.
2. It then fades in over 18 seconds.

So the player learns that something is wrong without learning which move did it,
and without spending twenty minutes on a grid that cannot be solved.

The notice element is always in the document; only its opacity and visibility
change. Mounting it on the wrong move resized the left column and moved the clue
canvas, which announced the notice a beat before its text was readable. The
column also carries a fixed width, so no message can stretch it.

The way back is offered only inside that notice, or alongside a Check the player
asked for. A permanently visible "go back" button would be an instant mistake
detector and would defeat the delay.

## Layout

- `src/model/` — types, bit helpers, the solver, and the generator. No React.
- `src/game/board.ts` — the player's grid state. It applies the bookkeeping that
  follows from the shape of the grid, and never reasons from clues.
- `src/game/hint.ts` — ranks the clues that still narrow the grid.
- `src/game/history.ts` — finds the move that broke the grid, and rewinds to
  just before it.
- `src/ui/` — tile artwork, the board, the clue cards, and the canvas.
- `src/App.tsx` — controls, undo history, and saving to `localStorage`. A saved
  game stores the seed, the difficulty and every board of the history; the
  puzzle itself is reproducible from the first two, and the history is what
  keeps undo and the rewind working across a reload.
