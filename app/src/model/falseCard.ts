import { shuffle, type Rng } from "./rng";
import { isDeducible, propagate, startPositions } from "./solver";
import type { Clue, Exclusion } from "./types";

/*
 * False-card puzzles: one card on the canvas is false, and the player is told
 * so. Everything else, the exclusions included, is true.
 *
 * The solver treats the false card as saying nothing. A player who reads "this
 * card is false" as "its opposite is true" knows more than that, so anything
 * the solver can work out, the player can too.
 */

/** True if propagation alone shows these clues cannot all hold. */
export function contradicts(clues: Clue[], size: number, exclusions: Exclusion[]): boolean {
  return !propagate(startPositions(size, exclusions), clues, size).ok;
}

const without = (clues: Clue[], index: number): Clue[] => clues.filter((_, i) => i !== index);

/**
 * Whether the player can work out which card is false and then solve the grid,
 * by deduction alone:
 *
 * - with `falseIndex` set aside, the other cards solve the grid; and
 * - for every other card, supposing that one were the false card, and so
 *   trusting `falseIndex` instead, leads to a contradiction.
 *
 * So exactly one choice of false card is consistent, and it gives one grid.
 */
export function falseCardIsDeducible(
  clues: Clue[],
  falseIndex: number,
  size: number,
  exclusions: Exclusion[],
): boolean {
  if (!isDeducible(without(clues, falseIndex), size, exclusions)) return false;
  for (let j = 0; j < clues.length; j++) {
    if (j !== falseIndex && !contradicts(without(clues, j), size, exclusions)) return false;
  }
  return true;
}

/**
 * The smallest group of cards that cannot all be true, if one has at most
 * `maxSize` cards. This is what the player looks for first. Every such group
 * contains the false card, since the true cards all hold for the solution, so
 * finding one clears every card outside it.
 *
 * Found by trying every group of the false card plus up to `maxSize - 1`
 * others, smallest first. That is exhaustive, so the answer does not depend on
 * the order of the cards.
 */
export function smallestConflict(
  clues: Clue[],
  falseIndex: number,
  size: number,
  exclusions: Exclusion[],
  maxSize: number,
): number[] | null {
  const others = clues.map((_, i) => i).filter((i) => i !== falseIndex);
  const search = (chosen: number[], from: number, need: number): number[] | null => {
    if (need === 0) {
      const group = [falseIndex, ...chosen];
      return contradicts(
        group.map((i) => clues[i]),
        size,
        exclusions,
      )
        ? group
        : null;
    }
    for (let k = from; k < others.length; k++) {
      const found = search([...chosen, others[k]], k + 1, need - 1);
      if (found) return found;
    }
    return null;
  };
  for (let extra = 1; extra < maxSize; extra++) {
    const found = search([], 0, extra);
    if (found) return found;
  }
  return null;
}

export type FalseCardSetup = {
  /** True cards, with the false card among them at `falseIndex`. */
  clues: Clue[];
  falseIndex: number;
  exclusions: Exclusion[];
  /** Size of the smallest conflict group, false card included. */
  groupSize: number;
};

export type FalseCardOptions = {
  /** Largest conflict group accepted, false card included. */
  maxGroup: number;
  /** False cards tried before giving up on this puzzle. */
  attempts: number;
};

/**
 * Turns a minimal puzzle into a false-card puzzle, or returns null if none of
 * the offered false cards works.
 *
 * `minimal` must already solve the grid with `exclusions`. `candidates` are
 * clues false for the solution, and `pool` is true clues the generator may add
 * when a card on its own cannot be ruled out as the false one.
 */
export function addFalseCard(
  minimal: Clue[],
  exclusions: Exclusion[],
  candidates: Clue[],
  pool: Clue[],
  size: number,
  rng: Rng,
  { maxGroup, attempts }: FalseCardOptions,
): FalseCardSetup | null {
  for (const falseCard of candidates.slice(0, attempts)) {
    let clues = [...minimal, falseCard];
    let falseIndex = clues.length - 1;

    // A false card refuted by the exclusions alone, with no other card, is
    // found by reading the grid rather than the cards.
    if (contradicts([falseCard], size, exclusions)) continue;
    const group = smallestConflict(clues, falseIndex, size, exclusions, maxGroup);
    if (!group) continue;

    // Cards in the group are the only ones not cleared by the group itself.
    // Each needs the rest of the puzzle to rule it out as the false card; add
    // a true card where it does not.
    let repaired = true;
    for (const j of group) {
      if (j === falseIndex || contradicts(without(clues, j), size, exclusions)) continue;
      const rest = without(clues, j);
      const extra = shuffle(pool, rng).find(
        (clue) => !clues.includes(clue) && contradicts([...rest, clue], size, exclusions),
      );
      if (!extra) {
        repaired = false;
        break;
      }
      clues = [...clues, extra];
    }
    if (!repaired || !falseCardIsDeducible(clues, falseIndex, size, exclusions)) continue;

    // Minimise again under the full condition: any card or exclusion that can
    // go while the false card stays findable and the grid solvable, goes.
    const keep = clues.map(() => true);
    const live = () => clues.filter((_, k) => keep[k]);
    const liveFalseIndex = () => keep.slice(0, falseIndex).filter(Boolean).length;
    for (const index of shuffle(
      clues.map((_, i) => i),
      rng,
    )) {
      if (index === falseIndex) continue;
      keep[index] = false;
      if (!falseCardIsDeducible(live(), liveFalseIndex(), size, exclusions)) keep[index] = true;
    }
    falseIndex = liveFalseIndex();
    clues = live();

    let kept = exclusions;
    for (let i = kept.length - 1; i >= 0; i--) {
      const fewer = kept.filter((_, k) => k !== i);
      if (falseCardIsDeducible(clues, falseIndex, size, fewer)) kept = fewer;
    }

    const finalGroup = smallestConflict(clues, falseIndex, size, kept, maxGroup);
    if (!finalGroup) continue;
    return { clues, falseIndex, exclusions: kept, groupSize: finalGroup.length };
  }
  return null;
}
