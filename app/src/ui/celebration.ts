/** Where on the bottom edge a volley is fired from. */
export type Cannon = "left" | "centre" | "right";

export type Volley = {
  cannon: Cannon;
  /** Milliseconds into the celebration at which the volley is fired. */
  at: number;
  /** How many pieces the volley throws. */
  pieces: number;
};

/** Both side cannons fire at each of these times, each with this many pieces. */
function sides(times: number[], pieces: number): Volley[] {
  return times.flatMap((at) => [
    { cannon: "left" as const, at, pieces },
    { cannon: "right" as const, at, pieces },
  ]);
}

/**
 * The volleys for a puzzle solved after this many hints (Go back included).
 * A clean solve gets the most. Each hint takes some away, down to one small
 * volley from the centre of the bottom edge, which every solve still gets.
 */
export function volleysFor(hintsUsed: number): Volley[] {
  switch (Math.max(0, Math.floor(hintsUsed))) {
    case 0:
      return [
        ...sides([0, 500, 1000, 1500], 90),
        { cannon: "centre", at: 250, pieces: 70 },
        { cannon: "centre", at: 1250, pieces: 70 },
      ];
    case 1:
      return sides([0, 600, 1200], 70);
    case 2:
      return sides([0, 600], 60);
    case 3:
      return sides([0], 50);
    case 4:
      return [{ cannon: "centre", at: 0, pieces: 50 }];
    default:
      return [{ cannon: "centre", at: 0, pieces: 25 }];
  }
}
