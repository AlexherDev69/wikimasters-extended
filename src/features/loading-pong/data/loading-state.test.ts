import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPageLoading } from './loading-state';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../tests/fixtures');

/** The page of the collection while the site is still fetching its cards. */
const LOADING_HTML = readFileSync(join(FIXTURES_DIR, 'loading-spinner.html'), 'utf-8');
const GRID_HTML = readFileSync(join(FIXTURES_DIR, 'card-grid-with-description.html'), 'utf-8');

/** As if the overlay had scanned one card of the page. */
const ONE_CARD = 1;
const NO_CARD = 0;

describe('isPageLoading', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should say the page is loading when a spinner is alone on it', () => {
    document.body.innerHTML = LOADING_HTML;

    expect(isPageLoading(document.body, NO_CARD)).toBe(true);
  });

  it('should say the page is not loading when it shows no spinner', () => {
    document.body.innerHTML = GRID_HTML;

    expect(isPageLoading(document.body, ONE_CARD)).toBe(false);
  });

  it('should say the page is not loading when a spinner turns beside a card', () => {
    // The site spins the same utility inside a button of its own here and
    // there: something to look at is already on the page.
    document.body.innerHTML = GRID_HTML + LOADING_HTML;

    expect(isPageLoading(document.body, ONE_CARD)).toBe(false);
  });

  it('should say the page is not loading when it is simply empty', () => {
    expect(isPageLoading(document.body, NO_CARD)).toBe(false);
  });
});
