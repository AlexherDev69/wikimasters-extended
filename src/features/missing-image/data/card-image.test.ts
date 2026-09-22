import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCards } from '../../card-detection/data/scan-cards';
import type { CardImage } from '../../../core/mediawiki/card-image';
import { applyCardImage, removeCardImages } from './card-image';
import { findPictureArea } from './find-placeholder';
import {
  CARD_IMAGE_SELECTOR,
  IMAGE_FAILED_ATTRIBUTE,
  IMAGE_FILE_ATTRIBUTE,
  IMAGE_KIND_ATTRIBUTE,
  IMAGE_LOADED_ATTRIBUTE,
  IMAGE_SOURCE_MARK_ATTRIBUTE,
} from './image-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

const PLACEHOLDER_HTML = readFileSync(join(FIXTURES_DIR, 'placeholder-cards.html'), 'utf-8');

/** The very style sheet the manifest injects, so the states are read from it. */
const FEATURE_STYLE_SHEET = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../presentation/missing-image.css'),
  'utf-8',
);

const PLACEHOLDER_TITLE = 'Adan Canto';
const REAL_PICTURE_TITLE = 'Airbus A400M Atlas';

/** What the mark reads, as data/card-image.ts writes it. */
const IMAGE_SOURCE_LABEL = 'C';

/** The dark ground a photograph is laid on, as the style sheet declares it. */
const PICTURE_GROUND = '#0d1117';

/** The sheen of the loading state, named by the rule that runs it. */
const LOADING_ANIMATION = 'wme-card-image-loading';

/** What a pseudo element needs to be drawn at all. */
const EMPTY_CONTENT = "''";

const IMAGE_SOURCE_MARK_SELECTOR = `[${IMAGE_SOURCE_MARK_ATTRIBUTE}]`;

/** A card whose address was not resolved: the built one is used for it. */
const PORTRAIT: CardImage = {
  fileName: 'Adan Canto 2015.jpg',
  kind: 'picture',
  thumbnailUrl: null,
};
const PORTRAIT_URL =
  'https://commons.wikimedia.org/wiki/Special:FilePath/Adan%20Canto%202015.jpg?width=500';

/** The same card once the service worker has resolved its address. */
const RESOLVED_URL =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Adan_Canto.jpg/500px-Adan_Canto.jpg' +
  '?utm_source=fr.wikipedia.org&utm_campaign=imageinfo&utm_content=thumbnail';

const RESOLVED_PORTRAIT: CardImage = { ...PORTRAIT, thumbnailUrl: RESOLVED_URL };

const EMBLEM: CardImage = {
  fileName: 'Logo - République française.svg',
  kind: 'emblem',
  thumbnailUrl: null,
};

function cardRootOf(title: string): HTMLElement {
  const observed = scanCards(document.body).find((card) => card.card.title === title);
  if (observed === undefined) {
    throw new Error(`The fixture holds no card named ${title}`);
  }
  return observed.element;
}

function container(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(CARD_IMAGE_SELECTOR);
}

function ourImage(): HTMLImageElement | null {
  return container()?.querySelector<HTMLImageElement>('img') ?? null;
}

/** The mark naming the source, looked for in the whole page, not only in ours. */
function ourMark(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(IMAGE_SOURCE_MARK_SELECTOR);
}

/** The page as the site wrote it, whatever we added to it. */
function siteHtmlWithoutOurNodes(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  removeCardImages(clone);
  return clone.innerHTML;
}

function observeBody(): MutationObserver {
  const observer = new MutationObserver(() => undefined);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });
  return observer;
}

describe('applyCardImage', () => {
  beforeEach(() => {
    document.body.innerHTML = PLACEHOLDER_HTML;
  });

  it('should add one container as the last child of the image area of the card', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);

    applyCardImage(cardRoot, PORTRAIT);

    expect(document.body.querySelectorAll(CARD_IMAGE_SELECTOR)).toHaveLength(1);
    expect(findPictureArea(cardRoot)?.lastElementChild).toBe(container());
  });

  it('should build the address of the thumbnail when the card carries none', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    expect(ourImage()?.getAttribute('src')).toBe(PORTRAIT_URL);
    // The Commons address answers with redirects that carry no CORS header.
    expect(ourImage()?.hasAttribute('crossorigin')).toBe(false);
  });

  it('should use the resolved address when the card carries one', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), RESOLVED_PORTRAIT);

    // Exactly as the API gave it, tracking parameters included: the address is
    // never rebuilt, only checked against the closed host allowlist.
    expect(ourImage()?.getAttribute('src')).toBe(RESOLVED_URL);
  });

  it('should build the address when the resolved one is on a refused host', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), {
      ...PORTRAIT,
      thumbnailUrl: 'https://upload.wikimedia.org.evil.example/500px-Adan_Canto.jpg',
    });

    // Last check before the `src`, whatever the caller believes it holds.
    expect(ourImage()?.getAttribute('src')).toBe(PORTRAIT_URL);
  });

  it('should ask the browser for a lazy, decorative image that sends no referrer', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    expect(ourImage()?.getAttribute('alt')).toBe('');
    expect(ourImage()?.getAttribute('loading')).toBe('lazy');
    expect(ourImage()?.getAttribute('decoding')).toBe('async');
    expect(ourImage()?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(ourImage()?.getAttribute('draggable')).toBe('false');
  });

  it('should hold the file and the kind it shows, which is what the next sync compares', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), EMBLEM);

    expect(container()?.getAttribute(IMAGE_FILE_ATTRIBUTE)).toBe(EMBLEM.fileName);
    expect(container()?.getAttribute(IMAGE_KIND_ATTRIBUTE)).toBe('emblem');
  });

  it('should build the container from a div, an img and a span only, so the scanner ignores it', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    const tags = [...(container()?.querySelectorAll('*') ?? [])].map((node) => node.tagName);
    expect(container()?.tagName).toBe('DIV');
    expect(new Set(tags)).toEqual(new Set(['IMG', 'SPAN']));
  });

  it('should name the source of the picture inside our container, and nowhere else', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);

    applyCardImage(cardRoot, PORTRAIT);

    expect(document.body.querySelectorAll(IMAGE_SOURCE_MARK_SELECTOR)).toHaveLength(1);
    expect(ourMark()?.textContent).toBe(IMAGE_SOURCE_LABEL);
    expect(ourMark()?.closest(CARD_IMAGE_SELECTOR)).toBe(container());
  });

  it('should carry no class that the card detection could take for a card', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    const classNames = [container(), ...(container()?.querySelectorAll('*') ?? [])].map(
      (node) => node?.className ?? '',
    );
    expect(classNames.every((name) => !name.includes('glow-'))).toBe(true);
  });

  it('should start in the loading state, which is neither of the two marks', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    // The style sheet draws the loading state on exactly this: a container
    // that carries neither mark. Nothing else has to be written for it.
    expect(container()?.hasAttribute(IMAGE_LOADED_ATTRIBUTE)).toBe(false);
    expect(container()?.hasAttribute(IMAGE_FAILED_ATTRIBUTE)).toBe(false);
  });

  it('should leave the card in no state at all when the extension has no image for it', () => {
    // The loading state belongs to the container, and the container exists
    // only when an image is known: a card without one shows nothing of ours.
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), null);

    expect(container()).toBeNull();
  });

  it('should become visible only once our own image has loaded', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);
    expect(container()?.hasAttribute(IMAGE_LOADED_ATTRIBUTE)).toBe(false);

    ourImage()?.dispatchEvent(new Event('load'));

    expect(container()?.hasAttribute(IMAGE_LOADED_ATTRIBUTE)).toBe(true);
    expect(container()?.hasAttribute(IMAGE_FAILED_ATTRIBUTE)).toBe(false);
  });

  it('should mark the container as failed when our own image fails to load', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    ourImage()?.dispatchEvent(new Event('error'));

    // The style sheet hides everything of ours on this mark, the mark naming
    // the source included: what is left on screen is the logo of the site.
    expect(container()?.hasAttribute(IMAGE_FAILED_ATTRIBUTE)).toBe(true);
    expect(container()?.hasAttribute(IMAGE_LOADED_ATTRIBUTE)).toBe(false);
  });

  it('should write nothing on a second call with the same image', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);
    ourImage()?.dispatchEvent(new Event('load'));
    const observer = observeBody();

    applyCardImage(cardRoot, PORTRAIT);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write nothing on a second call in each of the three states', () => {
    // The content script observes document.body: a sync that wrote because of
    // a mark it had itself just written would schedule the next scan for ever.
    for (const state of ['loading', 'loaded', 'failed'] as const) {
      document.body.innerHTML = PLACEHOLDER_HTML;
      const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
      applyCardImage(cardRoot, PORTRAIT);
      if (state !== 'loading') {
        ourImage()?.dispatchEvent(new Event(state === 'loaded' ? 'load' : 'error'));
      }
      const picture = ourImage();

      const observer = observeBody();
      applyCardImage(cardRoot, PORTRAIT);

      expect(observer.takeRecords()).toHaveLength(0);
      observer.disconnect();
      // And the picture of the card was not fetched again either.
      expect(ourImage()).toBe(picture);
    }
  });

  it('should write nothing when the address is resolved after the picture was shown', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);
    ourImage()?.dispatchEvent(new Event('load'));
    const observer = observeBody();

    // A faster address for a picture already on screen changes nothing: the
    // browser holds it, and rebuilding would show the loading state again.
    applyCardImage(cardRoot, RESOLVED_PORTRAIT);

    expect(observer.takeRecords()).toHaveLength(0);
    expect(ourImage()?.getAttribute('src')).toBe(PORTRAIT_URL);
    observer.disconnect();
  });

  it('should write nothing when the card has no image and carries no container', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    const observer = observeBody();

    applyCardImage(cardRoot, null);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should build a fresh container when the card shows another file', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);
    ourImage()?.dispatchEvent(new Event('load'));

    applyCardImage(cardRoot, EMBLEM);

    expect(document.body.querySelectorAll(CARD_IMAGE_SELECTOR)).toHaveLength(1);
    expect(container()?.getAttribute(IMAGE_FILE_ATTRIBUTE)).toBe(EMBLEM.fileName);
    // The new file has not loaded yet, so the container is invisible again.
    expect(container()?.hasAttribute(IMAGE_LOADED_ATTRIBUTE)).toBe(false);
  });

  it('should rebuild a container whose picture was lost', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);
    ourImage()?.remove();

    applyCardImage(cardRoot, PORTRAIT);

    expect(document.body.querySelectorAll(CARD_IMAGE_SELECTOR)).toHaveLength(1);
    expect(ourImage()?.getAttribute('src')).toBe(PORTRAIT_URL);
    // And the sync that follows the rebuild is back to writing nothing.
    const observer = observeBody();
    applyCardImage(cardRoot, PORTRAIT);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should rebuild a container whose mark was lost', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);
    ourMark()?.remove();

    applyCardImage(cardRoot, PORTRAIT);

    expect(document.body.querySelectorAll(CARD_IMAGE_SELECTOR)).toHaveLength(1);
    expect(ourMark()?.textContent).toBe(IMAGE_SOURCE_LABEL);
    // And the sync that follows the rebuild is back to writing nothing.
    const observer = observeBody();
    applyCardImage(cardRoot, PORTRAIT);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should remove our container when the card has no image any more', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);

    applyCardImage(cardRoot, null);

    expect(container()).toBeNull();
  });

  it('should take the mark back with the container when the image becomes unknown', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);
    ourImage()?.dispatchEvent(new Event('load'));

    applyCardImage(cardRoot, null);

    expect(ourMark()).toBeNull();
  });

  it('should remove our container when the site swapped in a real picture', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);
    applyCardImage(cardRoot, PORTRAIT);
    // The site renders the card again, this time with its own picture: the
    // image area has no placeholder any more.
    cardRoot.querySelector('img[alt="WikiMasters"]')?.remove();

    applyCardImage(cardRoot, PORTRAIT);

    expect(container()).toBeNull();
  });

  it('should add nothing to a card the site shows a real picture for', () => {
    // The common case, three cards out of four: no placeholder, and no
    // container of ours was ever put in that card, so the pass writes nothing
    // and does not search the card either.
    const cardRoot = cardRootOf(REAL_PICTURE_TITLE);
    const observer = observeBody();

    applyCardImage(cardRoot, PORTRAIT);

    expect(observer.takeRecords()).toHaveLength(0);
    expect(container()).toBeNull();
    observer.disconnect();
  });

  it('should refuse a file name that could not be turned into an address', () => {
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);

    applyCardImage(cardRoot, { fileName: 'Adan Canto.exe', kind: 'picture', thumbnailUrl: null });

    expect(container()).toBeNull();
  });

  it('should leave the cards of the page readable exactly as before', () => {
    const before = scanCards(document.body).map((observed) => observed.card);

    for (const observed of scanCards(document.body)) {
      applyCardImage(observed.element, PORTRAIT);
    }

    expect(scanCards(document.body).map((observed) => observed.card)).toEqual(before);
  });

  it('should leave every node of the site untouched', () => {
    const siteHtml = document.body.innerHTML;
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);

    applyCardImage(cardRoot, PORTRAIT);
    applyCardImage(cardRoot, EMBLEM);

    expect(siteHtmlWithoutOurNodes()).toBe(siteHtml);
  });

  it('should leave every node of the site untouched when the mark is shown', () => {
    const siteHtml = document.body.innerHTML;
    const cardRoot = cardRootOf(PLACEHOLDER_TITLE);

    applyCardImage(cardRoot, PORTRAIT);
    ourImage()?.dispatchEvent(new Event('load'));

    expect(ourMark()).not.toBeNull();
    expect(siteHtmlWithoutOurNodes()).toBe(siteHtml);
  });
});

/**
 * What the three states of the container actually look like, read from the
 * style sheet the extension ships rather than from a copy of its rules.
 */
describe('applyCardImage, the states of the container', () => {
  beforeEach(() => {
    document.body.innerHTML = PLACEHOLDER_HTML;
    const style = document.createElement('style');
    style.textContent = FEATURE_STYLE_SHEET;
    document.head.replaceChildren(style);
  });

  function displayOf(element: Element | null): string {
    return element === null ? 'missing' : getComputedStyle(element).display;
  }

  /** What actually shows the picture: the container is only its ground. */
  function opacityOf(element: Element | null): string {
    return element === null ? 'missing' : getComputedStyle(element).opacity;
  }

  function backgroundOf(element: Element | null): string {
    return element === null ? 'missing' : getComputedStyle(element).backgroundColor;
  }

  /**
   * The first rule of the sheet whose selector holds `selectorPart`. The
   * loading state is drawn in a pseudo element, which `getComputedStyle`
   * cannot be asked about, so it is read from the sheet itself.
   */
  function styleRuleFor(selectorPart: string): CSSStyleRule | null {
    const sheet = document.styleSheets[0];
    if (sheet === undefined) {
      throw new Error('The style sheet of the feature was not injected');
    }
    const rules = Array.from(sheet.cssRules).filter(
      (rule): rule is CSSStyleRule => 'selectorText' in rule,
    );
    return rules.find((rule) => rule.selectorText.includes(selectorPart)) ?? null;
  }

  it('should show our container while the picture is on its way', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    // The container itself is there, which is what the loading state is drawn
    // on, while the picture is still invisible and the mark naming the source
    // stays hidden: it would otherwise name the source of the logo of the
    // site, which is not ours.
    expect(displayOf(container())).not.toBe('none');
    expect(opacityOf(ourImage())).toBe('0');
    expect(displayOf(ourMark())).toBe('none');
  });

  it('should show the picture and the mark once the picture has loaded', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    ourImage()?.dispatchEvent(new Event('load'));

    expect(displayOf(container())).not.toBe('none');
    // The whole point of the mark: without this rule the extension adds a
    // picture that is never seen, on every card and for good.
    expect(opacityOf(ourImage())).toBe('1');
    // And the ground the picture is laid on arrives with it, so a file with
    // transparent parts never lets the logo of the site show through.
    expect(backgroundOf(container())).toBe(PICTURE_GROUND);
    expect(displayOf(ourMark())).toBe('flex');
  });

  it('should hide everything of ours when the picture fails to load', () => {
    applyCardImage(cardRootOf(PLACEHOLDER_TITLE), PORTRAIT);

    ourImage()?.dispatchEvent(new Event('error'));

    // The container, so the image and the mark with it: the user is left with
    // the logo of the site, exactly as if the extension had found nothing.
    expect(displayOf(container())).toBe('none');
    expect(opacityOf(ourImage())).toBe('0');
  });

  it('should sweep a sheen over the picture area while the picture is on its way', () => {
    const sweep = styleRuleFor(`${CARD_IMAGE_SELECTOR}::after`);

    expect(sweep?.style.getPropertyValue('content')).toBe(EMPTY_CONTENT);
    expect(sweep?.style.getPropertyValue('animation')).toContain(LOADING_ANIMATION);
  });

  it('should stop the sweep once the picture has loaded or failed', () => {
    const stopped = styleRuleFor(`[${IMAGE_LOADED_ATTRIBUTE}]::after`);

    // Both ends of the state, in one rule: a card that is done keeps no
    // animation running behind it.
    expect(stopped?.selectorText).toContain(`[${IMAGE_FAILED_ATTRIBUTE}]::after`);
    expect(stopped?.style.getPropertyValue('content')).toBe('none');
  });
});

describe('removeCardImages', () => {
  beforeEach(() => {
    document.body.innerHTML = PLACEHOLDER_HTML;
  });

  it('should take back every container and leave the site as it was', () => {
    const siteHtml = document.body.innerHTML;
    for (const observed of scanCards(document.body)) {
      applyCardImage(observed.element, PORTRAIT);
    }
    expect(document.body.querySelectorAll(CARD_IMAGE_SELECTOR).length).toBeGreaterThan(0);

    removeCardImages(document.body);

    expect(document.body.querySelectorAll(CARD_IMAGE_SELECTOR)).toHaveLength(0);
    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should do nothing when no container was added', () => {
    const observer = observeBody();

    removeCardImages(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
