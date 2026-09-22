import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Clue } from "../model/types";
import { ClueCard } from "./ClueCard";
import {
  canFlip,
  cluesWithin,
  contentBounds,
  fitZoom,
  rectFromCorners,
  type Point,
} from "./clueLayout";

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
  highlight: number | null;
};

/** Pointer travel, in screen pixels, before a press counts as a drag. */
const DRAG_THRESHOLD = 4;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 1.25;

type CardDrag = {
  index: number;
  /** Where the pointer went down, in screen coordinates. */
  pointerStart: Point;
  /** Canvas positions of every card being carried, as they were when it began. */
  origins: Map<number, Point>;
  /** How far the whole group can move left and up before a card passes the edge. */
  limit: Point;
  offset: Point;
  moved: boolean;
  wasSelected: boolean;
  toggleSelection: boolean;
};

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
}: Props) {
  const [cardDrag, setCardDrag] = useState<CardDrag | null>(null);
  const [band, setBand] = useState<Band | null>(null);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [order, setOrder] = useState<number[]>(() => clues.map((_, i) => i));
  const [zoom, setZoom] = useState(1);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  /** Scroll position to restore after a zoom, keeping a chosen point still. */
  const anchoredScroll = useRef<{ left: number; top: number } | null>(null);

  const content = useMemo(() => contentBounds(clues, positions), [clues, positions]);

  const toCanvas = useCallback(
    (clientX: number, clientY: number): Point => {
      const surface = surfaceRef.current;
      if (!surface) return { x: 0, y: 0 };
      const rect = surface.getBoundingClientRect();
      return {
        x: (clientX - rect.left + surface.scrollLeft) / zoom,
        y: (clientY - rect.top + surface.scrollTop) / zoom,
      };
    },
    [zoom],
  );

  /** Changes the zoom while holding one screen point still under the pointer. */
  const applyZoom = useCallback(
    (next: number, anchor: Point | null) => {
      const surface = surfaceRef.current;
      if (!surface) return;
      const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
      if (clamped === zoom) return;
      const rect = surface.getBoundingClientRect();
      // The point to hold still, as an offset into the viewport.
      const at = anchor
        ? { x: anchor.x - rect.left, y: anchor.y - rect.top }
        : { x: rect.width / 2, y: rect.height / 2 };
      const fixed = {
        x: (surface.scrollLeft + at.x) / zoom,
        y: (surface.scrollTop + at.y) / zoom,
      };
      anchoredScroll.current = { left: fixed.x * clamped - at.x, top: fixed.y * clamped - at.y };
      setZoom(clamped);
    },
    [zoom],
  );

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const anchored = anchoredScroll.current;
    if (!surface || !anchored) return;
    surface.scrollLeft = Math.max(0, anchored.left);
    surface.scrollTop = Math.max(0, anchored.top);
    anchoredScroll.current = null;
  }, [zoom]);

  // Attached by hand because React's onWheel cannot call preventDefault, and
  // without that the browser zooms the whole page instead.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      applyZoom(zoom * Math.exp(-event.deltaY / 500), { x: event.clientX, y: event.clientY });
    };
    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, [applyZoom, zoom]);

  useEffect(() => {
    if (selection.size === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);

  useEffect(() => {
    if (highlight === null) return;
    surfaceRef.current
      ?.querySelector(`[data-clue-index="${highlight}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [highlight]);

  const positionOf = (index: number): Point => {
    const origin = cardDrag?.origins.get(index);
    if (cardDrag && origin)
      return { x: origin.x + cardDrag.offset.x, y: origin.y + cardDrag.offset.y };
    return positions[index] ?? { x: 0, y: 0 };
  };

  const startCardDrag = (event: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0) return;
    // Keep the press off the canvas underneath, which would start a band.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setOrder((previous) => [...previous.filter((i) => i !== index), index]);

    // Dragging a selected card carries the whole selection; dragging any other
    // card carries only itself.
    const wasSelected = selection.has(index);
    const carried = wasSelected ? [...selection] : [index];
    const origins = new Map(carried.map((i) => [i, positions[i] ?? { x: 0, y: 0 }]));
    setCardDrag({
      index,
      pointerStart: { x: event.clientX, y: event.clientY },
      origins,
      limit: {
        x: Math.min(...[...origins.values()].map((point) => point.x)),
        y: Math.min(...[...origins.values()].map((point) => point.y)),
      },
      offset: { x: 0, y: 0 },
      moved: false,
      wasSelected,
      toggleSelection: event.shiftKey,
    });
  };

  const moveCardDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setCardDrag((previous) => {
      if (!previous) return previous;
      const dx = event.clientX - previous.pointerStart.x;
      const dy = event.clientY - previous.pointerStart.y;
      const moved =
        previous.moved || Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD;
      if (!moved) return previous;
      // Clamped as a group, so cards keep their spacing at the edge.
      return {
        ...previous,
        moved,
        offset: {
          x: Math.max(dx / zoom, -previous.limit.x),
          y: Math.max(dy / zoom, -previous.limit.y),
        },
      };
    });
  };

  // Committing happens here rather than inside a setState updater: React runs
  // updaters during the render phase, where calling the parent's setState is
  // not allowed.
  const endCardDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cardDrag) return;

    if (cardDrag.moved) {
      onMove(
        [...cardDrag.origins].map(([index, point]) => ({
          index,
          point: { x: point.x + cardDrag.offset.x, y: point.y + cardDrag.offset.y },
        })),
      );
      // Dragging a card that was not part of the selection makes it the subject,
      // so the old selection is no longer what the next drag would carry.
      if (!cardDrag.wasSelected) setSelection(new Set());
    } else if (cardDrag.toggleSelection) {
      setSelection((previous) => {
        const next = new Set(previous);
        if (!next.delete(cardDrag.index)) next.add(cardDrag.index);
        return next;
      });
    } else {
      // A plain click mirrors the card, on the same rule as dragging: one that
      // is part of the selection carries the rest of it, any other card goes on
      // its own. Cards whose meaning is a direction cannot be mirrored and are
      // dropped from the list rather than left saying the opposite.
      const carried = cardDrag.wasSelected ? [...selection] : [cardDrag.index];
      const flippable = carried.filter((i) => clues[i] && canFlip(clues[i]));
      if (flippable.length > 0) onFlip(flippable);
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
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (pan.current) {
      pan.current = null;
      return;
    }
    if (!band) return;
    const caught = cluesWithin(clues, positions, rectFromCorners(band.origin, band.current));
    setSelection(new Set([...band.base, ...caught]));
    setBand(null);
  };

  const fit = () => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const next = fitZoom(
      content,
      { width: surface.clientWidth, height: surface.clientHeight },
      ZOOM_MIN,
      ZOOM_MAX,
    );
    // Not routed through applyZoom: that anchors on a point, while fitting
    // always ends at the top-left corner. Fitting when already at the fitted
    // zoom changes no state, so there is no re-render to scroll from either.
    if (next === zoom) {
      surface.scrollTo({ left: 0, top: 0 });
      return;
    }
    anchoredScroll.current = { left: 0, top: 0 };
    setZoom(next);
  };

  const bandRect = band ? rectFromCorners(band.origin, band.current) : null;

  return (
    <div className="relative h-full w-full">
      <div
        ref={surfaceRef}
        data-canvas
        className="h-full w-full overflow-auto rounded-lg bg-slate-100"
        style={{
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
            {clues.map((clue, index) => {
              const point = positionOf(index);
              const dragging = cardDrag?.origins.has(index) && cardDrag.moved;
              const hinted = highlight === index;
              const selected = selection.has(index);
              return (
                <div
                  key={index}
                  data-clue-index={index}
                  data-selected={selected || undefined}
                  className={`absolute touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"} ${
                    hinted ? "hint-ring rounded-lg" : ""
                  }`}
                  style={{
                    left: point.x,
                    top: point.y,
                    zIndex: order.indexOf(index) + 1,
                    transform: dragging ? "scale(1.04)" : undefined,
                    filter: dragging ? "drop-shadow(0 6px 12px rgb(15 23 42 / 0.25))" : undefined,
                    // An outline rather than a ring, so a selected card that is
                    // also the hint can show both.
                    outline: selected ? "2px solid rgb(79 70 229)" : undefined,
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
                </div>
              );
            })}

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

      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg border border-slate-300 bg-white/95 px-1.5 py-1 text-xs text-slate-600 shadow-sm">
        {selection.size > 0 && (
          <>
            <span data-selection-count className="px-1 font-medium text-indigo-700">
              {selection.size} selected
            </span>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-slate-100"
              onClick={() => setSelection(new Set())}
            >
              Clear
            </button>
            <span className="mx-0.5 h-4 w-px bg-slate-200" />
          </>
        )}
        <ZoomButton label="−" title="Zoom out" onClick={() => applyZoom(zoom / ZOOM_STEP, null)} />
        <span data-zoom className="w-10 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <ZoomButton label="+" title="Zoom in" onClick={() => applyZoom(zoom * ZOOM_STEP, null)} />
        <button
          type="button"
          className="rounded px-1.5 py-0.5 hover:bg-slate-100"
          title="Fit every clue in view"
          onClick={fit}
        >
          Fit
        </button>
      </div>
    </div>
  );
}

function ZoomButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="h-5 w-5 rounded text-sm leading-none hover:bg-slate-100"
    >
      {label}
    </button>
  );
}
