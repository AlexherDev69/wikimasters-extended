import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyBrandMark, removeBrandMarks } from './brand-mark';
import { BRAND_MARK_SELECTOR, SITE_NAME_SELECTOR } from './brand-selectors';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** The navigation of the site, its name at the top, and the title of a page. */
const HEADER_HTML = readFileSync(join(FIXTURES_DIR, 'site-header.html'), 'utf-8');

const MARK_TEXT = 'Extended';

function ourMarks(): NodeListOf<HTMLElement> {
  return document.body.querySelectorAll<HTMLElement>(BRAND_MARK_SELECTOR);
}

function ourMark(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(BRAND_MARK_SELECTOR);
}

function siteName(): Element | null {
  return document.body.querySelector(SITE_NAME_SELECTOR);
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

describe('applyBrandMark', () => {
  beforeEach(() => {
    document.body.innerHTML = HEADER_HTML;
  });

  it('should write the word under the name of the site', () => {
    applyBrandMark(document.body);

    expect(ourMark()?.textContent).toBe(MARK_TEXT);
    expect(siteName()?.nextElementSibling).toBe(ourMark());
  });

  it('should write the word inside the link the name of the site is', () => {
    // The click on it is then the click on the name, which is what the site
    // does with its own logo: nothing of ours takes a click here.
    applyBrandMark(document.body);

    expect(ourMark()?.parentElement?.tagName).toBe('A');
  });

  it('should leave the link reading as the site wrote it for a screen reader', () => {
    applyBrandMark(document.body);

    expect(ourMark()?.getAttribute('aria-hidden')).toBe('true');
  });

  it('should write nothing on a second pass', () => {
    applyBrandMark(document.body);
    const observer = observeBody();

    applyBrandMark(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    expect(ourMarks()).toHaveLength(1);
    observer.disconnect();
  });

  it('should write the word once and never beside the title of the page', () => {
    // The title of a page carries the same heading font as the name of the
    // site: only the name of the site is the heading of a link.
    applyBrandMark(document.body);

    expect(ourMarks()).toHaveLength(1);
    expect(document.body.querySelectorAll('h1')).toHaveLength(2);
  });

  it('should write the word under every name the site draws', () => {
    // One page holds one today. A navigation of its own for the narrow
    // screens would hold a second, and both must carry the word.
    document.body.innerHTML = HEADER_HTML + HEADER_HTML;

    applyBrandMark(document.body);

    expect(ourMarks()).toHaveLength(2);
  });

  it('should write nothing on a page the site shows no name of its own on', () => {
    document.body.innerHTML = '<div><h1 style="font-family: var(--font-heading);">Marché</h1></div>';
    const observer = observeBody();

    applyBrandMark(document.body);

    expect(ourMark()).toBeNull();
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should write the word again once the site has rebuilt its navigation', () => {
    applyBrandMark(document.body);

    // What React does when it renders the navigation anew: the link, and our
    // word with it, are replaced by a link of its own.
    document.body.innerHTML = HEADER_HTML;
    applyBrandMark(document.body);

    expect(ourMarks()).toHaveLength(1);
    expect(siteName()?.nextElementSibling).toBe(ourMark());
  });

  it('should leave the page exactly as the site wrote it once the word is taken back', () => {
    const siteHtml = document.body.innerHTML;
    applyBrandMark(document.body);

    removeBrandMarks(document.body);

    expect(document.body.innerHTML).toBe(siteHtml);
  });

  it('should write nothing when there is no word to take back', () => {
    const observer = observeBody();

    removeBrandMarks(document.body);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
