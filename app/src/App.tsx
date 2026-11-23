import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isComplete, isSolved, placeTile, removeCandidate, type BoardState } from "./game/board";
import type { Hint } from "./game/hint";
import { firstBrokenIndex } from "./game/history";
import { parsePuzzleHash, puzzleHash } from "./game/link";
import { cluesMentioning } from "./game/peek";
import { isWrongAccusation, verdict } from "./game/suspects";
import { puzzleStats, type Difficulty } from "./model/generate";
import {
  accuseCard,
  conflictGroup,
  countHint,
  currentSnapshot,
  flipCards,
  hintsFor,
  linkOf,
  moveCards,
  pushBoard,
  resumeOrStart,
  rewind,
  sameLink,
  startGame,
  startLinkedGame,
  suspectCards,
  toggleUsed,
  undo,
  unsuspectCard,
  withLayout,
  type Game,
} from "./session/game";
import { loadGame, storeGame } from "./session/save";
import { Board } from "./ui/Board";
import { ClueCanvas } from "./ui/ClueCanvas";
import { Confetti } from "./ui/Confetti";
import { HelpDialog } from "./ui/HelpDialog";
import { Toolbar } from "./ui/Toolbar";
import { WrongTurnNotice } from "./ui/WrongTurnNotice";
import type { Point } from "./ui/clueLayout";
import { usePeek } from "./ui/usePeek";
import { useWrongTurnNotice } from "./ui/useWrongTurnNotice";

/** A stable empty list, so the canvas does not see a new highlight on every render. */
const NO_CARDS: readonly number[] = [];

/** How long a hint's ring stays before it fades out; matches the CSS animation. */
const HINT_VISIBLE_MS = 4500;

const initialGame = (): Game => resumeOrStart(parsePuzzleHash(window.location.hash), loadGame());

export default function App() {
  const [game, setGame] = useState<Game>(initialGame);
  const [hint, setHint] = useState<Hint | null>(null);
  /** Advances on each Hint press so repeats move through the rest. */
  const [hintCursor, setHintCursor] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const closeHelp = useCallback(() => setShowHelp(false), []);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);

  const { puzzle, difficulty } = game;
  const { board, used } = currentSnapshot(game);
  const falseCard = puzzle.falseClue !== null;
  const { peekTile, hoverTile } = usePeek();
  const peeked = useMemo(
    () => new Set(peekTile ? cluesMentioning(puzzle.clues, peekTile) : []),
    [puzzle.clues, peekTile],
  );
  const solved = useMemo(() => isSolved(board, puzzle.solution), [board, puzzle]);
  const complete = useMemo(() => isComplete(board), [board]);
  const [celebrating, setCelebrating] = useState(false);
  // Starts at the loaded game's state, so reopening a finished puzzle does not
  // celebrate it again.
  const solvedBefore = useRef(solved);
  const stats = useMemo(() => puzzleStats(puzzle), [puzzle]);
  const brokenIndex = useMemo(
    () => firstBrokenIndex(game.history, puzzle.solution),
    [game.history, puzzle],
  );
  const group = useMemo(() => conflictGroup(puzzle, difficulty), [puzzle, difficulty]);
  // Accusing a true card is a mistake in the same way as ruling out a symbol
  // that belongs, so it brings up the same notice, after the same wait.
  const wrongTurn = brokenIndex >= 0 || isWrongAccusation(game.suspects, puzzle.falseClue);
  // A grid that is full but wrong cannot be worked on any further, so there is
  // nothing left to protect the player from: the notice comes up at once rather
  // than after the wait.
  const notice = useWrongTurnNotice(wrongTurn, complete && brokenIndex >= 0);

  useEffect(() => {
    if (solved && !solvedBefore.current) setCelebrating(true);
    solvedBefore.current = solved;
  }, [solved]);

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(null), HINT_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [hint]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setCanvasWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Lay the clues out as soon as the canvas has a width, and whenever a new
  // puzzle arrives with no saved arrangement.
  useEffect(() => {
    if (canvasWidth <= 0) return;
    setGame((current) => withLayout(current, canvasWidth));
  }, [canvasWidth, game.puzzle]);

  useEffect(() => storeGame(game), [game]);

  // The address always names the puzzle on screen, so it can be copied and
  // shared at any point. Replacing the entry rather than pushing one keeps Back
  // from stepping through every puzzle played.
  const currentHash = puzzleHash(linkOf(game));
  useEffect(() => {
    if (window.location.hash !== currentHash) window.history.replaceState(null, "", currentHash);
  }, [currentHash]);

  // A link pasted into the address bar of an open tab changes only the hash,
  // which does not reload the page.
  useEffect(() => {
    const onHashChange = () => {
      const link = parsePuzzleHash(window.location.hash);
      if (!link) return;
      setGame((current) => (sameLink(linkOf(current), link) ? current : startLinkedGame(link)));
      setHint(null);
      setHintCursor(0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const clearNotices = () => {
    setHint(null);
    setHintCursor(0);
  };

  const playBoard = (next: BoardState) => {
    clearNotices();
    setGame((current) => pushBoard(current, next));
  };

  const handlePlace = (row: number, col: number, tile: number) =>
    playBoard(placeTile(board, row, col, tile));
  const handleRuleOut = (row: number, col: number, tile: number) =>
    playBoard(removeCandidate(board, row, col, tile));

  const newGame = (difficulty: Difficulty, falseCard: boolean) => {
    clearNotices();
    setGame(startGame(difficulty, falseCard));
  };

  const goBack = () => {
    clearNotices();
    setGame(rewind);
  };

  /**
   * Rings whatever the player could work out next — a cell, or a clue — and says
   * nothing about what it yields. The ring fades by itself, and pressing again
   * moves on to the next one.
   *
   * On a broken grid nothing can be worked out, so the wrong-turn notice is
   * brought up at once instead. The same goes for a wrong accusation: the grid
   * may still have things to work out, but what the player most needs to know
   * is that they have gone wrong. That is the honest answer to "help me", and the
   * player asked for it, so nothing is given away about when the mistake was
   * made.
   */
  const showHint = () => {
    if (wrongTurn) {
      setGame(countHint);
      notice.reveal();
      return;
    }
    const hints = hintsFor(game, group);
    // Nothing to show, as on a solved grid, so nothing to count.
    if (hints.length === 0) return;
    setGame(countHint);
    const pick = hints[hintCursor % hints.length];
    setHintCursor((cursor) => cursor + 1);
    // Cleared first so that ringing the same target twice restarts its animation.
    setHint(null);
    requestAnimationFrame(() => setHint(pick));
  };

  const stopCelebrating = useCallback(() => setCelebrating(false), []);

  const suspectClues = useCallback(
    (indices: number[]) => setGame((current) => suspectCards(current, indices)),
    [],
  );
  const clearSuspectClue = useCallback(
    (index: number, point: Point) => setGame((current) => unsuspectCard(current, index, point)),
    [],
  );
  const accuseClue = useCallback(
    (index: number) => setGame((current) => accuseCard(current, index)),
    [],
  );
  const moveClue = useCallback(
    (moves: Array<{ index: number; point: Point }>) =>
      setGame((current) => moveCards(current, moves)),
    [],
  );
  const flipClues = useCallback(
    (indices: number[]) => setGame((current) => flipCards(current, indices)),
    [],
  );
  const toggleUsedClue = useCallback(
    (index: number) => setGame((current) => toggleUsed(current, index)),
    [],
  );

  const outcome = puzzle.falseClue === null ? null : verdict(game.suspects, puzzle.falseClue);

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-800">
      <Toolbar
        difficulty={difficulty}
        falseCard={falseCard}
        onNewGame={newGame}
        canUndo={game.history.length >= 2}
        onUndo={() => setGame(undo)}
        onHint={showHint}
        hintsUsed={game.hintsUsed}
        clueCount={stats.clueCount}
        seed={puzzle.seed}
        onHelp={() => setShowHelp(true)}
      />

      <HelpDialog open={showHelp} onClose={closeHelp} />

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        <section className="flex w-full shrink-0 flex-col gap-2 lg:w-[520px]">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Board
              board={board}
              highlight={hint?.kind === "cell" ? hint : null}
              markedExclusions={falseCard ? puzzle.exclusions : []}
              onPlace={handlePlace}
              onRuleOut={handleRuleOut}
              onHoverTile={hoverTile}
            />
          </div>
          {solved && (
            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Solved. Every column is settled.
              {outcome === "found" && " And you found the false card."}
              {outcome === "none" && " The false card is marked in red."}
              {outcome === "wrong" &&
                " The card you accused was true; the false one is marked in red."}
            </p>
          )}
          {celebrating && (
            // In a false-card puzzle, the full celebration is for accusing the
            // right card; not doing so costs as much as one hint.
            <Confetti
              hintsUsed={game.hintsUsed + (outcome === null || outcome === "found" ? 0 : 1)}
              onDone={stopCelebrating}
            />
          )}

          <WrongTurnNotice shown={notice.shown} revealed={notice.revealed} onRewind={goBack} />
        </section>

        <section ref={canvasRef} className="min-h-[320px] min-w-0 flex-1">
          <ClueCanvas
            key={puzzle.seed}
            clues={puzzle.clues}
            size={puzzle.size}
            positions={game.positions}
            used={used}
            flipped={game.flipped}
            onMove={moveClue}
            onToggleUsed={toggleUsedClue}
            onFlip={flipClues}
            suspects={falseCard ? game.suspects : null}
            onSuspect={suspectClues}
            onClearSuspect={clearSuspectClue}
            onAccuse={accuseClue}
            highlight={
              hint?.kind === "clue"
                ? [hint.clueIndex]
                : hint?.kind === "group"
                  ? hint.clueIndices
                  : NO_CARDS
            }
            revealedFalse={solved ? puzzle.falseClue : null}
            peeked={peeked}
            onHoverTile={hoverTile}
          />
        </section>
      </main>
    </div>
  );
}
