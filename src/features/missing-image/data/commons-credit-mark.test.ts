import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MAX_COMMONS_FILE_NAME_LENGTH } from '../../../core/mediawiki/card-image';
import { commonsCreditMark } from './commons-credit-mark';
import { IMAGE_CREDIT_MARK_SELECTOR } from './image-selectors';

const FILE_NAME = 'Severance titlecard.jpg';
const FILE_PAGE = 'https://commons.wikimedia.org/wiki/File:Severance%20titlecard.jpg';

function mark(fileName = FILE_NAME): HTMLAnchorElement | null {
  return commonsCreditMark(document, fileName);
}

describe('commonsCreditMark', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should open the file page, which is where the author and the licence are named', () => {
    expect(mark()?.getAttribute('href')).toBe(FILE_PAGE);
  });

  it('should carry the attribute the style sheet draws it by', () => {
    const credit = mark();
    document.body.appendChild(credit as HTMLAnchorElement);

    expect(document.body.querySelector(IMAGE_CREDIT_MARK_SELECTOR)).toBe(credit);
  });

  it('should leave the page of the site behind, with no opener and no referrer', () => {
    const credit = mark();

    expect(credit?.target).toBe('_blank');
    expect(credit?.rel).toBe('noopener noreferrer');
  });

  it('should name its destination in a tooltip, which the letter alone cannot', () => {
    expect(mark()?.getAttribute('title')).toBe('Image de Wikimedia Commons : auteur et licence');
  });

  it('should stay out of the accessibility tree and out of the tab order', () => {
    // The card of the extension stands inside a button of the site, which
    // takes its name from the text it holds: a labelled link of ours would
    // not merely be read out in the middle of that name, it would be part of
    // it.
    const credit = mark();

    expect(credit?.getAttribute('aria-hidden')).toBe('true');
    expect(credit?.getAttribute('aria-label')).toBeNull();
    expect(credit?.tabIndex).toBe(-1);
  });

  it('should read as the mark of a card of the site reads, so one letter means one thing', () => {
    expect(mark()?.textContent).toBe('C');
  });

  it('should keep its own click, so the detail of the offer does not open behind it', () => {
    const credit = mark() as HTMLAnchorElement;
    document.body.appendChild(credit);
    const onOfferClick = vi.fn();
    document.body.addEventListener('click', onOfferClick);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'isTrusted', { value: true });
    credit.dispatchEvent(event);

    expect(onOfferClick).not.toHaveBeenCalled();
    // Never `preventDefault`: the anchor keeps its own navigation.
    expect(event.defaultPrevented).toBe(false);
  });

  it('should let a click no user made run its course', () => {
    const credit = mark() as HTMLAnchorElement;
    document.body.appendChild(credit);
    const onOfferClick = vi.fn();
    document.body.addEventListener('click', onOfferClick);

    // `isTrusted` is false on an event a script dispatched, which is exactly
    // what a page trying to make our node act on its behalf would do.
    credit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(onOfferClick).toHaveBeenCalledTimes(1);
  });

  it('should draw no mark at all when the name could never reach an address', () => {
    // The name comes from Wikidata, where anyone can write anything, and it
    // ends up in an `href`: the guard runs here whatever the caller believes
    // it holds.
    for (const unusable of [
      '',
      ' Leading space.jpg',
      'No extension',
      'Video.webm',
      'Path/traversal.jpg',
      'Fragment#anchor.jpg',
      `${'a'.repeat(MAX_COMMONS_FILE_NAME_LENGTH)}.jpg`,
    ]) {
      expect(mark(unusable)).toBeNull();
    }
  });
});
