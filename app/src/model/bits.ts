/** Column sets are held as bitmasks, one bit per column. */

export const fullMask = (size: number): number => (1 << size) - 1;

export const bit = (index: number): number => 1 << index;

export function popCount(mask: number): number {
  let n = 0;
  while (mask) {
    mask &= mask - 1;
    n++;
  }
  return n;
}

export const isSingle = (mask: number): boolean => mask !== 0 && (mask & (mask - 1)) === 0;

/** Index of the lowest set bit; -1 for an empty mask. */
export const lowestBit = (mask: number): number =>
  mask === 0 ? -1 : 31 - Math.clz32(mask & -mask);

/** Index of the highest set bit; -1 for an empty mask. */
export const highestBit = (mask: number): number => (mask === 0 ? -1 : 31 - Math.clz32(mask));

/** All bits strictly below `index`. */
export const bitsBelow = (index: number): number => (1 << index) - 1;

/** All bits strictly above `index`, within `size` bits. */
export const bitsAbove = (index: number, size: number): number =>
  fullMask(size) & ~((1 << (index + 1)) - 1);

export const shiftUp = (mask: number, size: number): number => (mask << 1) & fullMask(size);

export const shiftDown = (mask: number): number => mask >> 1;

/** Columns one step either side of every column in `mask`. */
export const neighbours = (mask: number, size: number): number =>
  shiftUp(mask, size) | shiftDown(mask);

export function bitList(mask: number): number[] {
  const out: number[] = [];
  for (let i = 0; mask >> i; i++) if (mask & (1 << i)) out.push(i);
  return out;
}
