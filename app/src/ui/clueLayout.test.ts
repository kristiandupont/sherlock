import { describe, expect, it } from "vitest";
import { CLUE_KINDS, type Clue } from "../model/types";
import {
  cardSize,
  cluesWithin,
  contentBounds,
  fitZoom,
  layoutCluesByKind,
  rectFromCorners,
  type Point,
} from "./clueLayout";

const a = { row: 0, tile: 0 };
const b = { row: 1, tile: 1 };
const c = { row: 2, tile: 2 };

const clues: Clue[] = [
  { kind: "same-column", a, b },
  { kind: "left-of", left: a, right: b },
  { kind: "between", middle: b, a, b: c },
];

describe("rectFromCorners", () => {
  it("normalises a drag made in any direction", () => {
    const downRight = rectFromCorners({ x: 10, y: 20 }, { x: 40, y: 60 });
    expect(downRight).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    expect(rectFromCorners({ x: 40, y: 60 }, { x: 10, y: 20 })).toEqual(downRight);
    expect(rectFromCorners({ x: 40, y: 20 }, { x: 10, y: 60 })).toEqual(downRight);
  });
});

describe("cluesWithin", () => {
  const positions: Point[] = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 0, y: 200 },
  ];

  it("finds the cards a band covers", () => {
    expect(cluesWithin(clues, positions, { x: -5, y: -5, width: 300, height: 300 })).toEqual([
      0, 1, 2,
    ]);
    expect(cluesWithin(clues, positions, { x: -5, y: -5, width: 60, height: 60 })).toEqual([0]);
  });

  it("counts a card that the band only clips", () => {
    const box = cardSize(clues[1]);
    // A band ending one pixel inside the second card's left edge.
    const rect = { x: 150, y: 0, width: 51, height: 40 };
    expect(rect.x + rect.width).toBeGreaterThan(positions[1].x);
    expect(cluesWithin(clues, positions, rect)).toContain(1);
    expect(box.width).toBeGreaterThan(0);
  });

  it("treats a band of no size as a click and catches nothing", () => {
    // Even landing inside a card's bounds, which a real click cannot do —
    // the card is on top and takes the event itself.
    expect(cluesWithin(clues, positions, { x: 10, y: 10, width: 0, height: 0 })).toEqual([]);
  });

  it("still sweeps up cards under a band flat in one direction", () => {
    expect(cluesWithin(clues, positions, { x: -5, y: 45, width: 300, height: 0 })).toEqual([0, 1]);
  });

  it("ignores a band that only touches an edge", () => {
    expect(cluesWithin(clues, positions, { x: -40, y: 0, width: 40, height: 40 })).toEqual([]);
  });

  it("skips clues that have not been placed yet", () => {
    expect(cluesWithin(clues, [], { x: -5, y: -5, width: 999, height: 999 })).toEqual([]);
  });
});

describe("cardSize", () => {
  it("widens an apart card by one column per column it has to draw", () => {
    const two = cardSize({ kind: "apart", a, b, distance: 2 });
    const three = cardSize({ kind: "apart", a, b, distance: 3 });
    expect(three.width - two.width).toBe(14);
    expect(three.height).toBe(two.height);
  });
});

describe("layoutCluesByKind", () => {
  it("finds a place for every clue, whatever its kind", () => {
    // One of each: a kind missing from the grouping order would be left without
    // a position and pile up in the corner, invisible under the others.
    const everyKind: Clue[] = [
      { kind: "same-column", a, b },
      { kind: "different-column", a, b },
      { kind: "adjacent", a, b },
      { kind: "left-of", left: a, right: b },
      { kind: "between", middle: b, a, b: c },
      { kind: "immediately-left-of", left: a, right: b },
      { kind: "apart", a, b, distance: 2 },
      { kind: "at-an-end", a },
      { kind: "next-to-either", a, b, c },
    ];
    expect(everyKind.map((clue) => clue.kind).sort()).toEqual([...CLUE_KINDS].sort());

    const positions = layoutCluesByKind(everyKind, 400);
    expect(positions).toHaveLength(everyKind.length);
    for (const [index, point] of positions.entries())
      expect(point, `${everyKind[index].kind} was left unplaced`).toBeDefined();
  });

  it("keeps each kind together, in one unbroken run", () => {
    const many: Clue[] = [
      { kind: "same-column", a, b },
      { kind: "at-an-end", a },
      { kind: "same-column", a, b: c },
      { kind: "at-an-end", a: b },
    ];
    const positions = layoutCluesByKind(many, 400);
    const reading = many
      .map((clue, index) => ({ kind: clue.kind, ...positions[index] }))
      .sort((p, q) => p.y - q.y || p.x - q.x)
      .map((entry) => entry.kind);
    const runs = reading.filter((kind, index) => kind !== reading[index - 1]);
    expect(runs).toEqual(["same-column", "at-an-end"]);
  });
});

describe("contentBounds", () => {
  it("covers the furthest card corner", () => {
    const positions = layoutCluesByKind(clues, 400);
    const bounds = contentBounds(clues, positions);
    for (const [index, point] of positions.entries()) {
      expect(bounds.width).toBeGreaterThanOrEqual(point.x + cardSize(clues[index]).width);
      expect(bounds.height).toBeGreaterThanOrEqual(point.y + cardSize(clues[index]).height);
    }
  });
});

describe("fitZoom", () => {
  it("shrinks until everything fits", () => {
    expect(fitZoom({ width: 1000, height: 500 }, { width: 500, height: 500 }, 0.35, 2.5)).toBe(0.5);
    expect(fitZoom({ width: 500, height: 1000 }, { width: 500, height: 500 }, 0.35, 2.5)).toBe(0.5);
  });

  it("never enlarges to fill the space", () => {
    expect(fitZoom({ width: 100, height: 100 }, { width: 900, height: 900 }, 0.35, 2.5)).toBe(1);
  });

  it("stays inside the zoom range", () => {
    expect(fitZoom({ width: 100000, height: 10 }, { width: 500, height: 500 }, 0.35, 2.5)).toBe(0.35);
  });
});
