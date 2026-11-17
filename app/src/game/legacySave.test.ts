import { describe, expect, it } from "vitest";
import { REMOVE_AFTER } from "./legacySave";

describe("legacy save migration", () => {
  it("is removed once its date has passed", () => {
    expect(
      Date.now() < Date.parse(REMOVE_AFTER),
      `The v4 save migration was due for removal on ${REMOVE_AFTER}. ` +
        "Delete game/legacySave.ts, this test, and the LEGACY_STORAGE_KEY lines in App.tsx.",
    ).toBe(true);
  });
});
