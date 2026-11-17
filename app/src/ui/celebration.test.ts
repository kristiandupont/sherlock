import { describe, expect, it } from "vitest";
import { volleysFor } from "./celebration";

const total = (hints: number) =>
  volleysFor(hints).reduce((sum, volley) => sum + volley.pieces, 0);

describe("volleysFor", () => {
  it("throws fewer pieces with every hint used, until the minimum", () => {
    for (let hints = 1; hints <= 5; hints++)
      expect(total(hints), `${hints} hints`).toBeLessThan(total(hints - 1));
  });

  it("still fires one small volley from the centre however many hints were used", () => {
    for (const hints of [5, 6, 20, 1000]) {
      const volleys = volleysFor(hints);
      expect(volleys).toHaveLength(1);
      expect(volleys[0].cannon).toBe("centre");
      expect(volleys[0].pieces).toBeGreaterThan(0);
    }
  });

  it("finishes firing early enough for the last pieces to fall before the canvas clears", () => {
    // A piece is back below the bottom edge about 2.5 s after it is fired, and
    // the run lasts 5.6 s, so nothing should be fired after 2 s.
    for (let hints = 0; hints <= 6; hints++)
      for (const volley of volleysFor(hints)) expect(volley.at).toBeLessThanOrEqual(2000);
  });
});
