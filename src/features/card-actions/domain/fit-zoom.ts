/** A width and a height, in CSS pixels. */
export interface Size {
  width: number;
  height: number;
}

/**
 * The share of the screen the card may take on its tighter side: the rest is
 * a margin, so the glow the site draws around the card is not cut by the edge.
 */
const SCREEN_SHARE = 0.9;

/** The zoom that changes nothing, for a size that could not be measured. */
const NEUTRAL_ZOOM = 1;

function isMeasured(size: Size): boolean {
  return (
    Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0
  );
}

/**
 * The zoom that makes `card` as large as `screen` allows, keeping its
 * proportions: the side that runs out of room first decides.
 *
 * A size that reads zero, which a node not laid out yet does, gives the
 * neutral zoom rather than a division by zero: the card is then shown at the
 * size the site drew it, which is still the whole card.
 */
export function fitZoom(screen: Size, card: Size): number {
  if (!isMeasured(screen) || !isMeasured(card)) {
    return NEUTRAL_ZOOM;
  }
  return Math.min(
    (screen.width * SCREEN_SHARE) / card.width,
    (screen.height * SCREEN_SHARE) / card.height,
  );
}
