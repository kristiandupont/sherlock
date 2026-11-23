import { useEffect, useMemo, useRef, useState } from "react";
import type { Suspects } from "../game/suspects";
import type { Clue, TileRef } from "../model/types";
import { CanvasControls } from "./CanvasControls";
import { CardOverlays } from "./CardOverlays";
import { ClueCard } from "./ClueCard";
import { SuspectStrip } from "./SuspectStrip";
import {
  beginCardDrag,
  cardDrop,
  cardPosition,
  continueCardDrag,
  floatingCards,
  type CardDrag,
} from "./cardDrag";
import { cardFrame, LIFTED_SHADOW } from "./cardStyle";
import { cluesWithin, contentBounds, flippable, rectFromCorners, type Point } from "./clueLayout";
import { HoverTileContext } from "./hoverTile";
import { isOver, releaseCapture } from "./pointer";
import { useCanvasZoom } from "./useCanvasZoom";

type Props = {
  clues: Clue[];
  /** Columns on the board, which one of the clue cards draws a miniature of. */
  size: number;
  positions: Point[];
  used: boolean[];
  /** Which cards are drawn mirrored. */
  flipped: boolean[];
  /** Called once a drag finishes, with every card that drag carried. */
  onMove: (moves: Array<{ index: number; point: Point }>) => void;
  /** Greys a card out or brings it back, which right-clicking it asks for. */
  onToggleUsed: (index: number) => void;
  /** Mirrors every card in the list, which clicking a card asks for. */
  onFlip: (indices: number[]) => void;
  /** Index of the clue the hint points at, ringed and scrolled into view. */
  highlight: readonly number[];
  /** Index of the false card, once the puzzle is solved and it can be shown. */
  revealedFalse: number | null;
  /** The suspects strip, or null when the puzzle has no false card and so no strip. */
  suspects: Suspects | null;
  /** Moves cards from the canvas into the strip. */
  onSuspect: (indices: number[]) => void;
  /** Moves a card from the strip back onto the canvas, at `point`. */
  onClearSuspect: (index: number, point: Point) => void;
  /** Accuses a card in the strip, or withdraws the accusation; right-click asks for it. */
  onAccuse: (index: number) => void;
  /** Indices of the clues ringed by the Alt peek. */
  peeked: ReadonlySet<number>;
  /** Called with the tile under the pointer on a card, and with null when it leaves. */
  onHoverTile: (tile: TileRef | null) => void;
};

/** Height of the suspects strip, in screen pixels; tall enough for a stacked card. */
const STRIP_HEIGHT = 132;

type Band = {
  /** Both corners in canvas coordinates. */
  origin: Point;
  current: Point;
  /** Selection to add to, when the band was started with shift held. */
  base: Set<number>;
};

export function ClueCanvas({
  clues,
  size,
  positions,
  used,
  flipped,
  onMove,
  onToggleUsed,
  onFlip,
  highlight,
  peeked,
  onHoverTile,
  revealedFalse,
  suspects,
  onSuspect,
  onClearSuspect,
  onAccuse,
}: Props) {
  const [cardDrag, setCardDrag] = useState<CardDrag | null>(null);
  const [band, setBand] = useState<Band | null>(null);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [order, setOrder] = useState<number[]>(() => clues.map((_, i) => i));

  const surfaceRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const suspectSet = useMemo(() => new Set(suspects?.cards ?? []), [suspects]);
  const stripHeight = suspects ? STRIP_HEIGHT : 0;
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const content = useMemo(() => contentBounds(clues, positions), [clues, positions]);
  const { zoom, toCanvas, zoomIn, zoomOut, fit } = useCanvasZoom(surfaceRef, content);

  useEffect(() => {
    if (selection.size === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);

  useEffect(() => {
    if (highlight.length === 0) return;
    rootRef.current
      ?.querySelector(`[data-clue-index="${highlight[0]}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [highlight]);

  const accused = suspects?.accused ?? null;

  const startCardDrag = (event: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0) return;
    // Keep the press off the canvas underneath, which would start a band.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setOrder((previous) => [...previous.filter((i) => i !== index), index]);
    const rect = event.currentTarget.getBoundingClientRect();
    setCardDrag(
      beginCardDrag({
        index,
        selection,
        positions,
        pointer: { x: event.clientX, y: event.clientY },
        grab: { x: event.clientX - rect.left, y: event.clientY - rect.top },
        toggleSelection: event.shiftKey,
      }),
    );
  };

  const moveCardDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const pointer = { x: event.clientX, y: event.clientY };
    setCardDrag((previous) =>
      previous
        ? continueCardDrag(previous, pointer, zoom, () => ({
            overStrip: suspects !== null && isOver(stripRef.current, pointer),
            outside: !isOver(surfaceRef.current, pointer),
          }))
        : previous,
    );
  };

  // Committing happens here rather than inside a setState updater: React runs
  // updaters during the render phase, where calling the parent's setState is
  // not allowed.
  const endCardDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    releaseCapture(event);
    if (!cardDrag) return;

    const drop = cardDrop(cardDrag, selection);
    switch (drop.kind) {
      case "suspect":
        onSuspect(drop.indices);
        setSelection(new Set());
        break;
      case "move":
        onMove(drop.moves);
        // Dragging a card that was not part of the selection makes it the
        // subject, so the old selection is no longer what the next drag would
        // carry.
        if (!drop.fromSelection) setSelection(new Set());
        break;
      case "toggle-selection":
        setSelection((previous) => {
          const next = new Set(previous);
          if (!next.delete(drop.index)) next.add(drop.index);
          return next;
        });
        break;
      case "flip": {
        const indices = flippable(clues, drop.indices);
        if (indices.length > 0) onFlip(indices);
        break;
      }
    }
    setCardDrag(null);
  };

  const startBackgroundDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 1) {
      const surface = surfaceRef.current;
      if (!surface) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      pan.current = {
        x: event.clientX,
        y: event.clientY,
        left: surface.scrollLeft,
        top: surface.scrollTop,
      };
      return;
    }
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const at = toCanvas(event.clientX, event.clientY);
    setBand({ origin: at, current: at, base: event.shiftKey ? new Set(selection) : new Set() });
  };

  const moveBackgroundDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const panning = pan.current;
    const surface = surfaceRef.current;
    if (panning && surface) {
      surface.scrollLeft = panning.left - (event.clientX - panning.x);
      surface.scrollTop = panning.top - (event.clientY - panning.y);
      return;
    }
    if (!band) return;
    const at = toCanvas(event.clientX, event.clientY);
    setBand((previous) => (previous ? { ...previous, current: at } : previous));
  };

  const endBackgroundDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    releaseCapture(event);
    if (pan.current) {
      pan.current = null;
      return;
    }
    if (!band) return;
    const caught = cluesWithin(clues, positions, rectFromCorners(band.origin, band.current)).filter(
      (index) => !suspectSet.has(index),
    );
    setSelection(new Set([...band.base, ...caught]));
    setBand(null);
  };

  /** Where a card let go at `pointer`, held at `grab`, lands on the canvas. */
  const dropPoint = (pointer: Point, grab: Point): Point | null => {
    if (!isOver(surfaceRef.current, pointer)) return null;
    // The card lands where it was let go: its top-left corner, not the pointer.
    const corner = toCanvas(pointer.x - grab.x, pointer.y - grab.y);
    return { x: Math.max(0, corner.x), y: Math.max(0, corner.y) };
  };

  const bandRect = band ? rectFromCorners(band.origin, band.current) : null;

  return (
    // Nothing on the canvas is text to be read — the letters are drawn as SVG
    // text, so without this a drag across the cards selects them.
    <div ref={rootRef} className="relative h-full w-full select-none">
      <div
        ref={surfaceRef}
        data-canvas
        className="w-full overflow-auto rounded-lg bg-slate-100"
        style={{
          height: stripHeight ? `calc(100% - ${stripHeight + 8}px)` : "100%",
          backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
          backgroundSize: `${16 * zoom}px ${16 * zoom}px`,
        }}
      >
        <div
          className="relative touch-none"
          style={{
            width: Math.max(content.width * zoom, 1),
            height: Math.max(content.height * zoom, 1),
            minWidth: "100%",
            minHeight: "100%",
          }}
          onPointerDown={startBackgroundDrag}
          onPointerMove={moveBackgroundDrag}
          onPointerUp={endBackgroundDrag}
          onPointerCancel={endBackgroundDrag}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: content.width,
              height: content.height,
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            <HoverTileContext.Provider value={onHoverTile}>
              {clues.map((clue, index) => {
                if (suspectSet.has(index)) return null;
                const point = cardPosition(cardDrag, positions, index);
                const dragging = cardDrag?.origins.has(index) && cardDrag.moved;
                const hinted = highlight.includes(index);
                const selected = selection.has(index);
                const frame = cardFrame(index, { highlight, peeked, revealedFalse, accused });
                return (
                  <div
                    key={index}
                    data-clue-index={index}
                    data-selected={selected || undefined}
                    className={`absolute touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"} ${
                      frame.ring
                    }`}
                    style={{
                      left: point.x,
                      top: point.y,
                      zIndex: order.indexOf(index) + 1,
                      transform: dragging ? "scale(1.04)" : undefined,
                      visibility: dragging && cardDrag?.outside ? "hidden" : undefined,
                      filter: dragging ? LIFTED_SHADOW : undefined,
                      // An outline rather than a ring, so a selected card that is
                      // also the hint can show both.
                      outline: selected ? "2px solid rgb(79 70 229)" : frame.outline,
                      outlineOffset: 2,
                      borderRadius: "0.5rem",
                    }}
                    onPointerDown={(event) => startCardDrag(event, index)}
                    onPointerMove={moveCardDrag}
                    onPointerUp={endCardDrag}
                    onPointerCancel={endCardDrag}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      onToggleUsed(index);
                    }}
                  >
                    <ClueCard
                      clue={clue}
                      size={size}
                      used={(used[index] ?? false) && !hinted}
                      flipped={flipped[index] ?? false}
                    />
                    <CardOverlays index={index} accused={accused} revealedFalse={revealedFalse} />
                  </div>
                );
              })}
            </HoverTileContext.Provider>

            {bandRect && (
              <div
                data-band
                className="pointer-events-none absolute border border-indigo-500 bg-indigo-500/10"
                style={{
                  left: bandRect.x,
                  top: bandRect.y,
                  width: bandRect.width,
                  height: bandRect.height,
                  borderWidth: 1 / zoom,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {suspects && (
        <SuspectStrip
          suspects={suspects}
          clues={clues}
          size={size}
          used={used}
          flipped={flipped}
          highlight={highlight}
          peeked={peeked}
          revealedFalse={revealedFalse}
          height={STRIP_HEIGHT}
          dropTarget={cardDrag?.overStrip ?? false}
          containerRef={stripRef}
          onHoverTile={onHoverTile}
          onAccuse={onAccuse}
          onFlip={onFlip}
          dropPoint={dropPoint}
          onClearSuspect={onClearSuspect}
        />
      )}

      {cardDrag?.moved && cardDrag.outside && (
        // The carried cards, kept in the same arrangement and at the canvas's
        // zoom, placed so that the card under the pointer stays under it.
        <div className="pointer-events-none fixed inset-0 z-50">
          {floatingCards(cardDrag, zoom).map(({ index, point }) => (
            <div
              key={index}
              className="absolute"
              style={{
                left: point.x,
                top: point.y,
                transform: `scale(${zoom})`,
                transformOrigin: "0 0",
                filter: LIFTED_SHADOW,
              }}
            >
              {clues[index] && (
                <ClueCard
                  clue={clues[index]}
                  size={size}
                  used={used[index] ?? false}
                  flipped={flipped[index] ?? false}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <CanvasControls
        bottom={stripHeight ? stripHeight + 16 : 8}
        selectionCount={selection.size}
        onClearSelection={() => setSelection(new Set())}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFit={fit}
      />
    </div>
  );
}
