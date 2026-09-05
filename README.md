# Sherlock

**[Play it here](https://kristiandupont.github.io/sherlock/)**

A browser version of the deduction puzzle. A 6×6 grid holds six rows of six
symbols; every column contains exactly one symbol from each row. Clues say how
the symbols relate across columns, and the grid is worked out from them alone.

Unlike the original, the clues are not pinned to fixed slots. Every clue is a
card on a freeform canvas: drag it anywhere, put a same-column clue next to the
adjacency clue it interacts with, and click a card to grey it out once it has
been used. Cards start grouped by kind and are never rearranged again — where
they end up is the player's business.

The app lives in [`app/`](app):

```
cd app
npm install
npm run dev      # play at http://localhost:5173
npm test         # solver, generator and board tests
npm run build
```

Every push to `main` builds the app and publishes it to GitHub Pages; see
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The workflow
runs the lint and the tests first, so a failing test stops the deployment.

Because a project page is served from `/sherlock/` rather than the domain root,
`app/vite.config.ts` sets Vite's `base` for builds. That value has to match the
repository name.

## How a puzzle is generated

Generation never searches for a clue set. It starts from a set that is known to
work and shrinks it, in `app/src/model/generate.ts`:

1. Pick a random solution — an independent permutation of tiles per row.
2. Enumerate every clue of every kind that is true for that solution. For a 6×6
   grid that is roughly 2100 clues, which trivially determine the solution.
3. Sample from that pool per kind (`DEFAULT_POOL_CAPS`), then remove clues one
   at a time, keeping each removal only while the puzzle still solves. The
   result is irreducible: no remaining clue can be dropped.

The test used in step 3 is `solveByDeduction` in `app/src/model/solver.ts`, which is
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
| ------ | ----- | --------------- |
| easy   | 23–28 | ~13%            |
| medium | 20–25 | ~20%            |
| hard   | 17–22 | ~43%            |

## Hints

A hint points at something the player could work out next, and says nothing
about what it yields. It rings its target for four and a half seconds and then
fades out on its own, so a hint already taken in does not sit on the screen for
the rest of the game. Pressing Hint again moves to the next one.

Candidates are ordered by how obvious they are, in `app/src/game/hint.ts`:

1. A cell with one symbol left in it.
2. A cell that is the last place in its row where some symbol can go.
3. The clues that still narrow the grid.

The first two need no clue at all, which is why they come first. Both ring the
cell without naming a symbol — for the second, working out which symbol has run
out of homes is left to the player.

Clue hints are measured against a baseline of the grid with all its mechanical
consequences worked through. The board leaves placements to the player, so the
grid can be behind on those, and a clue must not be credited with bookkeeping
they simply have not done yet. Ranking then prefers clues that settle a cell
outright over ones that only narrow candidates, and leaves clues the player has
greyed out until last. `findClueHints` calls the same `applyClue` the solver
uses, so a hint cannot disagree with the solver about what a clue means. The
tests solve every generated puzzle by following nothing but its own hints,
claiming cells and working clues through exactly as a player would.

There is no button that checks the grid against the answer. A hint being offered
is no promise that the grid so far is correct — a wrong elimination in one row
leaves the other rows still saying plenty — so the wrong-turn notice below is
what reports a mistake. On a grid that has already gone wrong there is nothing
left to work out, so asking for a hint brings that notice up at once instead of
ringing anything. The player asked for it, so nothing is given away about when
the mistake was made.

## Going back after a wrong move

The player's moves only ever remove candidates, so once a symbol that belongs
somewhere has been ruled out, every later board in the history has that mistake
too. The history is therefore a run of correct boards followed by a run of
broken ones, and `app/src/game/history.ts` finds the boundary. Going back is a
truncation of the history array, which leaves undo working on what remains.

A wrong move is not reported when it happens — that would amount to a hint on
every move. The notice instead starts fading in the moment the grid goes wrong
and takes 25 seconds to arrive, staying imperceptible for the first several of
them. So the player learns that something is wrong without learning which move
did it, and without spending twenty minutes on a grid that cannot be solved.

The wait is measured in time rather than in moves. Waiting for a few further
moves also hides the moment of the mistake, but a player who has gone wrong is
often the one who then sits and stares at the grid, and moves that never come
would leave exactly the wrong person unattended. A later move neither restarts
the fade nor hurries it.

Two things cut the wait short, and both are cases where there is nothing left to
protect the player from. Asking for a hint on a broken grid brings the notice up
instead of ringing anything, since nothing can be worked out. And a grid that is
full but wrong cannot be worked on at all, so the notice appears the moment the
last cell is filled in. Both show it outright rather than shortening the fade:
once a CSS transition is running, changing its duration does not disturb it,
because opacity is already headed for the same value.

The notice element is always in the document; only its opacity and visibility
change. Mounting it on the wrong move resized the left column and moved the clue
canvas, which announced the notice a beat before its text was readable. The
column also carries a fixed width, so no message can stretch it.

The way back is offered only inside that notice, or alongside a Check the player
asked for. A permanently visible "go back" button would be an instant mistake
detector and would defeat the delay.

## Finishing

A correct grid gets confetti, thrown in the six tile colours from two cannons at
the foot of the screen, over `app/src/ui/Confetti.tsx`. It is a plain canvas and
a few dozen lines of physics rather than a dependency, it clears itself away
after three and a half seconds, and it leaves the banner behind so the result is
still there afterwards. Anyone whose system asks for reduced motion gets the
banner alone. Reopening a puzzle that was already finished does not celebrate it
a second time.

## Layout

- `app/src/model/` — types, bit helpers, the solver, and the generator. No React.
- `app/src/game/board.ts` — the player's grid state. A placement takes its
  symbol out of the rest of its row and stops there: the board never reasons
  from clues, and never claims a cell on the player's behalf.
- `app/src/game/hint.ts` — ranks what the player could work out next: cells
  first, then clues.
- `app/src/game/history.ts` — finds the move that broke the grid, and rewinds to
  just before it.
- `app/src/ui/` — tile artwork, the board, the clue cards, the canvas, and the
  confetti.
- `app/src/App.tsx` — controls, undo history, and saving to `localStorage`. A saved
  game stores the seed, the difficulty and every board of the history; the
  puzzle itself is reproducible from the first two, and the history is what
  keeps undo and the rewind working across a reload.
