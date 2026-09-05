import { useEffect, useRef } from "react";
import { ROWS } from "./tileSets";

type Props = {
  /** Called once the last piece has fallen, so the canvas can be unmounted. */
  onDone: () => void;
};

const DURATION_MS = 3400;
const FADE_FROM = 0.65;
const PER_CANNON = 70;
const GRAVITY = 0.32;
const DRAG = 0.994;

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  width: number;
  height: number;
  colour: string;
  round: boolean;
};

/** The tile colours, so the celebration belongs to this game rather than any game. */
const COLOURS = ROWS.map((row) => row.color);

function makePieces(width: number, height: number): Piece[] {
  const pieces: Piece[] = [];
  const cannons = [
    { x: width * 0.12, aim: -Math.PI / 3 },
    { x: width * 0.88, aim: (-Math.PI * 2) / 3 },
  ];

  for (const cannon of cannons)
    for (let i = 0; i < PER_CANNON; i++) {
      const angle = cannon.aim + (Math.random() - 0.5) * 0.7;
      const speed = 13 + Math.random() * 15;
      pieces.push({
        x: cannon.x,
        y: height + 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.3,
        width: 6 + Math.random() * 6,
        height: 8 + Math.random() * 8,
        colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
        round: Math.random() < 0.25,
      });
    }
  return pieces;
}

export function Confetti({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    // Someone who has asked for less motion gets the banner and nothing else.
    if (!canvas || !context || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onDone();
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);

    const pieces = makePieces(width, height);
    const start = performance.now();
    let frame = 0;

    const draw = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= DURATION_MS) {
        context.clearRect(0, 0, width, height);
        onDone();
        return;
      }
      const progress = elapsed / DURATION_MS;
      context.clearRect(0, 0, width, height);
      context.globalAlpha =
        progress < FADE_FROM ? 1 : 1 - (progress - FADE_FROM) / (1 - FADE_FROM);

      for (const piece of pieces) {
        piece.vy += GRAVITY;
        piece.vx *= DRAG;
        piece.vy *= DRAG;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.angle += piece.spin;

        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
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
