/**
 * The suspects strip of a false-card puzzle: the cards the player has set
 * aside as possibly false, in the order they were added, and at most one of
 * them accused of being the false card. Like the cards' positions, none of this
 * is a move, so it stays off the undo history.
 */
export type Suspects = {
  /** Clue indices in the strip, oldest first. */
  cards: number[];
  /** The card accused of being false. Always one of `cards`, or null. */
  accused: number | null;
};

export const noSuspects: Suspects = { cards: [], accused: null };

/** Puts cards in the strip, after the ones already there. */
export function addSuspects(suspects: Suspects, indices: number[]): Suspects {
  const adding = indices.filter((index) => !suspects.cards.includes(index));
  if (adding.length === 0) return suspects;
  return { ...suspects, cards: [...suspects.cards, ...adding] };
}

/** Takes a card out of the strip. A card taken out is no longer accused. */
export function clearSuspect(suspects: Suspects, index: number): Suspects {
  if (!suspects.cards.includes(index)) return suspects;
  return {
    cards: suspects.cards.filter((card) => card !== index),
    accused: suspects.accused === index ? null : suspects.accused,
  };
}

/**
 * Accuses a card in the strip, which withdraws any earlier accusation, since
 * only one card is false. Accusing the accused card again withdraws it.
 */
export function accuse(suspects: Suspects, index: number): Suspects {
  if (!suspects.cards.includes(index)) return suspects;
  return { ...suspects, accused: suspects.accused === index ? null : index };
}

/** How the accusation stood when the grid was solved. */
export type Verdict = "found" | "wrong" | "none";

export function verdict(suspects: Suspects, falseClue: number): Verdict {
  if (suspects.accused === null) return "none";
  return suspects.accused === falseClue ? "found" : "wrong";
}

/**
 * Whether a true card stands accused. That is a mistake like ruling out a
 * symbol that belongs, so the wrong-turn notice treats it the same way.
 */
export const isWrongAccusation = (suspects: Suspects, falseClue: number | null): boolean =>
  falseClue !== null && suspects.accused !== null && suspects.accused !== falseClue;

/** Withdraws the accusation if it is wrong, which Go back does; a right one is kept. */
export const withdrawWrongAccusation = (suspects: Suspects, falseClue: number | null): Suspects =>
  isWrongAccusation(suspects, falseClue) ? { ...suspects, accused: null } : suspects;

/**
 * A saved strip, checked against the puzzle it is loaded for. Anything that
 * does not fit is dropped rather than trusted: indices out of range, repeats,
 * and an accusation of a card that is not in the strip.
 */
export function restoreSuspects(saved: unknown, clueCount: number): Suspects {
  if (typeof saved !== "object" || saved === null) return noSuspects;
  const { cards, accused } = saved as Partial<Suspects>;
  if (!Array.isArray(cards)) return noSuspects;
  const valid = [
    ...new Set(cards.filter((i) => Number.isInteger(i) && i >= 0 && i < clueCount)),
  ];
  return {
    cards: valid,
    accused: typeof accused === "number" && valid.includes(accused) ? accused : null,
  };
}
