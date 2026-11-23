import { describe, expect, it } from "vitest";
import {
  beginCardDrag,
  cardDrop,
  cardPosition,
  continueCardDrag,
  floatingCards,
  type CardDrag,
} from "./cardDrag";
import { DRAG_THRESHOLD } from "./pointer";

const positions = [
  { x: 100, y: 50 },
  { x: 20, y: 200 },
  { x: 300, y: 10 },
];

const nowhere = () => ({ overStrip: false, outside: false });

const begin = (index: number, selection: number[] = [], toggleSelection = false): CardDrag =>
  beginCardDrag({
    index,
    selection: new Set(selection),
    positions,
    pointer: { x: 500, y: 500 },
    grab: { x: 5, y: 6 },
    toggleSelection,
  });

describe("beginCardDrag", () => {
  it("carries the whole selection when the card pressed is selected", () => {
    const drag = begin(0, [0, 2]);
    expect([...drag.origins.keys()]).toEqual([0, 2]);
    expect(drag.wasSelected).toBe(true);
    // The furthest the group can go left and up before a card passes the edge.
    expect(drag.limit).toEqual({ x: 100, y: 10 });
  });

  it("carries only the card pressed when it is not selected", () => {
    const drag = begin(1, [0, 2]);
    expect([...drag.origins.keys()]).toEqual([1]);
    expect(drag.wasSelected).toBe(false);
  });
});

describe("continueCardDrag", () => {
  it("stays a click until the pointer passes the threshold, without reading the page", () => {
    const drag = begin(0);
    const locate = () => {
      throw new Error("read the page during a click");
    };
    const pointer = { x: 500 + DRAG_THRESHOLD, y: 500 - DRAG_THRESHOLD };
    expect(continueCardDrag(drag, pointer, 1, locate)).toBe(drag);
  });

  it("moves by the pointer's travel divided by the zoom", () => {
    const drag = continueCardDrag(begin(0), { x: 540, y: 520 }, 2, nowhere);
    expect(drag.moved).toBe(true);
    expect(drag.offset).toEqual({ x: 20, y: 10 });
    expect(cardPosition(drag, positions, 0)).toEqual({ x: 120, y: 60 });
    expect(cardPosition(drag, positions, 1)).toEqual(positions[1]);
  });

  it("stops the group at the canvas edge so the cards keep their spacing", () => {
    const drag = continueCardDrag(begin(0, [0, 2]), { x: 0, y: 0 }, 1, nowhere);
    expect(drag.offset).toEqual({ x: -100, y: -10 });
  });

  it("stays a drag once it has become one, even back inside the threshold", () => {
    const moved = continueCardDrag(begin(0), { x: 600, y: 500 }, 1, nowhere);
    const back = continueCardDrag(moved, { x: 501, y: 500 }, 1, nowhere);
    expect(back.moved).toBe(true);
    expect(back.offset).toEqual({ x: 1, y: 0 });
  });
});

describe("floatingCards", () => {
  it("keeps the card held under the pointer and the others around it at the zoom", () => {
    const drag = { ...begin(0, [0, 2]), pointer: { x: 700, y: 400 } };
    expect(floatingCards(drag, 2)).toEqual([
      { index: 0, point: { x: 695, y: 394 } },
      { index: 2, point: { x: 695 + 400, y: 394 - 80 } },
    ]);
  });
});

describe("cardDrop", () => {
  it("puts the carried cards in the strip when let go over it", () => {
    const drag = continueCardDrag(begin(0, [0, 2]), { x: 600, y: 600 }, 1, () => ({
      overStrip: true,
      outside: true,
    }));
    expect(cardDrop(drag, new Set([0, 2]))).toEqual({ kind: "suspect", indices: [0, 2] });
  });

  it("moves the carried cards, and says whether they were the selection", () => {
    const drag = continueCardDrag(begin(1, [0]), { x: 510, y: 530 }, 1, nowhere);
    expect(cardDrop(drag, new Set([0]))).toEqual({
      kind: "move",
      moves: [{ index: 1, point: { x: 30, y: 230 } }],
      fromSelection: false,
    });
  });

  it("toggles the selection on a shift-click", () => {
    expect(cardDrop(begin(1, [], true), new Set())).toEqual({ kind: "toggle-selection", index: 1 });
  });

  it("flips the selection as it is now on a click of a selected card", () => {
    // Escape can clear the selection while the button is held.
    expect(cardDrop(begin(0, [0, 2]), new Set())).toEqual({ kind: "flip", indices: [] });
    expect(cardDrop(begin(0, [0, 2]), new Set([0, 2]))).toEqual({ kind: "flip", indices: [0, 2] });
    expect(cardDrop(begin(1, [0, 2]), new Set([0, 2]))).toEqual({ kind: "flip", indices: [1] });
  });
});
