import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Clue } from "../model/types";
import { ClueCard } from "./ClueCard";
import { cardSize, type Point } from "./clueLayout";

type Props = {
  clues: Clue[];
  positions: Point[];
  used: boolean[];
  /** Called once a drag finishes, not on every pointer move. */
  onMove: (index: number, point: Point) => void;
  onToggleUsed: (index: number) => void;
  /** Index of the clue the hint points at, ringed and scrolled into view. */
  highlight: number | null;
};

type Drag = {
  index: number;
  /** Card position when the drag started. */
  origin: Point;
  pointerStart: Point;
  current: Point;
  moved: boolean;
};

const DRAG_THRESHOLD = 4;

export function ClueCanvas({ clues, positions, used, onMove, onToggleUsed, highlight }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [order, setOrder] = useState<number[]>(() => clues.map((_, i) => i));
  const surfaceRef = useRef<HTMLDivElement>(null);

  const positionOf = (index: number): Point =>
    drag?.index === index ? drag.current : (positions[index] ?? { x: 0, y: 0 });

  const contentSize = useMemo(() => {
    let width = 0;
    let height = 0;
    clues.forEach((clue, index) => {
      const point = positions[index] ?? { x: 0, y: 0 };
      const box = cardSize(clue);
      width = Math.max(width, point.x + box.width);
      height = Math.max(height, point.y + box.height);
    });
    return { width: width + 24, height: height + 24 };
  }, [clues, positions]);

  useEffect(() => {
    if (highlight === null) return;
    surfaceRef.current
      ?.querySelector(`[data-clue-index="${highlight}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [highlight]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, index: number) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setOrder((previous) => [...previous.filter((i) => i !== index), index]);
      const origin = positions[index] ?? { x: 0, y: 0 };
      setDrag({
        index,
        origin,
        pointerStart: { x: event.clientX, y: event.clientY },
        current: origin,
        moved: false,
      });
    },
    [positions],
  );

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    setDrag((previous) => {
      if (!previous) return previous;
      const dx = event.clientX - previous.pointerStart.x;
      const dy = event.clientY - previous.pointerStart.y;
      const moved =
        previous.moved || Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD;
      if (!moved) return previous;
      return {
        ...previous,
        moved,
        current: { x: Math.max(0, previous.origin.x + dx), y: Math.max(0, previous.origin.y + dy) },
      };
    });
  }, []);

  // The committing callbacks run here rather than inside a setDrag updater:
  // React runs updaters during the render phase, where calling the parent's
  // setState is not allowed.
  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      if (!drag) return;
      if (drag.moved) onMove(drag.index, drag.current);
      else onToggleUsed(drag.index);
      setDrag(null);
    },
    [drag, onMove, onToggleUsed],
  );

  return (
    <div
      ref={surfaceRef}
      className="relative h-full w-full overflow-auto rounded-lg bg-slate-100"
      style={{
        backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }}
    >
      <div
        className="relative"
        style={{ width: Math.max(contentSize.width, 1), height: Math.max(contentSize.height, 1), minWidth: "100%", minHeight: "100%" }}
      >
        {clues.map((clue, index) => {
          const point = positionOf(index);
          const dragging = drag?.index === index && drag.moved;
          const hinted = highlight === index;
          return (
            <div
              key={index}
              data-clue-index={index}
              className={`absolute touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"} ${
                hinted ? "hint-ring rounded-lg" : ""
              }`}
              style={{
                left: point.x,
                top: point.y,
                zIndex: order.indexOf(index) + 1,
                transform: dragging ? "scale(1.04)" : undefined,
                filter: dragging ? "drop-shadow(0 6px 12px rgb(15 23 42 / 0.25))" : undefined,
              }}
              onPointerDown={(event) => handlePointerDown(event, index)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(event) => {
                event.preventDefault();
                onToggleUsed(index);
              }}
            >
              <ClueCard clue={clue} used={(used[index] ?? false) && !hinted} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
