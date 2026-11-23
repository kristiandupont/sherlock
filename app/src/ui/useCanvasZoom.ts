import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { fitZoom, type Point, type Size } from "./clueLayout";

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 1.25;

export type CanvasZoom = {
  zoom: number;
  /** Converts a screen point to canvas coordinates, allowing for scroll and zoom. */
  toCanvas: (clientX: number, clientY: number) => Point;
  /** One step in, holding the middle of the view still. */
  zoomIn: () => void;
  /** One step out, holding the middle of the view still. */
  zoomOut: () => void;
  /** The largest zoom that shows every card, scrolled to the top-left corner. */
  fit: () => void;
};

/**
 * The zoom of the scrolling element `surfaceRef`, whose cards cover `content`.
 * Ctrl or ⌘ with the wheel zooms about the pointer.
 */
export function useCanvasZoom(surfaceRef: RefObject<HTMLDivElement>, content: Size): CanvasZoom {
  const [zoom, setZoom] = useState(1);
  /** Scroll position to restore after a zoom, keeping a chosen point still. */
  const anchoredScroll = useRef<{ left: number; top: number } | null>(null);

  const toCanvas = useCallback(
    (clientX: number, clientY: number): Point => {
      const surface = surfaceRef.current;
      if (!surface) return { x: 0, y: 0 };
      const rect = surface.getBoundingClientRect();
      return {
        x: (clientX - rect.left + surface.scrollLeft) / zoom,
        y: (clientY - rect.top + surface.scrollTop) / zoom,
      };
    },
    [zoom, surfaceRef],
  );

  /** Changes the zoom while holding one screen point still under the pointer. */
  const applyZoom = useCallback(
    (next: number, anchor: Point | null) => {
      const surface = surfaceRef.current;
      if (!surface) return;
      const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
      if (clamped === zoom) return;
      const rect = surface.getBoundingClientRect();
      // The point to hold still, as an offset into the viewport.
      const at = anchor
        ? { x: anchor.x - rect.left, y: anchor.y - rect.top }
        : { x: rect.width / 2, y: rect.height / 2 };
      const fixed = {
        x: (surface.scrollLeft + at.x) / zoom,
        y: (surface.scrollTop + at.y) / zoom,
      };
      anchoredScroll.current = { left: fixed.x * clamped - at.x, top: fixed.y * clamped - at.y };
      setZoom(clamped);
    },
    [zoom, surfaceRef],
  );

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const anchored = anchoredScroll.current;
    if (!surface || !anchored) return;
    surface.scrollLeft = Math.max(0, anchored.left);
    surface.scrollTop = Math.max(0, anchored.top);
    anchoredScroll.current = null;
  }, [zoom, surfaceRef]);

  // Attached by hand because React's onWheel cannot call preventDefault, and
  // without that the browser zooms the whole page instead.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      applyZoom(zoom * Math.exp(-event.deltaY / 500), { x: event.clientX, y: event.clientY });
    };
    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, [applyZoom, zoom, surfaceRef]);

  const fit = () => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const next = fitZoom(
      content,
      { width: surface.clientWidth, height: surface.clientHeight },
      ZOOM_MIN,
      ZOOM_MAX,
    );
    // Not routed through applyZoom: that anchors on a point, while fitting
    // always ends at the top-left corner. Fitting when already at the fitted
    // zoom changes no state, so there is no re-render to scroll from either.
    if (next === zoom) {
      surface.scrollTo({ left: 0, top: 0 });
      return;
    }
    anchoredScroll.current = { left: 0, top: 0 };
    setZoom(next);
  };

  return {
    zoom,
    toCanvas,
    zoomIn: () => applyZoom(zoom * ZOOM_STEP, null),
    zoomOut: () => applyZoom(zoom / ZOOM_STEP, null),
    fit,
  };
}
