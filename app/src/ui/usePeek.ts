import { useCallback, useEffect, useState } from "react";
import type { TileRef } from "../model/types";

/**
 * Tracks the tile under the pointer and whether Alt is held. The peek is only
 * on while both are true, so hovering alone never changes the canvas and the
 * player has to ask for it.
 *
 * Alt is read from the keyboard rather than from pointer events, so pressing it
 * while the pointer is already resting on a tile turns the peek on without the
 * pointer having to move.
 */
export function usePeek() {
  const [altHeld, setAltHeld] = useState(false);
  const [hovered, setHovered] = useState<TileRef | null>(null);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "Alt") setAltHeld(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.key !== "Alt") return;
      setAltHeld(false);
      // A bare Alt press and release opens the menu bar in Firefox and in
      // browsers on Windows, which takes keyboard focus away from the page.
      event.preventDefault();
    };
    // Switching windows with Alt held (Alt-Tab) sends no keyup to this page.
    const reset = () => setAltHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
    };
  }, []);

  const hoverTile = useCallback((tile: TileRef | null) => setHovered(tile), []);

  return { peekTile: altHeld ? hovered : null, hoverTile };
}
