import type { Clue, TileRef } from "../model/types";
import { TileGlyph } from "./TileGlyph";
import { cardSize, describeClue } from "./clueLayout";

const GLYPH = 30;

/**
 * Visual grammar: tiles drawn touching each other occupy neighbouring columns,
 * tiles stacked vertically share a column, and a dashed arrow means "somewhere
 * further right" with any distance in between.
 */
const Cell = ({ of, tinted }: { of: TileRef; tinted?: boolean }) => (
  <div className={`px-1 py-0.5 ${tinted ? "bg-slate-100" : ""}`}>
    <TileGlyph row={of.row} tile={of.tile} size={GLYPH} />
  </div>
);

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-stretch divide-x divide-slate-300 overflow-hidden rounded border border-slate-300">
    {children}
  </div>
);

const Column = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col divide-y divide-slate-300 overflow-hidden rounded border border-slate-300">
    {children}
  </div>
);

/** One way only: this pair is adjacent and in this order. */
const ThisWayRound = () => (
  <svg width="20" height="9" viewBox="0 0 20 9" className="text-slate-400">
    <path d="M2 4.5h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M14 1.5l4 3-4 3Z" fill="currentColor" />
  </svg>
);

/** A miniature of the row, with the two columns the tile could be in marked. */
const Ends = ({ size }: { size: number }) => (
  <div className="flex gap-px">
    {Array.from({ length: size }, (_, column) => (
      <div
        key={column}
        className={`h-2.5 w-1.5 rounded-[1px] ${
          column === 0 || column === size - 1 ? "bg-slate-500" : "bg-slate-200"
        }`}
      />
    ))}
  </div>
);

/** Either order: the pair is adjacent but which one is on the left is unknown. */
const EitherOrder = () => (
  <svg width="20" height="9" viewBox="0 0 20 9" className="text-slate-400">
    <path d="M4.5 4.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M5 1.5 1 4.5l4 3Z" fill="currentColor" />
    <path d="M15 1.5l4 3-4 3Z" fill="currentColor" />
  </svg>
);

const FarRight = () => (
  <svg width="22" height="12" viewBox="0 0 22 12" className="text-slate-400">
    <path
      d="M1 6h15"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeDasharray="2 2.4"
      strokeLinecap="round"
    />
    <path d="M15 2.5 20.5 6 15 9.5Z" fill="currentColor" />
  </svg>
);

const NotSame = () => (
  <svg width="30" height="14" viewBox="0 0 30 14" className="text-rose-500">
    <path d="M11 3.5l8 7M19 3.5l-8 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export function ClueCard({
  clue,
  used,
  size,
}: {
  clue: Clue;
  used: boolean;
  /** Columns on the board, for the clue that draws a miniature of a row. */
  size: number;
}) {
  const { width, height } = cardSize(clue);

  const body = () => {
    switch (clue.kind) {
      case "same-column":
        return (
          <Column>
            <Cell of={clue.a} />
            <Cell of={clue.b} />
          </Column>
        );
      case "different-column":
        return (
          <div className="flex flex-col items-center">
            <Cell of={clue.a} />
            <NotSame />
            <Cell of={clue.b} />
          </div>
        );
      case "adjacent":
        return (
          <div className="flex flex-col items-center gap-0.5">
            <Row>
              <Cell of={clue.a} />
              <Cell of={clue.b} />
            </Row>
            <EitherOrder />
          </div>
        );
      case "left-of":
        return (
          <div className="flex items-center gap-1">
            <Cell of={clue.left} />
            <FarRight />
            <Cell of={clue.right} />
          </div>
        );
      case "between":
        return (
          <div className="flex flex-col items-center gap-0.5">
            <Row>
              <Cell of={clue.a} />
              <Cell of={clue.middle} tinted />
              <Cell of={clue.b} />
            </Row>
            <EitherOrder />
          </div>
        );
      case "immediately-left-of":
        return (
          <div className="flex flex-col items-center gap-0.5">
            <Row>
              <Cell of={clue.left} />
              <Cell of={clue.right} />
            </Row>
            <ThisWayRound />
          </div>
        );
      case "apart":
        // The same card as `adjacent`, with the columns that stand between the
        // pair drawn as empty cells. A bare number could not say whether it
        // counted the columns between them or the distance from one to the
        // other.
        return (
          <div className="flex flex-col items-center gap-0.5">
            <Row>
              <Cell of={clue.a} />
              {Array.from({ length: clue.distance - 1 }, (_, column) => (
                <div key={column} className="w-3 self-stretch bg-slate-100" />
              ))}
              <Cell of={clue.b} />
            </Row>
            <EitherOrder />
          </div>
        );
      case "at-an-end":
        return (
          <div className="flex flex-col items-center gap-1.5">
            <Cell of={clue.a} />
            <Ends size={size} />
          </div>
        );
      case "next-to-either":
        return (
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              <Cell of={clue.a} />
              <div className="flex items-center gap-1 rounded border border-dashed border-slate-400 px-1">
                <Cell of={clue.b} />
                <span className="text-[10px] italic text-slate-400">or</span>
                <Cell of={clue.c} />
              </div>
            </div>
            <EitherOrder />
          </div>
        );
    }
  };

  return (
    <div
      className={`flex items-center justify-center rounded-lg border bg-white shadow-sm transition ${
        used ? "border-slate-200 opacity-35 grayscale" : "border-slate-300"
      }`}
      style={{ width, height }}
      title={describeClue(clue)}
      aria-label={describeClue(clue)}
    >
      {body()}
    </div>
  );
}
