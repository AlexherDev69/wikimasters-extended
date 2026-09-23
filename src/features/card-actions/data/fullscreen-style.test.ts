import { describe, it, expect, beforeEach } from 'vitest';
import { FULLSCREEN_STYLE_SELECTOR } from './card-actions-selectors';
import { removeFullscreenStyle, writeFullscreenStyle } from './fullscreen-style';

function styles(): NodeListOf<Element> {
  return document.head.querySelectorAll(FULLSCREEN_STYLE_SELECTOR);
}

describe('writeFullscreenStyle', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('should add one style sheet that zooms the card by the number given', () => {
    writeFullscreenStyle(document, 2.5);

    expect(styles()).toHaveLength(1);
    expect(styles()[0]?.textContent).toContain('zoom: 2.5;');
  });

  it('should only reach a node in full screen that holds our bar of buttons', () => {
    writeFullscreenStyle(document, 2);

    expect(styles()[0]?.textContent).toContain(':fullscreen:has(> div[data-wme-card-actions])');
  });

  it('should write nothing when the style sheet already says the same zoom', () => {
    writeFullscreenStyle(document, 2);
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });

    writeFullscreenStyle(document, 2);

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });

  it('should rewrite the one style sheet when the zoom changes', () => {
    writeFullscreenStyle(document, 2);

    writeFullscreenStyle(document, 1.25);

    expect(styles()).toHaveLength(1);
    expect(styles()[0]?.textContent).toContain('zoom: 1.25;');
  });
});

describe('removeFullscreenStyle', () => {
  it('should take the style sheet back, and do nothing when there is none', () => {
    writeFullscreenStyle(document, 2);

    removeFullscreenStyle(document);
    removeFullscreenStyle(document);

    expect(styles()).toHaveLength(0);
  });
});
