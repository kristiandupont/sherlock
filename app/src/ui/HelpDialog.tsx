import { useEffect, useRef } from "react";
import { Legend } from "./Legend";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * The help, drawn over the game. A native dialog opened with `showModal` puts
 * itself above everything else, keeps focus inside, and closes on Escape.
 */
export function HelpDialog({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="help-title"
      // Escape closes the dialog without going through React, so the state is
      // brought in line here.
      onClose={onClose}
      // A click on the dialog element itself, rather than on its content, is a
      // click on the backdrop around it.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="w-[min(56rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-auto rounded-xl bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
          <h2 id="help-title" className="text-lg font-semibold text-slate-800">How to play Sherlock</h2>
          <button
            type="button"
            title="Close help"
            onClick={onClose}
            className="h-8 w-8 rounded text-xl leading-none text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </header>
        <div className="px-8 pb-6 pt-5">
          <Legend />
        </div>
      </div>
    </dialog>
  );
}
