import { candidatesAt, isReadyToPlace, placedTile, type BoardState } from "../game/board";
import { TileGlyph } from "./TileGlyph";
import { ROWS, tileName } from "./tileSets";

export type InteractionMode = "place" | "rule-out";

type Props = {
  board: BoardState;
  mode: InteractionMode;
  /** Cells to flag, as "row:col" keys. */
  flagged: Set<string>;
  onPlace: (row: number, col: number, tile: number) => void;
  onRuleOut: (row: number, col: number, tile: number) => void;
};

export function Board({ board, mode, flagged, onPlace, onRuleOut }: Props) {
  const { size } = board;
  const slotColumns = Math.ceil(Math.sqrt(size));
  const slotRows = Math.ceil(size / slotColumns);

  return (
    <div className="select-none">
      <div
        className="grid gap-1 text-[10px] font-medium text-slate-400"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: size }, (_, col) => (
          <div key={col} className="text-center">
            {col + 1}
          </div>
        ))}
      </div>

      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {board.cells.map((cells, row) =>
          cells.map((_, col) => {
            const placed = placedTile(board, row, col);
            const ready = isReadyToPlace(board, row, col);
            const isFlagged = flagged.has(`${row}:${col}`);
            const frame = isFlagged
              ? "border-rose-400 bg-rose-50 ring-2 ring-rose-200"
              : placed >= 0
                ? "border-slate-300"
                : "border-slate-200 bg-white";

            return (
              <div
                key={`${row}:${col}`}
                data-cell-state={placed >= 0 ? "placed" : ready ? "ready" : "open"}
                className={`relative aspect-square rounded-md border ${frame} overflow-hidden`}
                style={placed >= 0 && !isFlagged ? { backgroundColor: ROWS[row].soft } : undefined}
              >
                {placed >= 0 ? (
                  <button
                    type="button"
                    className="flex h-full w-full items-center justify-center"
                    title={tileName(row, placed)}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <TileGlyph row={row} tile={placed} size={38} />
                  </button>
                ) : (
                  <div
                    className="grid h-full w-full p-0.5"
                    style={{
                      gridTemplateColumns: `repeat(${slotColumns}, minmax(0, 1fr))`,
                      // Without explicit rows, a row whose candidates are all
                      // ruled out collapses and drags the remaining row up.
                      gridTemplateRows: `repeat(${slotRows}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: size }, (_, tile) => {
                      const available = candidatesAt(board, row, col).includes(tile);
                      if (!available) return <div key={tile} />;
                      return (
                        <button
                          key={tile}
                          type="button"
                          className="flex items-center justify-center rounded-sm transition hover:bg-slate-200"
                          title={`${tileName(row, tile)} — ${
                            mode === "place" ? "click to place, right-click to rule out" : "click to rule out"
                          }`}
                          onClick={() =>
                            mode === "place" ? onPlace(row, col, tile) : onRuleOut(row, col, tile)
                          }
                          onContextMenu={(event) => {
                            event.preventDefault();
                            onRuleOut(row, col, tile);
                          }}
                        >
                          <TileGlyph row={row} tile={tile} size={18} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
