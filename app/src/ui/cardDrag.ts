import type { Point } from "./clueLayout";
import { pastThreshold } from "./pointer";

/** A press on a card on the canvas, from pointer down to pointer up. */
export type CardDrag = {
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
  /** Whether the pointer is over the suspects strip, where letting go drops the cards in. */
  overStrip: boolean;
  /**
   * Whether the pointer has left the canvas. The canvas scrolls, so it clips
   * what is outside it, and the cards are drawn fixed to the window instead.
   */
  outside: boolean;
  pointer: Point;
  /** Where in the dragged card the pointer took hold, in screen pixels from its corner. */
  grab: Point;
};

/**
 * Starts a press on card `index`. Dragging a selected card carries the whole
 * selection; dragging any other card carries only itself.
 */
export function beginCardDrag({
  index,
  selection,
  positions,
  pointer,
  grab,
  toggleSelection,
}: {
  index: number;
  selection: ReadonlySet<number>;
  positions: Point[];
  pointer: Point;
  grab: Point;
  /** Shift was held, so a click adds the card to the selection or takes it out. */
  toggleSelection: boolean;
}): CardDrag {
  const wasSelected = selection.has(index);
  const carried = wasSelected ? [...selection] : [index];
  const origins = new Map(carried.map((i) => [i, positions[i] ?? { x: 0, y: 0 }]));
  return {
    index,
    pointerStart: pointer,
    origins,
    limit: {
      x: Math.min(...[...origins.values()].map((point) => point.x)),
      y: Math.min(...[...origins.values()].map((point) => point.y)),
    },
    offset: { x: 0, y: 0 },
    moved: false,
    wasSelected,
    toggleSelection,
    overStrip: false,
    outside: false,
    pointer,
    grab,
  };
}

/**
 * The drag with the pointer at `pointer`. Until the pointer passes the drag
 * threshold the press is still a click and nothing changes. `locate` reads
 * what the pointer is over from the page, and is only called once the press
 * has become a drag.
 */
export function continueCardDrag(
  drag: CardDrag,
  pointer: Point,
  zoom: number,
  locate: () => { overStrip: boolean; outside: boolean },
): CardDrag {
  const moved = drag.moved || pastThreshold(drag.pointerStart, pointer);
  if (!moved) return drag;
  const { overStrip, outside } = locate();
  // Clamped as a group, so cards keep their spacing at the edge.
  return {
    ...drag,
    moved,
    overStrip,
    outside,
    pointer,
    offset: {
      x: Math.max((pointer.x - drag.pointerStart.x) / zoom, -drag.limit.x),
      y: Math.max((pointer.y - drag.pointerStart.y) / zoom, -drag.limit.y),
    },
  };
}

/** Where card `index` is drawn on the canvas: moved with the drag if it is carried. */
export function cardPosition(drag: CardDrag | null, positions: Point[], index: number): Point {
  const origin = drag?.origins.get(index);
  if (drag && origin) return { x: origin.x + drag.offset.x, y: origin.y + drag.offset.y };
  return positions[index] ?? { x: 0, y: 0 };
}

/**
 * Screen positions for the carried cards while the pointer is outside the
 * canvas: the same arrangement at the canvas's zoom, placed so that the card
 * under the pointer stays under it.
 */
export function floatingCards(drag: CardDrag, zoom: number): Array<{ index: number; point: Point }> {
  return [...drag.origins].map(([index, origin]) => {
    const lead = drag.origins.get(drag.index) ?? origin;
    return {
      index,
      point: {
        x: drag.pointer.x - drag.grab.x + (origin.x - lead.x) * zoom,
        y: drag.pointer.y - drag.grab.y + (origin.y - lead.y) * zoom,
      },
    };
  });
}

/** What letting go of a card does. */
export type CardDrop =
  /** The carried cards go into the suspects strip. */
  | { kind: "suspect"; indices: number[] }
  /**
   * The carried cards move. `fromSelection` is false when the card dragged was
   * not selected, which makes it the subject and so ends the old selection.
   */
  | { kind: "move"; moves: Array<{ index: number; point: Point }>; fromSelection: boolean }
  /** A shift-click: the card joins the selection or leaves it. */
  | { kind: "toggle-selection"; index: number }
  /**
   * A plain click, which mirrors the card, on the same rule as dragging: one
   * that is part of the selection carries the rest of it, any other card goes
   * on its own. Cards that cannot be mirrored are still in `indices`.
   */
  | { kind: "flip"; indices: number[] };

/** What letting go ends in. `selection` is the selection as it is now. */
export function cardDrop(drag: CardDrag, selection: ReadonlySet<number>): CardDrop {
  if (drag.moved && drag.overStrip) return { kind: "suspect", indices: [...drag.origins.keys()] };
  if (drag.moved)
    return {
      kind: "move",
      moves: [...drag.origins].map(([index, point]) => ({
        index,
        point: { x: point.x + drag.offset.x, y: point.y + drag.offset.y },
      })),
      fromSelection: drag.wasSelected,
    };
  if (drag.toggleSelection) return { kind: "toggle-selection", index: drag.index };
  return { kind: "flip", indices: drag.wasSelected ? [...selection] : [drag.index] };
}
