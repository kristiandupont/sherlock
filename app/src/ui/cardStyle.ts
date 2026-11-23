/** The shadow under a card that is being carried. */
export const LIFTED_SHADOW = "drop-shadow(0 6px 12px rgb(15 23 42 / 0.25))";

/**
 * Ring and outline for card `index`, the same on the canvas and in the strip.
 * `ring` is a class name for the hint or peek ring; `outline` is a CSS outline
 * marking the false card once it is revealed, or the accused card before that.
 */
export function cardFrame(
  index: number,
  {
    highlight,
    peeked,
    revealedFalse,
    accused,
  }: {
    highlight: readonly number[];
    peeked: ReadonlySet<number>;
    revealedFalse: number | null;
    accused: number | null;
  },
): { ring: string; outline: string | undefined } {
  return {
    ring: highlight.includes(index)
      ? "hint-ring rounded-lg"
      : peeked.has(index)
        ? "peek-ring rounded-lg"
        : "",
    outline:
      index === revealedFalse
        ? "2px solid rgb(225 29 72)"
        : accused === index
          ? "2px solid rgb(251 113 133)"
          : undefined,
  };
}
