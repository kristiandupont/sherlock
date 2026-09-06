/**
 * Artwork for the tiles.
 *
 * The naming rule matters more than the drawing: a player works a clue out by
 * saying it to themselves — "A is next to three" — so every tile needs a name
 * that identifies it on its own. An earlier set had digits, roman numerals and
 * dice all at once, three rows denoting the same six things, and "three" no
 * longer picked out a tile. Colour cannot repair that, because nobody thinks in
 * colour. `tileSets.test.ts` holds the rule: all thirty-six names distinct.
 *
 * Within a row the glyph tells tiles apart; across rows the hue does. Keeping
 * those two channels separate is why a row is drawn in a single colour.
 */
export type Glyph = {
  /** What a player would call this tile. Unique across every row. */
  name: string;
  /** Rendered as centred text, for letters. */
  text?: string;
  /** Filled path in a 24x24 box. Holes are wound the opposite way round. */
  fill?: string;
  /** Stroked path in a 24x24 box, drawn over the fill. */
  stroke?: string;
  /** Number of dice pips, 1-6. */
  pips?: number;
};

export type RowMeta = {
  name: string;
  /** Colour of the glyph itself. */
  color: string;
  /** Background tint behind a placed tile. */
  soft: string;
  glyphs: Glyph[];
};

const SHAPES: Glyph[] = [
  { name: "circle", fill: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z" },
  { name: "square", fill: "M5 5h14v14H5Z" },
  { name: "triangle", fill: "M12 3.5 21 20H3Z" },
  { name: "diamond", fill: "M12 3 21 12 12 21 3 12Z" },
  { name: "pentagon", fill: "M12 3 21.5 9.9 17.9 21H6.1L2.5 9.9Z" },
  {
    name: "star",
    fill: "M12 2.6 14.9 9.3 22.1 10 16.7 14.8 18.3 21.9 12 18.2 5.7 21.9 7.3 14.8 1.9 10 9.1 9.3Z",
  },
];

const SYMBOLS: Glyph[] = [
  {
    name: "heart",
    fill: "M12 21C6.2 16.2 3 13.2 3 9.7A4.7 4.7 0 0 1 12 7.2 4.7 4.7 0 0 1 21 9.7c0 3.5-3.2 6.5-9 11.3Z",
  },
  { name: "moon", fill: "M15.4 2.6a9.2 9.2 0 1 0 6.1 15.7A7.3 7.3 0 0 1 15.4 2.6Z" },
  { name: "drop", fill: "M12 2.4c4.1 5.1 6.6 7.8 6.6 11.2a6.6 6.6 0 0 1-13.2 0C5.4 10.2 7.9 7.5 12 2.4Z" },
  { name: "bolt", fill: "M13.6 2 5 13.6h5.4L9.4 22 19 10.4h-5.5L13.6 2Z" },
  {
    name: "leaf",
    fill: "M20.5 3.2C10 3.2 4 8.6 4 15.4c0 1.8.4 3.3 1.1 4.5l1.5-1.5c1.8-5.8 5.9-9.1 9.9-10.9-3.7 2.5-6.9 6.1-8.6 11.6 9.1 2 12.6-5 12.6-15.9Z",
  },
  {
    name: "sun",
    fill: "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z",
    stroke:
      "M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1",
  },
];

const THINGS: Glyph[] = [
  {
    name: "key",
    // Bow drawn clockwise, its hole anticlockwise, so the two cancel.
    fill: "M12 2.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Z M12 5.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 1 0 0-3.6Z M10.8 10.4h2.4v11.2h-2.4Z M13.2 13.2h3.7v2.2h-3.7Z M13.2 17h2.9v2.2h-2.9Z",
  },
  {
    name: "cup",
    fill: "M4.4 6.2h10.8V14a5.4 5.4 0 0 1-10.8 0V6.2Z",
    stroke: "M16.2 9h1a2.9 2.9 0 0 1 0 5.8h-1",
  },
  {
    name: "book",
    fill: "M11 6.6C9.2 5 6.6 4.3 3.4 4.5v12.9c3.2-.2 5.8.5 7.6 2.1V6.6Z M13 6.6c1.8-1.6 4.4-2.3 7.6-2.1v12.9c-3.2-.2-5.8.5-7.6 2.1V6.6Z",
  },
  {
    name: "bell",
    fill: "M12 2.2a1.9 1.9 0 0 0-1.9 1.9v.7A6.6 6.6 0 0 0 5.6 11.2v4.4l-2.1 2.6v1.1h17v-1.1l-2.1-2.6v-4.4a6.6 6.6 0 0 0-4.5-6.4v-.7A1.9 1.9 0 0 0 12 2.2Z M9.6 20.4a2.4 2.4 0 0 0 4.8 0H9.6Z",
  },
  { name: "crown", fill: "M2.8 8.2 6.9 12.4 12 4.6l5.1 7.8 4.1-4.2v11.2H2.8V8.2Z" },
  {
    name: "anchor",
    fill: "M12 2.2a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8Z M12 3.9a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 1 0 0-2.4Z M10.8 7.4h2.4V21h-2.4Z M7.4 9.4h9.2v2.2H7.4Z",
    stroke: "M4.2 13.6a8.5 8.5 0 0 0 15.6 0",
  },
];

const TRAVEL: Glyph[] = [
  {
    name: "car",
    fill: "M3.6 13.4 5.6 8.9A2.6 2.6 0 0 1 8 7.4h8a2.6 2.6 0 0 1 2.4 1.5l2 4.5v4.2H3.6v-4.2Z M7.2 15.4a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z M16.8 15.4a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z",
  },
  {
    name: "ship",
    fill: "M11.2 2.4v9.2H5.4L11.2 2.4Z M12.8 5.2 18.6 11.6h-5.8V5.2Z M2.6 13.4h18.8l-2.9 5.4a2.2 2.2 0 0 1-1.9 1.1H7.4a2.2 2.2 0 0 1-1.9-1.1L2.6 13.4Z",
  },
  {
    name: "plane",
    fill: "M12 2.2c1.15 0 2.05 1.55 2.05 3.5v3.1l7.55 4.35v2.4l-7.55-2.2v4.2l2.5 1.7v1.8L12 19.9l-4.55 1.15v-1.8l2.5-1.7v-4.2L2.4 15.55v-2.4l7.55-4.35V5.7c0-1.95.9-3.5 2.05-3.5Z",
  },
  {
    name: "rocket",
    fill: "M12 2.2c2.8 2.3 4.4 5.7 4.4 9.4v4.2H7.6v-4.2c0-3.7 1.6-7.1 4.4-9.4Z M12 6.9a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 1 0 0-3.6Z M7.6 12.4 4.6 15.8v3.6l3-1.9v-5.1Z M16.4 12.4l3 3.4v3.6l-3-1.9v-5.1Z M10.4 17.2h3.2L12 21.8Z",
  },
  {
    name: "bike",
    stroke:
      "M6.6 13.4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm10.8 0a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM6.6 17.4l3.8-7.2h4.6l2.4 7.2M10.4 10.2h5M15 10.2l-.9-2.6h-2.3",
  },
  {
    name: "balloon",
    fill: "M12 2.2c-4 0-7.2 3.1-7.2 7 0 3.4 3.1 6.9 5.4 9.1h3.6c2.3-2.2 5.4-5.7 5.4-9.1 0-3.9-3.2-7-7.2-7Z M10.2 19.4h3.6v2.3h-3.6Z",
  },
];

export const ROWS: RowMeta[] = [
  {
    name: "Letters",
    color: "#b45309",
    soft: "#fef3c7",
    glyphs: ["A", "B", "C", "D", "E", "F"].map((text) => ({ name: text, text })),
  },
  {
    name: "Dice",
    color: "#047857",
    soft: "#d1fae5",
    glyphs: ["one", "two", "three", "four", "five", "six"].map((name, index) => ({
      name,
      pips: index + 1,
    })),
  },
  { name: "Shapes", color: "#be123c", soft: "#ffe4e6", glyphs: SHAPES },
  { name: "Symbols", color: "#334155", soft: "#e2e8f0", glyphs: SYMBOLS },
  { name: "Things", color: "#0369a1", soft: "#e0f2fe", glyphs: THINGS },
  { name: "Travel", color: "#6d28d9", soft: "#ede9fe", glyphs: TRAVEL },
];

/** Pip layout in a 24x24 box, indexed by face value. */
export const DICE_PIPS: number[][][] = [
  [[12, 12]],
  [
    [8, 8],
    [16, 16],
  ],
  [
    [7.5, 7.5],
    [12, 12],
    [16.5, 16.5],
  ],
  [
    [8, 8],
    [16, 8],
    [8, 16],
    [16, 16],
  ],
  [
    [8, 8],
    [16, 8],
    [12, 12],
    [8, 16],
    [16, 16],
  ],
  [
    [8, 7],
    [16, 7],
    [8, 12],
    [16, 12],
    [8, 17],
    [16, 17],
  ],
];

export const tileName = (row: number, tile: number): string =>
  `${ROWS[row].name} ${ROWS[row].glyphs[tile].name}`;
