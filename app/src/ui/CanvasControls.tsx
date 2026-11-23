/** The bar in the canvas's corner: the selection count, and the zoom buttons. */
export function CanvasControls({
  bottom,
  selectionCount,
  onClearSelection,
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  /** Distance from the bottom of the canvas area, in pixels, to clear the strip. */
  bottom: number;
  selectionCount: number;
  onClearSelection: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  return (
    <div
      className="absolute right-2 flex items-center gap-1 rounded-lg border border-slate-300 bg-white/95 px-1.5 py-1 text-xs text-slate-600 shadow-sm"
      style={{ bottom }}
    >
      {selectionCount > 0 && (
        <>
          <span data-selection-count className="px-1 font-medium text-indigo-700">
            {selectionCount} selected
          </span>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 hover:bg-slate-100"
            onClick={onClearSelection}
          >
            Clear
          </button>
          <span className="mx-0.5 h-4 w-px bg-slate-200" />
        </>
      )}
      <ZoomButton label="−" title="Zoom out" onClick={onZoomOut} />
      <span data-zoom className="w-10 text-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <ZoomButton label="+" title="Zoom in" onClick={onZoomIn} />
      <button
        type="button"
        className="rounded px-1.5 py-0.5 hover:bg-slate-100"
        title="Fit every clue in view"
        onClick={onFit}
      >
        Fit
      </button>
    </div>
  );
}

function ZoomButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="h-5 w-5 rounded text-sm leading-none hover:bg-slate-100"
    >
      {label}
    </button>
  );
}
