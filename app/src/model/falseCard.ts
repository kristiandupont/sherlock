import { shuffle, type Rng } from "./rng";
import { isDeducible, propagate, startPositions, type PosMask } from "./solver";
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
 * Every smallest group of cards that cannot all be true, if the smallest has at
 * most `maxSize` cards. This is what the player looks for first. Every such
 * group contains the false card, since the true cards all hold for the
 * solution, so finding one clears every card outside it.
 *
 * Found by trying every group of the false card plus up to `maxSize - 1`
 * others, smallest first. That is exhaustive, so the answer does not depend on
 * the order of the cards. Empty when no group is small enough.
 *
 * Each group is propagated starting from where its first cards already led,
 * rather than from an open grid. Propagation only ever narrows, so the result
 * is the same either way, and the shared start saves most of the work.
 */
export function conflictGroups(
  clues: Clue[],
  falseIndex: number,
  size: number,
  exclusions: Exclusion[],
  maxSize: number,
): number[][] {
  const others = clues.map((_, i) => i).filter((i) => i !== falseIndex);
  const start = startPositions(size, exclusions);
  if (!propagate(start, [clues[falseIndex]], size).ok) return [[falseIndex]];

  for (let extra = 1; extra < maxSize; extra++) {
    const found: number[][] = [];
    /** `pos` is where the false card and `chosen` already lead, with no contradiction. */
    const search = (chosen: number[], from: number, pos: PosMask) => {
      for (let k = from; k < others.length; k++) {
        const group = [...chosen, others[k]];
        const next = Int32Array.from(pos);
        const cards = [falseIndex, ...group].map((i) => clues[i]);
        const ok = propagate(next, cards, size).ok;
        if (group.length === extra) {
          if (!ok) found.push([falseIndex, ...group]);
        } else if (ok) {
          // A group that already contradicts with fewer cards was found at
          // the smaller size, so nothing larger built on it is wanted.
          search(group, k + 1, next);
        }
      }
    };
    search([], 0, start);
    if (found.length > 0) return found;
  }
  return [];
}

/** The first of `conflictGroups`, or null when there is none within `maxSize`. */
export function smallestConflict(
  clues: Clue[],
  falseIndex: number,
  size: number,
  exclusions: Exclusion[],
  maxSize: number,
): number[] | null {
  return conflictGroups(clues, falseIndex, size, exclusions, maxSize)[0] ?? null;
}

/**
 * The grid the player reaches by trusting every card outside `group`: all of
 * them, with the exclusions, propagated as far as they go. Null if they
 * contradict, which cannot happen when the false card is in the group.
 */
export function trustedGrid(
  clues: Clue[],
  group: readonly number[],
  size: number,
  exclusions: Exclusion[],
): PosMask | null {
  const pos = startPositions(size, exclusions);
  const trusted = clues.filter((_, i) => !group.includes(i));
  return propagate(pos, trusted, size).ok ? pos : null;
}

/**
 * Whether the false card, on its own, contradicts the grid that the cards
 * outside `group` give. Then the player can tell which suspect is false by
 * holding each one up against that grid, with nothing supposed. The other
 * suspects never contradict it: they are true, and propagation never removes
 * the solution.
 */
export function falseCardStandsOut(
  clues: Clue[],
  falseIndex: number,
  group: readonly number[],
  size: number,
  exclusions: Exclusion[],
): boolean {
  const grid = trustedGrid(clues, group, size, exclusions);
  return grid !== null && !propagate(grid, [clues[falseIndex]], size).ok;
}

/**
 * Whether a false-card puzzle can be played without guessing:
 *
 * - with the false card set aside, the other cards solve the grid;
 * - a group of at most `maxGroup` cards cannot all be true; and
 * - for every smallest such group, whichever one the player finds, the false
 *   card contradicts the grid the cards outside it give.
 *
 * The second and third conditions rule every other card out as the false one:
 * a card outside the group because the group cannot all be true, and a card in
 * it because the false card visibly fails. Returns the groups, or null.
 */
export function falseCardIsFair(
  clues: Clue[],
  falseIndex: number,
  size: number,
  exclusions: Exclusion[],
  maxGroup: number,
): number[][] | null {
  if (!isDeducible(without(clues, falseIndex), size, exclusions)) return null;
  const groups = conflictGroups(clues, falseIndex, size, exclusions, maxGroup);
  if (groups.length === 0) return null;
  const fair = groups.every((group) =>
    falseCardStandsOut(clues, falseIndex, group, size, exclusions),
  );
  return fair ? groups : null;
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

/** Times the generator adds a true card before giving up on a false card. */
const MAX_REPAIRS = 4;

/**
 * Turns a minimal puzzle into a false-card puzzle, or returns null if none of
 * the offered false cards works.
 *
 * `minimal` must already solve the grid with `exclusions`. `candidates` are
 * clues false for the solution, and `pool` is true clues the generator may add
 * when the trusted cards do not yet narrow the grid enough for the false card
 * to fail against it.
 */
export function addFalseCard(
  minimal: Clue[],
  exclusions: Exclusion[],
  candidates: Iterable<Clue>,
  pool: Clue[],
  size: number,
  rng: Rng,
  { maxGroup, attempts }: FalseCardOptions,
): FalseCardSetup | null {
  let tried = 0;
  for (const falseCard of candidates) {
    if (tried++ >= attempts) break;
    // A false card refuted by the exclusions alone, with no other card, is
    // found by reading the grid rather than the cards.
    if (contradicts([falseCard], size, exclusions)) continue;

    let clues = [...minimal, falseCard];
    let falseIndex = clues.length - 1;
    const fair = (cards: Clue[], index: number, excl: Exclusion[]) =>
      falseCardIsFair(cards, index, size, excl, maxGroup);

    // The cards without the false one must solve the grid. Adding true cards
    // below keeps that so, so it is checked once.
    if (!isDeducible(minimal, size, exclusions)) continue;

    // Add true cards outside the group until the grid they give is narrow
    // enough for the false card to fail against it. Each round searches for
    // the groups once; the search is most of the cost of building a puzzle.
    let groups = conflictGroups(clues, falseIndex, size, exclusions, maxGroup);
    for (let repair = 0; groups.length > 0; repair++) {
      const failing = groups.find(
        (group) => !falseCardStandsOut(clues, falseIndex, group, size, exclusions),
      );
      if (!failing) break;
      if (repair === MAX_REPAIRS) {
        groups = [];
        break;
      }
      const trusted = clues.filter((_, i) => !failing.includes(i));
      const grid = trustedGrid(clues, failing, size, exclusions);
      const extra =
        grid &&
        shuffle(pool, rng).find((clue) => {
          if (clues.includes(clue)) return false;
          const narrowed = Int32Array.from(grid);
          return (
            propagate(narrowed, [...trusted, clue], size).ok &&
            !propagate(narrowed, [falseCard], size).ok
          );
        });
      if (!extra) {
        groups = [];
        break;
      }
      clues = [...clues, extra];
      groups = conflictGroups(clues, falseIndex, size, exclusions, maxGroup);
    }
    if (groups.length === 0) continue;

    // Minimise again under the full condition: any card or exclusion that can
    // go while the puzzle stays fair, goes. Indices stay those of `clues`
    // throughout, with `keep` marking what is left.
    const keep = clues.map(() => true);
    const liveIndices = () => clues.map((_, i) => i).filter((i) => keep[i]);

    /**
     * The fairness check for the cards still kept, given the smallest groups
     * they might have. Taking information away never creates a smaller group,
     * so when some of `known` survive, they are all the smallest groups there
     * are, and the exhaustive search is needed only when none does.
     */
    const stillFair = (known: number[][], excl: Exclusion[]): number[][] | null => {
      const indices = liveIndices();
      const cards = indices.map((i) => clues[i]);
      const at = indices.indexOf(falseIndex);
      if (!isDeducible(without(cards, at), size, excl)) return null;
      const local = (group: number[]) => group.map((i) => indices.indexOf(i));
      let candidates = known.filter(
        (group) =>
          group.every((i) => keep[i]) &&
          contradicts(
            group.map((i) => clues[i]),
            size,
            excl,
          ),
      );
      if (candidates.length === 0) {
        candidates = conflictGroups(cards, at, size, excl, maxGroup).map((group) =>
          group.map((k) => indices[k]),
        );
        if (candidates.length === 0) return null;
      }
      const fairNow = candidates.every((group) =>
        falseCardStandsOut(cards, at, local(group), size, excl),
      );
      return fairNow ? candidates : null;
    };

    for (const index of shuffle(
      clues.map((_, i) => i),
      rng,
    )) {
      if (index === falseIndex) continue;
      keep[index] = false;
      const next = stillFair(groups, exclusions);
      if (next) groups = next;
      else keep[index] = true;
    }

    let kept = exclusions;
    for (let i = kept.length - 1; i >= 0; i--) {
      const fewer = kept.filter((_, k) => k !== i);
      const next = stillFair(groups, fewer);
      if (next) {
        kept = fewer;
        groups = next;
      }
    }

    falseIndex = keep.slice(0, falseIndex).filter(Boolean).length;
    clues = clues.filter((_, i) => keep[i]);

    // The full check once more on the result, as the shortcuts above rely on
    // reasoning rather than search.
    const finalGroups = fair(clues, falseIndex, kept);
    if (!finalGroups) continue;
    return { clues, falseIndex, exclusions: kept, groupSize: finalGroups[0].length };
  }
  return null;
}
