/**
 * What a card shows on top of itself: a strike when it is accused, and once
 * the grid is solved, which card was false and whether the accusation was
 * right. Used by the canvas and the strip, so a card says the same wherever it
 * is.
 */
export function CardOverlays({
  index,
  accused,
  revealedFalse,
}: {
  index: number;
  /** The accused card, or null. */
  accused: number | null;
  /** The false card, once the puzzle is solved and it can be shown. */
  revealedFalse: number | null;
}) {
  const isAccused = accused === index;
  const cleared = revealedFalse !== null && isAccused && index !== revealedFalse;
  return (
    <>
      {isAccused && (
        <svg
          data-accused
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <line
            x1="6"
            y1="94"
            x2="94"
            y2="6"
            stroke="rgb(225 29 72)"
            strokeWidth="4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={cleared ? 0.35 : 0.85}
          />
        </svg>
      )}
      {index === revealedFalse && (
        <span
          data-false-card
          className="pointer-events-none absolute -right-2 -top-2 rounded bg-rose-600 px-1 text-[10px] font-semibold uppercase tracking-wide text-white"
        >
          false
        </span>
      )}
      {cleared && (
        <span className="pointer-events-none absolute -right-2 -top-2 rounded bg-slate-500 px-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          true
        </span>
      )}
    </>
  );
}
