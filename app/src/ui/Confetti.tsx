import { useEffect, useRef } from "react";
import { volleysFor, type Cannon } from "./celebration";
import { ROWS } from "./tileSets";

type Props = {
  /** Hints used on the puzzle, Go back included; fewer hints, more confetti. */
  hintsUsed: number;
  /** Called once the last piece has fallen, so the canvas can be unmounted. */
  onDone: () => void;
};

const DURATION_MS = 5600;
const FADE_FROM = 0.78;
/**
 * How far above the bottom edge the cannons sit. Firing from below the window
 * made every piece appear already moving fast, as if thrown from somewhere out
 * of sight; inside the window the player sees it leave the cannon.
 */
const CANNON_RISE = 36;
/**
 * Speeds, gravity and spin are given per tick, a 60th of a second, before
 * scaling to the window's height. A tick is only a unit of time: positions
 * are worked out from the elapsed time on every frame the browser draws,
 * so the confetti moves at the display's full frame rate and follows the
 * same path at 60 Hz, 120 Hz or any rate in between.
 */
const TICK_MS = 1000 / 60;
const GRAVITY = 0.32;
/** Share of its speed a piece keeps after one tick, from air resistance. */
const DRAG = 0.994;
/** The same drag as a rate: velocity decays as e^(-DRAG_RATE · ticks). */
const DRAG_RATE = -Math.log(DRAG);
const MIN_SPEED = 13;
const MAX_SPEED = 28;
/**
 * The highest a piece may climb, as a share of the distance from the cannons
 * to the top edge. Launch speeds are scaled to the window so that the fastest
 * piece fired straight up stops at this height.
 */
const PEAK_SHARE = 0.92;

/**
 * Distance travelled along one axis after `t` ticks, starting at speed `v0`
 * under a constant acceleration `a` (gravity on the vertical axis, 0 on the
 * horizontal one) and the drag above. This is the exact solution of
 * dv/dt = a − DRAG_RATE·v, so nothing is accumulated from frame to frame.
 */
function travel(v0: number, a: number, t: number): number {
  const terminal = a / DRAG_RATE;
  return terminal * t + ((v0 - terminal) * (1 - Math.exp(-DRAG_RATE * t))) / DRAG_RATE;
}

/** How high a piece fired straight up at this speed climbs, in unscaled pixels. */
function peakHeight(speed: number): number {
  const terminal = GRAVITY / DRAG_RATE;
  // The moment the upward velocity has fallen to zero.
  const top = Math.log((terminal + speed) / terminal) / DRAG_RATE;
  return -travel(-speed, GRAVITY, top);
}

const UNSCALED_PEAK = peakHeight(MAX_SPEED);

/** A piece as it leaves its cannon; where it is later is worked out from these. */
type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  /** Radians per tick. */
  spin: number;
  width: number;
  height: number;
  colour: string;
  round: boolean;
  /** Milliseconds into the run at which this piece leaves its cannon. */
  firedAt: number;
};

/** The tile colours, so the celebration belongs to this game rather than any game. */
const COLOURS = ROWS.map((row) => row.color);

const CANNONS: Record<Cannon, { share: number; aim: number; spread: number }> = {
  left: { share: 0.12, aim: -Math.PI / 3, spread: 0.7 },
  centre: { share: 0.5, aim: -Math.PI / 2, spread: 0.5 },
  right: { share: 0.88, aim: (-Math.PI * 2) / 3, spread: 0.7 },
};

/**
 * Throws one volley. Speeds are multiplied by `scale`, and the caller
 * multiplies gravity by the same factor, which makes the whole trajectory
 * `scale` times as large while taking the same time to fly.
 */
function makePieces(
  cannon: Cannon,
  count: number,
  firedAt: number,
  width: number,
  height: number,
  scale: number,
): Piece[] {
  const { share, aim, spread } = CANNONS[cannon];
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const angle = aim + (Math.random() - 0.5) * spread;
    const speed = (MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)) * scale;
    pieces.push({
      x: width * share,
      y: height - CANNON_RISE,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.3,
      width: 6 + Math.random() * 6,
      height: 8 + Math.random() * 8,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
      round: Math.random() < 0.25,
      firedAt,
    });
  }
  return pieces;
}

export function Confetti({ hintsUsed, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Read once at mount, so a hint counted during the celebration does not
  // restart it.
  const hintsAtStart = useRef(hintsUsed);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    // Someone who has asked for less motion gets the banner and nothing else.
    if (!canvas || !context || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onDone();
      return;
    }

    // The simulation runs in the window's coordinates at the moment of solving.
    // If the window changes size or moves to a screen with another pixel ratio
    // during the run, the canvas is resized and positions are mapped onto the
    // new size when drawn.
    const simWidth = window.innerWidth;
    const simHeight = window.innerHeight;
    const scale = (PEAK_SHARE * (simHeight - CANNON_RISE)) / UNSCALED_PEAK;
    const gravity = GRAVITY * scale;

    let drawWidth = 0;
    let drawHeight = 0;
    let drawRatio = 0;
    const fitCanvas = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const ratio = window.devicePixelRatio || 1;
      if (width === drawWidth && height === drawHeight && ratio === drawRatio) return;
      drawWidth = width;
      drawHeight = height;
      drawRatio = ratio;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const pieces = volleysFor(hintsAtStart.current).flatMap((volley) =>
      makePieces(volley.cannon, volley.pieces, volley.at, simWidth, simHeight, scale),
    );
    const start = performance.now();
    let frame = 0;

    const draw = (now: number) => {
      const elapsed = now - start;
      fitCanvas();
      context.clearRect(0, 0, drawWidth, drawHeight);
      if (elapsed >= DURATION_MS) {
        onDone();
        return;
      }

      const progress = elapsed / DURATION_MS;
      context.globalAlpha =
        progress < FADE_FROM ? 1 : 1 - (progress - FADE_FROM) / (1 - FADE_FROM);
      const toX = drawWidth / simWidth;
      const toY = drawHeight / simHeight;

      for (const piece of pieces) {
        if (elapsed < piece.firedAt) continue;
        const ticks = (elapsed - piece.firedAt) / TICK_MS;
        const x = piece.x + travel(piece.vx, 0, ticks);
        const y = piece.y + travel(piece.vy, gravity, ticks);
        context.save();
        context.translate(x * toX, y * toY);
        context.rotate(piece.angle + piece.spin * ticks);
        context.fillStyle = piece.colour;
        if (piece.round) {
          context.beginPath();
          context.arc(0, 0, piece.width / 2, 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
        }
        context.restore();
      }
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      data-confetti
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}
