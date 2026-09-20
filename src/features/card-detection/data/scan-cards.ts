import type { DetectedCard } from '../domain/detected-card';
import { extractCard } from './extract-card';
import { findCardElements } from './find-card-elements';

export interface ObservedCard {
  element: HTMLElement;
  card: DetectedCard;
}

/** Scans the DOM for card elements and extracts their data, dropping elements that fail extraction. */
export function scanCards(root: ParentNode): ObservedCard[] {
  const elements = findCardElements(root);
  const result: ObservedCard[] = [];

  for (const element of elements) {
    const card = extractCard(element);
    if (card !== null) {
      result.push({ element, card });
    }
  }

  return result;
}
