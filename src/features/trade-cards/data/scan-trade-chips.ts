import type { DetectedCard } from '../../card-detection/domain/detected-card';
import { isRarity } from '../../card-detection/domain/rarity';
import {
  TRADE_CHIP_RARITY_PATTERN,
  TRADE_CHIP_SELECTOR,
  TRADE_CHIP_TITLE_ATTRIBUTE,
} from './trade-selectors';

const STYLE_ATTRIBUTE = 'style';

/** One card named by a chip of a trade offer, and the chip that names it. */
export interface ObservedTradeCard {
  /** The chip of the site. Our preview is inserted right before it. */
  chip: HTMLElement;
  /**
   * Read exactly as the scanner of the cards reads a card, so the title is
   * the very form the categorization is asked for, and a card met both here
   * and on another page is asked for once. The description is always null:
   * a chip carries none, and the categorization treats it as a tie-break
   * only, never as a requirement.
   */
  card: DetectedCard;
}

/**
 * The cards a trade list names, read from the chips themselves.
 *
 * The title comes from the `title` attribute and never from the text of the
 * chip: the site cuts that text with an ellipsis, which is the very reason
 * this feature exists ("SR · The Backrooms (fil…").
 *
 * A chip whose rarity cannot be read is skipped rather than guessed: the
 * rarity is what colours the preview, and a wrong colour would state
 * something about a card that is not true.
 */
export function scanTradeChips(root: ParentNode): ObservedTradeCard[] {
  const found: ObservedTradeCard[] = [];

  for (const chip of root.querySelectorAll<HTMLElement>(TRADE_CHIP_SELECTOR)) {
    const title = (chip.getAttribute(TRADE_CHIP_TITLE_ATTRIBUTE) ?? '').trim();
    const rarity = TRADE_CHIP_RARITY_PATTERN.exec(chip.getAttribute(STYLE_ATTRIBUTE) ?? '')?.[1];

    if (title === '' || !isRarity(rarity)) {
      continue;
    }
    found.push({ chip, card: { title, description: null, rarity } });
  }
  return found;
}
