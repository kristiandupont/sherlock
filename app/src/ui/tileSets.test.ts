import { describe, expect, it } from "vitest";
import { DEFAULT_SIZE } from "../model/types";
import { ROWS, tileName } from "./tileSets";

describe("tile sets", () => {
  it("gives every tile in the game a name of its own", () => {
    // The rule this game is built on: a player names a tile to reason about it,
    // so a name shared by two rows makes both of them ambiguous. Three rows of
    // numbers once broke this, and "A is next to three" stopped meaning
    // anything.
    const names = ROWS.flatMap((row) => row.glyphs.map((glyph) => glyph.name));
    const seen = new Map<string, string[]>();
    for (const row of ROWS)
      for (const glyph of row.glyphs)
        seen.set(glyph.name, [...(seen.get(glyph.name) ?? []), row.name]);

    const shared = [...seen].filter(([, rows]) => rows.length > 1);
    expect(shared, `shared names: ${JSON.stringify(shared)}`).toEqual([]);
    expect(names).toHaveLength(ROWS.length * DEFAULT_SIZE);
  });

  it("has one row per category and one glyph per column", () => {
    expect(ROWS).toHaveLength(DEFAULT_SIZE);
    for (const row of ROWS) expect(row.glyphs, row.name).toHaveLength(DEFAULT_SIZE);
  });

  it("draws something for every tile", () => {
    for (const row of ROWS)
      for (const glyph of row.glyphs)
        expect(
          Boolean(glyph.text || glyph.fill || glyph.stroke || glyph.pips),
          `${row.name} ${glyph.name}`,
        ).toBe(true);
  });

  it("gives every row a colour of its own, since that is what separates rows", () => {
    expect(new Set(ROWS.map((row) => row.color)).size).toBe(ROWS.length);
    expect(new Set(ROWS.map((row) => row.soft)).size).toBe(ROWS.length);
  });

  it("names a tile by its row and its own name", () => {
    expect(tileName(0, 0)).toBe("Letters A");
    expect(tileName(1, 2)).toBe("Dice three");
  });
});
