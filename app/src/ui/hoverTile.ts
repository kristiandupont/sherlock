import { createContext } from "react";
import type { TileRef } from "../model/types";

/**
 * Receives the tile under the pointer on a card, for the Alt peek. A context
 * rather than a prop because every card body draws its tiles through `Cell`,
 * and passing a callback into each of the nine bodies would only repeat it.
 * Cards drawn in the help have no provider, so their tiles report nothing.
 */
export const HoverTileContext = createContext<((tile: TileRef | null) => void) | null>(null);
