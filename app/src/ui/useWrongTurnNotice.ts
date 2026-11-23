import { useCallback, useEffect, useState } from "react";

/**
 * A wrong move is not reported straight away — that would amount to a hint on
 * every move. The notice stays completely hidden for `NOTICE_DELAY_MS` after
 * the game goes wrong, then fades in over `NOTICE_FADE_SECONDS` (in `WrongTurnNotice.tsx`). An earlier
 * version started the fade at once and relied on it being too faint to notice
 * at first, but any opacity above zero is visible against the page, so the
 * player could tell the moment they had gone wrong.
 *
 * The wait is measured in time rather than in moves, because a player who has
 * gone wrong is often the one who then sits and stares: waiting for moves that
 * never come would leave exactly the wrong person unattended.
 */
const NOTICE_DELAY_MS = 20_000;

export type NoticeState = {
  /** Whether the notice is on screen, fully or still fading in. */
  shown: boolean;
  /** Whether it was brought up outright, with no wait and no fade. */
  revealed: boolean;
  /** Brings the notice up outright, if the game is wrong. */
  reveal: () => void;
};

/**
 * When to show the wrong-turn notice. `wrong` is whether the game has gone
 * wrong now. `revealNow` brings the notice up outright instead of after the
 * wait, as `reveal` does.
 */
export function useWrongTurnNotice(wrong: boolean, revealNow: boolean): NoticeState {
  const [delayPassed, setDelayPassed] = useState(false);
  /**
   * Shows the notice outright instead of fading it in. Shortening the fade is
   * not enough: once the transition is running, changing its duration does not
   * disturb it, because opacity is already headed for the same value.
   */
  const [revealed, setRevealed] = useState(false);
  const reveal = useCallback(() => setRevealed(true), []);

  useEffect(() => {
    if (revealNow) reveal();
  }, [revealNow, reveal]);

  // Once nothing is wrong any more, the notice forgets it was ever revealed.
  useEffect(() => {
    if (!wrong) setRevealed(false);
  }, [wrong]);

  // Starts the fade once the game has been wrong for `NOTICE_DELAY_MS`. Only a
  // game put right cancels the timer; further moves while it is wrong neither
  // restart the wait nor shorten it.
  useEffect(() => {
    if (!wrong) {
      setDelayPassed(false);
      return;
    }
    const timer = window.setTimeout(() => setDelayPassed(true), NOTICE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [wrong]);

  return { shown: wrong && (revealed || delayPassed), revealed, reveal };
}
