import { Button } from "./Button";

/** How long the notice takes to fade in once `useWrongTurnNotice` shows it. */
const NOTICE_FADE_SECONDS = 5;

const REWIND_HINT = "Return to the last position that had no mistakes";

/**
 * The notice is always in the document and only its opacity changes. Mounting
 * it on the wrong move would resize the column and announce itself a beat
 * before the text became readable.
 */
export function WrongTurnNotice({
  shown,
  revealed,
  onRewind,
}: {
  shown: boolean;
  revealed: boolean;
  onRewind: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      style={{
        opacity: shown ? 1 : 0,
        // Hidden rather than only transparent during the wait, so its Go back
        // button cannot be clicked before it can be seen.
        visibility: shown ? "visible" : "hidden",
        // No transition on the way out, so a grid put right and then broken
        // again starts its fade from zero rather than part-way up.
        transition: revealed || !shown ? "none" : `opacity ${NOTICE_FADE_SECONDS}s linear`,
      }}
      aria-hidden={!shown}
    >
      {/* The same words whatever went wrong, the grid or an accusation, so
          that the notice says only that something did. */}
      <span>Something has gone wrong.</span>
      <Button onClick={onRewind} title={REWIND_HINT}>
        Go back
      </Button>
    </div>
  );
}
