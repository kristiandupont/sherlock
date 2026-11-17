import { describe, expect, it } from "vitest";
import {
  accuse,
  addSuspects,
  clearSuspect,
  isWrongAccusation,
  noSuspects,
  restoreSuspects,
  verdict,
  withdrawWrongAccusation,
} from "./suspects";

describe("suspects", () => {
  it("adds cards in order, without repeats", () => {
    const one = addSuspects(noSuspects, [4, 2]);
    expect(addSuspects(one, [2, 7]).cards).toEqual([4, 2, 7]);
  });

  it("accuses one card at a time, and only a card in the strip", () => {
    let s = addSuspects(noSuspects, [4, 2]);
    expect(accuse(s, 9).accused).toBeNull();
    s = accuse(s, 4);
    expect(s.accused).toBe(4);
    s = accuse(s, 2);
    expect(s.accused).toBe(2);
    expect(accuse(s, 2).accused).toBeNull();
  });

  it("withdraws the accusation when the accused card leaves the strip", () => {
    const s = accuse(addSuspects(noSuspects, [4, 2]), 4);
    expect(clearSuspect(s, 2)).toEqual({ cards: [4], accused: 4 });
    expect(clearSuspect(s, 4)).toEqual({ cards: [2], accused: null });
  });

  it("gives a verdict on the accusation", () => {
    const s = addSuspects(noSuspects, [4, 2]);
    expect(verdict(s, 4)).toBe("none");
    expect(verdict(accuse(s, 4), 4)).toBe("found");
    expect(verdict(accuse(s, 2), 4)).toBe("wrong");
  });

  it("counts accusing a true card as a mistake, and only that", () => {
    const s = addSuspects(noSuspects, [4, 2]);
    expect(isWrongAccusation(s, 4)).toBe(false);
    expect(isWrongAccusation(accuse(s, 4), 4)).toBe(false);
    expect(isWrongAccusation(accuse(s, 2), 4)).toBe(true);
    // A puzzle without a false card has nothing to accuse wrongly.
    expect(isWrongAccusation(accuse(s, 2), null)).toBe(false);
  });

  it("withdraws a wrong accusation and keeps a right one", () => {
    const s = addSuspects(noSuspects, [4, 2]);
    expect(withdrawWrongAccusation(accuse(s, 2), 4)).toEqual({ cards: [4, 2], accused: null });
    expect(withdrawWrongAccusation(accuse(s, 4), 4)).toEqual({ cards: [4, 2], accused: 4 });
  });

  it("drops whatever in a save does not fit the puzzle", () => {
    expect(restoreSuspects(undefined, 10)).toEqual(noSuspects);
    expect(restoreSuspects({ cards: [3, 3, 12, -1, 1.5, 5], accused: 12 }, 10)).toEqual({
      cards: [3, 5],
      accused: null,
    });
    expect(restoreSuspects({ cards: [3, 5], accused: 5 }, 10)).toEqual({ cards: [3, 5], accused: 5 });
  });
});
