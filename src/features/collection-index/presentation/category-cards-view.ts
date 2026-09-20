import {
  CATEGORY_LABELS,
  PERSON_SUBTYPE_LABELS,
} from '../../category-badge/domain/category-display';
import { frwikiArticleUrl } from '../domain/frwiki-article-url';
import type { CategorySummary, SummaryCard } from '../domain/collection-summary';
import {
  COUNT_CLASS,
  createBlock,
  createButton,
  createCategoryDot,
  createLink,
  createText,
  LABEL_CLASS,
  RARITY_LABELS,
} from './popup-elements';

/**
 * The second screen of the popup: the cards of one category, each one linking
 * to its French Wikipedia article. The order is the one the use case produced,
 * rarest first then by title.
 */

const BACK_LABEL = 'Retour';

const SCREEN_CLASS = 'wme-screen';
const BACK_CLASS = 'wme-back';

/** The control the popup focuses when this screen opens. */
export const BACK_SELECTOR = `.${BACK_CLASS}`;
const HEAD_CLASS = 'wme-detail-head';
const CARDS_CLASS = 'wme-cards';
const CARD_CLASS = 'wme-card';
const CARD_LINK_CLASS = 'wme-card-link';
const CHIP_CLASS = 'wme-chip';
const CARD_SUBTYPE_CLASS = 'wme-card-subtype';

function renderCard(card: SummaryCard): HTMLElement {
  const item = createBlock(CARD_CLASS);

  item.appendChild(createText(CHIP_CLASS, RARITY_LABELS[card.rarity]));
  item.appendChild(createLink(CARD_LINK_CLASS, frwikiArticleUrl(card.title), card.title));
  if (card.primarySubtype !== null) {
    item.appendChild(createText(CARD_SUBTYPE_CLASS, PERSON_SUBTYPE_LABELS[card.primarySubtype]));
  }
  return item;
}

export function renderCategoryCards(category: CategorySummary, onBack: () => void): HTMLElement {
  const screen = createBlock(SCREEN_CLASS);
  const back = createButton(BACK_CLASS, onBack);
  back.textContent = BACK_LABEL;

  const head = createBlock(HEAD_CLASS);
  head.appendChild(createCategoryDot(category.categoryId));
  head.appendChild(createText(LABEL_CLASS, CATEGORY_LABELS[category.categoryId]));
  head.appendChild(createText(COUNT_CLASS, String(category.count)));

  const cards = createBlock(CARDS_CLASS);
  for (const card of category.cards) {
    cards.appendChild(renderCard(card));
  }

  screen.appendChild(back);
  screen.appendChild(head);
  screen.appendChild(cards);
  return screen;
}
