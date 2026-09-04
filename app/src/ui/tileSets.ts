/**
 * Artwork for the tiles. Each row is one category of six symbols; the row's
 * colour is what makes a clue readable at a glance, so the six hues are kept
 * well apart.
 */
export type Glyph = {
  /** Rendered as centred text, for letters and numerals. */
  text?: string;
  /** Filled path in a 24x24 box. */
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

const SHAPES = [
  "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z",
  "M5 5h14v14H5Z",
  "M12 3.5 21 20H3Z",
  "M12 3 21 12 12 21 3 12Z",
  "M12 3 21.5 9.9 17.9 21H6.1L2.5 9.9Z",
  "M12 2.6 14.9 9.3 22.1 10 16.7 14.8 18.3 21.9 12 18.2 5.7 21.9 7.3 14.8 1.9 10 9.1 9.3Z",
];

const SYMBOLS: Glyph[] = [
  { fill: "M12 21C6.2 16.2 3 13.2 3 9.7A4.7 4.7 0 0 1 12 7.2 4.7 4.7 0 0 1 21 9.7c0 3.5-3.2 6.5-9 11.3Z" },
  { fill: "M15.4 2.6a9.2 9.2 0 1 0 6.1 15.7A7.3 7.3 0 0 1 15.4 2.6Z" },
  { fill: "M12 2.4c4.1 5.1 6.6 7.8 6.6 11.2a6.6 6.6 0 0 1-13.2 0C5.4 10.2 7.9 7.5 12 2.4Z" },
  { fill: "M13.6 2 5 13.6h5.4L9.4 22 19 10.4h-5.5L13.6 2Z" },
  { fill: "M20.5 3.2C10 3.2 4 8.6 4 15.4c0 1.8.4 3.3 1.1 4.5l1.5-1.5c1.8-5.8 5.9-9.1 9.9-10.9-3.7 2.5-6.9 6.1-8.6 11.6 9.1 2 12.6-5 12.6-15.9Z" },
  {
    fill: "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z",
    stroke: "M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1",
  },
];

export const ROWS: RowMeta[] = [
  {
    name: "Letters",
    color: "#b45309",
    soft: "#fef3c7",
    glyphs: ["A", "B", "C", "D", "E", "F"].map((text) => ({ text })),
  },
  {
    name: "Numbers",
    color: "#0369a1",
    soft: "#e0f2fe",
    glyphs: ["1", "2", "3", "4", "5", "6"].map((text) => ({ text })),
  },
  {
    name: "Numerals",
    color: "#6d28d9",
    soft: "#ede9fe",
    glyphs: ["I", "II", "III", "IV", "V", "VI"].map((text) => ({ text })),
  },
  {
    name: "Dice",
    color: "#047857",
    soft: "#d1fae5",
    glyphs: [1, 2, 3, 4, 5, 6].map((pips) => ({ pips })),
  },
  {
    name: "Shapes",
    color: "#be123c",
    soft: "#ffe4e6",
    glyphs: SHAPES.map((fill) => ({ fill })),
  },
  { name: "Symbols", color: "#334155", soft: "#e2e8f0", glyphs: SYMBOLS },
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

export const tileName = (row: number, tile: number): string => {
  const meta = ROWS[row];
  const glyph = meta.glyphs[tile];
  if (glyph.text) return `${meta.name} ${glyph.text}`;
  if (glyph.pips) return `${meta.name} ${glyph.pips}`;
  const shapeNames = ["circle", "square", "triangle", "diamond", "pentagon", "star"];
  const symbolNames = ["heart", "moon", "drop", "bolt", "leaf", "sun"];
  return `${meta.name} ${(meta.name === "Shapes" ? shapeNames : symbolNames)[tile]}`;
};
