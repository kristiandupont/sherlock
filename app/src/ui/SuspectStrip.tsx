import { useState, type RefObject } from "react";
import type { Suspects } from "../game/suspects";
import type { Clue, TileRef } from "../model/types";
import { CardOverlays } from "./CardOverlays";
import { ClueCard } from "./ClueCard";
import { cardFrame, LIFTED_SHADOW } from "./cardStyle";
import { flippable, type Point } from "./clueLayout";
import { HoverTileContext } from "./hoverTile";
import { isOver, pastThreshold, releaseCapture } from "./pointer";

/** A card being dragged out of the suspects strip. */
type StripDrag = {
  index: number;
  pointerStart: Point;
  pointer: Point;
  /** Where in the card the pointer took hold, in screen pixels from its top-left corner. */
  grab: Point;
  moved: boolean;
};

type Props = {
  suspects: Suspects;
  clues: Clue[];
  size: number;
  used: boolean[];
  flipped: boolean[];
  highlight: readonly number[];
  peeked: ReadonlySet<number>;
  revealedFalse: number | null;
  /** Height of the strip, in screen pixels. */
  height: number;
  /** Whether cards dragged on the canvas are over the strip, which colours its border. */
  dropTarget: boolean;
  /** The strip's element, which the canvas reads to tell when cards are dragged over it. */
  containerRef: RefObject<HTMLDivElement>;
  onHoverTile: (tile: TileRef | null) => void;
  /** Accuses a card in the strip, or withdraws the accusation; right-click asks for it. */
  onAccuse: (index: number) => void;
  onFlip: (indices: number[]) => void;
  /**
   * The canvas position for a card let go at the screen point `pointer`, held
   * at `grab` from its corner. Null when `pointer` is not over the canvas.
   */
  dropPoint: (pointer: Point, grab: Point) => Point | null;
  /** Moves a card from the strip back onto the canvas, at `point`. */
  onClearSuspect: (index: number, point: Point) => void;
};

/** The suspects strip of a false-card puzzle, along the bottom of the canvas. */
export function SuspectStrip({
  suspects,
  clues,
  size,
  used,
  flipped,
  highlight,
  peeked,
  revealedFalse,
  height,
  dropTarget,
  containerRef,
  onHoverTile,
  onAccuse,
  onFlip,
  dropPoint,
  onClearSuspect,
}: Props) {
  const [drag, setDrag] = useState<StripDrag | null>(null);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const at = { x: event.clientX, y: event.clientY };
    setDrag({
      index,
      pointerStart: at,
      pointer: at,
      grab: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      moved: false,
    });
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = { x: event.clientX, y: event.clientY };
    setDrag((previous) =>
      previous
        ? { ...previous, pointer, moved: previous.moved || pastThreshold(previous.pointerStart, pointer) }
        : previous,
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    releaseCapture(event);
    const current = drag;
    setDrag(null);
    if (!current) return;
    if (!current.moved) {
      // A plain click turns the card round, as it does on the canvas.
      const indices = flippable(clues, [current.index]);
      if (indices.length > 0) onFlip(indices);
      return;
    }
    const pointer = { x: event.clientX, y: event.clientY };
    if (isOver(containerRef.current, pointer)) return;
    const point = dropPoint(pointer, current.grab);
    if (point) onClearSuspect(current.index, point);
  };

  const accused = suspects.accused;

  return (
    <>
      <HoverTileContext.Provider value={onHoverTile}>
        <div
          ref={containerRef}
          data-suspects
          className={`absolute inset-x-0 bottom-0 flex items-center gap-3 overflow-x-auto rounded-lg border-2 border-dashed px-3 transition-colors ${
            dropTarget ? "border-rose-400 bg-rose-50" : "border-slate-300 bg-white"
          }`}
          style={{ height }}
        >
          <div className="w-24 shrink-0 text-xs leading-snug text-slate-500">
            <div className="font-semibold uppercase tracking-wide text-slate-600">Suspects</div>
            {suspects.cards.length === 0
              ? "Drag cards you doubt here."
              : "Right-click one to accuse it."}
          </div>
          {suspects.cards.map((index) => {
            const clue = clues[index];
            if (!clue) return null;
            const lifted = drag?.index === index && drag.moved;
            const { ring, outline } = cardFrame(index, { highlight, peeked, revealedFalse, accused });
            return (
              <div
                key={index}
                data-clue-index={index}
                data-suspect
                className={`relative shrink-0 cursor-grab touch-none ${ring}`}
                style={{
                  outline,
                  outlineOffset: 2,
                  borderRadius: "0.5rem",
                  opacity: lifted ? 0.3 : 1,
                }}
                onPointerDown={(event) => startDrag(event, index)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onAccuse(index);
                }}
              >
                <ClueCard
                  clue={clue}
                  size={size}
                  used={(used[index] ?? false) && !highlight.includes(index)}
                  flipped={flipped[index] ?? false}
                />
                <CardOverlays index={index} accused={accused} revealedFalse={revealedFalse} />
              </div>
            );
          })}
        </div>
      </HoverTileContext.Provider>

      {drag?.moved && clues[drag.index] && (
        // Drawn fixed to the window rather than inside the strip, which scrolls
        // and so would clip a card dragged out of it.
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: drag.pointer.x - drag.grab.x,
            top: drag.pointer.y - drag.grab.y,
            filter: LIFTED_SHADOW,
          }}
        >
          <ClueCard
            clue={clues[drag.index]}
            size={size}
            used={false}
            flipped={flipped[drag.index] ?? false}
          />
        </div>
      )}
    </>
  );
}
