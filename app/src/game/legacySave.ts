/**
 * Saves written before easy and medium puzzles had exclusions. A save stores
 * only the seed, and those two difficulties now build a different puzzle from
 * the same seed, so only a hard game, whose puzzles did not change, is carried
 * over.
 *
 * Temporary. `legacySave.test.ts` starts failing on `REMOVE_AFTER`, which
 * stops deployment until this file, its test and the two uses in `App.tsx`
 * are deleted. Anyone who has not opened the game by then loses a saved hard
 * game in progress, and nothing else.
 */
export const LEGACY_STORAGE_KEY = "sherlock:game:v4";

export const REMOVE_AFTER = "2026-12-17";
