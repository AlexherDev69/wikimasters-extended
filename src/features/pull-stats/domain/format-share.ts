/**
 * How a share is written in the panel. French formatting throughout, like
 * every other text of the extension: a decimal comma, and a non breaking
 * space before the percent sign.
 */

const LOCALE = 'fr-FR';

/** One decimal: a tenth of a percent is already below one card in a thousand. */
const FRACTION_DIGITS = 1;

/**
 * Under this, one decimal rounds a rarity that DID come out down to "0,0 %",
 * which reads as "never". Such a share is written as a floor instead.
 */
const SMALLEST_SHOWN_PERCENT = 0.05;

const PERCENT_SUFFIX = ' %';

/**
 * A share as the panel writes it. Zero is written plainly, since it really is
 * none; anything the rounding would flatten to zero is written as a floor, so
 * a legendary pulled once in four thousand cards never reads as never pulled.
 */
export function formatPercent(percent: number): string {
  if (percent <= 0) {
    return `0${PERCENT_SUFFIX}`;
  }
  if (percent < SMALLEST_SHOWN_PERCENT) {
    return `< 0,1${PERCENT_SUFFIX}`;
  }
  return `${percent.toLocaleString(LOCALE, {
    minimumFractionDigits: FRACTION_DIGITS,
    maximumFractionDigits: FRACTION_DIGITS,
  })}${PERCENT_SUFFIX}`;
}

/** A count of cards, grouped the French way past a thousand. */
export function formatCount(count: number): string {
  return count.toLocaleString(LOCALE);
}
