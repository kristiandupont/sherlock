import { DICE_PIPS, ROWS, tileName } from "./tileSets";

type Props = {
  row: number;
  tile: number;
  /** Rendered size in pixels. */
  size?: number;
  /** Draw the row's background tint behind the glyph. */
  filled?: boolean;
  className?: string;
};

export function TileGlyph({ row, tile, size = 24, filled = false, className }: Props) {
  const meta = ROWS[row];
  const glyph = meta.glyphs[tile];
  const radius = Math.max(2, size * 0.16);

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={tileName(row, tile)}
      style={{ color: meta.color, display: "block" }}
    >
      {filled && <rect x="0" y="0" width="24" height="24" rx={(radius / size) * 24} fill={meta.soft} />}
      {glyph.text && (
        <text
          x="12"
          y="12.8"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={glyph.text.length > 2 ? 9.5 : glyph.text.length > 1 ? 12 : 15}
          fontWeight="700"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fill="currentColor"
        >
          {glyph.text}
        </text>
      )}
      {glyph.pips !== undefined && (
        <>
          <rect
            x="3.2"
            y="3.2"
            width="17.6"
            height="17.6"
            rx="3.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          {DICE_PIPS[glyph.pips - 1].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="1.7" fill="currentColor" />
          ))}
        </>
      )}
      {glyph.fill && <path d={glyph.fill} fill="currentColor" />}
      {glyph.stroke && (
        <path
          d={glyph.stroke}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
