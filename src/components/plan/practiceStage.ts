/**
 * The size of the ring both non-breathing relaxation players are built around —
 * the practice timer and the meditation player.
 *
 * One constant rather than one per file because the two sit behind a choice
 * control that swaps between them. A ring that changed size when she switched
 * would make the swap read as the screen redrawing itself rather than as the
 * same practice, done a different way.
 */
export const PRACTICE_RING_SIZE = 132;

/**
 * Font size for a `mm:ss` face inside that ring.
 *
 * `ProgressRing` defaults its label to 30% of the diameter, which is sized for
 * one or two characters. At 132pt that is a 40pt font, and "10:57" in it runs
 * straight through the stroke on both sides.
 */
export const PRACTICE_CLOCK_SIZE = 26;
