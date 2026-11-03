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
      aria-label="Help"
      // Escape closes the dialog without going through React, so the state is
      // brought in line here.
      onClose={onClose}
      // A click on the dialog element itself, rather than on its content, is a
      // click on the backdrop around it.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="w-[min(56rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-auto rounded-xl bg-transparent p-0 backdrop:bg-slate-900/40"
    >
      <div className="relative">
        <button
          type="button"
          title="Close help"
          onClick={onClose}
          className="absolute right-2 top-2 h-7 w-7 rounded text-lg leading-none text-slate-500 hover:bg-slate-100"
        >
          ×
        </button>
        <Legend />
      </div>
    </dialog>
  );
}
