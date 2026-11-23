import { describe, expect, it } from "vitest";
import { cardFrame } from "./cardStyle";

const none = { highlight: [], peeked: new Set<number>(), revealedFalse: null, accused: null };

describe("cardFrame", () => {
  it("rings a hinted card over a peeked one", () => {
    expect(cardFrame(1, { ...none, peeked: new Set([1]) }).ring).toBe("peek-ring rounded-lg");
    expect(cardFrame(1, { ...none, highlight: [1], peeked: new Set([1]) }).ring).toBe(
      "hint-ring rounded-lg",
    );
    expect(cardFrame(2, { ...none, highlight: [1] }).ring).toBe("");
  });

  it("outlines the revealed false card over the accused one", () => {
    expect(cardFrame(3, none).outline).toBeUndefined();
    expect(cardFrame(3, { ...none, accused: 3 }).outline).toBe("2px solid rgb(251 113 133)");
    expect(cardFrame(3, { ...none, accused: 3, revealedFalse: 3 }).outline).toBe(
      "2px solid rgb(225 29 72)",
    );
  });
});
