# Sherlock

**[Play it here](https://kristiandupont.github.io/sherlock/)**

A browser version of the deduction puzzle. A 6×6 grid holds six rows of six
symbols; every column contains exactly one symbol from each row. Clues say how
the symbols relate across columns, and the grid is worked out from them alone.

Unlike the original, the clues are not pinned to fixed slots. Every clue is a
card on a freeform canvas: drag it anywhere, put a same-column clue next to the
adjacency clue it interacts with, and right-click a card to grey it out once it
has been used. Cards start grouped by kind and are never rearranged again — where
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

## The clues

Nine kinds, all of them about which column a tile is in:

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

The `apart` card draws the columns between the pair as empty cells rather than
stating a number, which read as either the count of columns between them or the
step from one to the other. Drawn, it is the `adjacent` card with those columns
filled in, and the two say the same kind of thing. The gap is capped at three:
on a six-column board a distance of five leaves only the two ends, a stronger
statement than the card looks like it is making.

Adding a kind is a variant on the `Clue` union, a case in `applyClue`, an
emitter in `allTrueClues`, a card, a description and a pool cap. The generator
and the minimiser need nothing: they work on whatever `allTrueClues` produces.
The property tests come along too, since they build their pool from the
solution and assert that no rule ever contradicts it or eliminates a placement
the solution uses.

The exhaustive switches mean the compiler names most of the places to update.
The two it cannot are the ones that iterate kinds rather than switch on them:
`allTrueClues`, which would just never emit the new kind, and
`layoutCluesByKind`, which held its own list of kinds and left the four new ones
with no position at all — piled in the corner, unselectable, swallowing clicks
meant for the cards beneath. That list is now derived from `CLUE_KINDS`, and a
test gives the layout one clue of every kind and checks each gets a place.

## Difficulty

Minimisation lands on 20–25 clues whatever the settings, so difficulty comes
from which kinds those clues are rather than how many there are. `same-column`
clues are the easiest to act on and `between` clues force the longest chains of
reasoning, so `DIFFICULTY_PRESETS` varies the pool caps and filters on the
resulting clue count:

| preset | clues | `between` + `next-to-either` share |
| ------ | ----- | --------------------------------- |
| easy   | 23–28 | ~10%                              |
| medium | 20–25 | ~19%                              |
| hard   | 19–22 | ~52%                              |

## The tiles

Six rows: letters, dice, shapes, symbols, things and travel.

The naming matters more than the drawing. A player works a clue out by saying it
to themselves — "A is next to three" — so a tile needs a name that identifies it
on its own. An earlier set had digits, roman numerals *and* dice: three rows
denoting the same six things, so "three" no longer picked out a tile and every
thought about one needed a qualifier. Colour cannot repair that, because nobody
thinks in colour, and colour was what carried the distinction. The roman
numerals were the weakest set on their own terms too — at 18px, IV and VI differ
only in the order of two strokes, and II and III only in width.

So there is one numeric row now, and the rule is that all thirty-six names are
distinct. `app/src/ui/tileSets.test.ts` enforces it, and names the reason.

Within a row the glyph tells tiles apart; across rows the hue does. Those two
channels stay separate, which is why each row is drawn in a single colour. It
also means colour is now only ever a secondary cue: every row differs in kind as
well as in hue, which was not true when three rows were all numbers.

Glyphs are drawn to survive being 18px of solid silhouette in a board cell: bold
outlines, no interior detail. All of it is a lookup table over `{row, tile}`
indices that the model never looks inside, so swapping in other sets is a data
change with no logic behind it.

## The clue canvas

Cards are dragged one at a time, or several together. Dragging across empty
canvas draws a band and selects whatever it crosses; dragging a card that is
part of that selection carries the whole group, and dragging any other card
carries only itself and drops the selection, so what moves is always what was
picked up. Shift-click adds or removes one card, shift-drag adds a band to the
selection, and Escape clears it.

Clicking a card already turns it round, and right-clicking greys it out; both
are worth more than click-to-select, so selection is the band and shift-click
instead. That leaves
dragging empty canvas doing selection rather than panning, so panning is the
scroll it always was, with middle-drag as well.

Zoom is a `scale` transform on the cards, inside a wrapper sized to the scaled
extent. Keeping that wrapper the real size means the browser's own scrolling
still pans, at any zoom, with no scroll handling of ours. What it costs is that
every pointer measurement has to be converted: screen coordinates become canvas
coordinates through the surface's scroll offset and the zoom, and a drag moves a
card by the pointer distance divided by the zoom. Zooming holds one point still
— the pointer for ⌘/Ctrl-scroll, the centre for the buttons — by working out
where that point sits on the canvas and setting the scroll so it lands back
under the cursor, in a layout effect after the new zoom has been laid out.

A card whose meaning does not depend on direction can be turned round with a
click, which mirrors it without changing what it says: the pair on an
`adjacent` card may stand either way, so either drawing is true. Putting the
shared symbol of two clues side by side is what makes it worth doing, because a
chain of clues is followed with the eye. `flipAxis` says which way each kind
turns — `same-column` and `different-column` are stacks and turn top to bottom,
the four symmetric row cards turn left to right, and `left-of`,
`immediately-left-of` and `at-an-end` do not turn at all, so clicking one does
nothing. Clicking used to grey a card out as well as right-clicking; right-click
alone does that now.

Cards also start turned at random, seeded from the puzzle's seed. Without it a
`next-to-either` card always drew its single tile on the left, and every pair
card put the earlier row first, so a row of one kind read as a single shape.
Neither regularity said anything about the solution; the one build order that
would have, the `between` clue's, is already masked in the generator by
`maskBetweenOrder`.

A turn is a change to the canvas rather than a move, so like a card's position
it stays off the undo history and is saved beside the positions. The clue itself
is never rewritten, so the solver, the generator and the hints cannot tell the
difference — only `describeClue` is told, so the tooltip names a pair in the
order the card draws it.

The geometry is in `app/src/ui/clueLayout.ts` rather than in the component:
which cards a band caught, the rectangle a drag spans, how far to zoom to fit.
That part is worth testing on its own, and none of it needs a browser.

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
every move. The notice instead stays completely hidden for 20 seconds after the
grid goes wrong, then fades in over five. An earlier version began the fade at
once and relied on it being too faint to see at first, but any opacity above
zero shows against the page, so a player could tell the moment they went wrong.
So the player learns that something is wrong without learning which move
did it, and without spending twenty minutes on a grid that cannot be solved.

The wait is measured in time rather than in moves. Waiting for a few further
moves also hides the moment of the mistake, but a player who has gone wrong is
often the one who then sits and stares at the grid, and moves that never come
would leave exactly the wrong person unattended. A later move neither restarts
the wait nor hurries it.

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
the foot of the screen, over `app/src/ui/Confetti.tsx`. The cannons sit just
inside the bottom edge and fire three volleys 0.6 seconds apart, so the pieces
are seen leaving the cannon and the volleys run together into one burst. It is a
plain canvas and a few dozen lines of physics rather than a dependency, it
clears itself away after five and a half seconds, and it leaves the banner behind so the result is
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
