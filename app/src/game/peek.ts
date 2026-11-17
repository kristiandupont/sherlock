import { clueTiles, type Clue, type TileRef } from "../model/types";

/**
 * Indices of the clues that mention `tile`, which is what holding Alt over a
 * tile rings on the canvas. It says nothing about what those clues imply, only
 * where the tile appears, so it is a weaker aid than Hint and is not counted.
 */
export function cluesMentioning(clues: Clue[], tile: TileRef): number[] {
  const indices: number[] = [];
  clues.forEach((clue, index) => {
    if (clueTiles(clue).some((ref) => ref.row === tile.row && ref.tile === tile.tile)) {
      indices.push(index);
    }
  });
  return indices;
}
