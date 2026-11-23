import type { PointerEvent } from "react";
import type { Point } from "./clueLayout";

/** Pointer travel, in screen pixels, before a press counts as a drag. */
export const DRAG_THRESHOLD = 4;

/** Whether the pointer has travelled from `start` far enough to count as a drag. */
export const pastThreshold = (start: Point, pointer: Point): boolean =>
  Math.abs(pointer.x - start.x) > DRAG_THRESHOLD || Math.abs(pointer.y - start.y) > DRAG_THRESHOLD;

/** Whether the screen point `at` lies inside `rect`, edges included. */
export const within = (rect: DOMRect | undefined, at: Point): boolean =>
  !!rect && at.x >= rect.left && at.x <= rect.right && at.y >= rect.top && at.y <= rect.bottom;

/** Whether the screen point `at` lies over `element`. False when there is no element. */
export const isOver = (element: Element | null | undefined, at: Point): boolean =>
  within(element?.getBoundingClientRect(), at);

/** Releases the pointer capture taken when the press began, if it is still held. */
export function releaseCapture(event: PointerEvent<Element>): void {
  if (event.currentTarget.hasPointerCapture(event.pointerId))
    event.currentTarget.releasePointerCapture(event.pointerId);
}
