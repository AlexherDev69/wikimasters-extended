import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBlob } from 'html-to-image';
import { CARD_BUTTON_ATTRIBUTE } from '../../letterboxd/data/card-button-selectors';
import { WIKIPEDIA_BUTTON_ATTRIBUTE } from '../../wikipedia-link/data/wikipedia-button-selectors';
import { snapshotCard } from './card-snapshot';
import { buildFontEmbedCss } from './font-embed';

// The library paints on a canvas, which happy-dom does not have: what is
// tested here is what this extension asks of it.
vi.mock('html-to-image', () => ({ toBlob: vi.fn() }));
vi.mock('./font-embed', () => ({ buildFontEmbedCss: vi.fn() }));

/** The options of the library, which it declares without exporting them. */
type Options = NonNullable<Parameters<typeof toBlob>[1]>;

const PICTURE = new Blob(['png'], { type: 'image/png' });
const FONTS_CSS = '@font-face { font-family: Inter; }';

/** The options the library was called with, on its only call. */
function optionsGiven(): Options {
  const [call] = vi.mocked(toBlob).mock.calls;
  const options = call?.[1];
  if (options === undefined) {
    throw new Error('The library was not called with options');
  }
  return options;
}

function keeps(node: Node): boolean {
  const { filter } = optionsGiven();
  if (filter === undefined) {
    throw new Error('No filter was given');
  }
  // The library hands its filter every child, text nodes included.
  return filter(node as HTMLElement);
}

describe('snapshotCard', () => {
  beforeEach(() => {
    vi.mocked(toBlob).mockReset();
    vi.mocked(toBlob).mockResolvedValue(PICTURE);
    vi.mocked(buildFontEmbedCss).mockResolvedValue(FONTS_CSS);
  });

  it('should draw the card given and answer with the picture', async () => {
    const card = document.createElement('div');

    await expect(snapshotCard(card)).resolves.toBe(PICTURE);
    expect(vi.mocked(toBlob).mock.calls[0]?.[0]).toBe(card);
  });

  it('should keep the query of every address, which tells the pictures of the site apart', async () => {
    await snapshotCard(document.createElement('div'));

    expect(optionsGiven().includeQueryParams).toBe(true);
  });

  it('should read the pictures from the cache, without a cookie', async () => {
    await snapshotCard(document.createElement('div'));

    expect(optionsGiven().fetchRequestInit).toEqual({ cache: 'force-cache', credentials: 'omit' });
  });

  it('should hand the library the fonts it built, so the library never looks for them', async () => {
    await snapshotCard(document.createElement('div'));

    expect(optionsGiven().fontEmbedCSS).toBe(FONTS_CSS);
  });

  it('should draw at twice the size of the card', async () => {
    await snapshotCard(document.createElement('div'));

    expect(optionsGiven().pixelRatio).toBe(2);
  });

  it('should leave out the buttons of the extension and keep everything else', async () => {
    await snapshotCard(document.createElement('div'));
    const wikipediaButton = document.createElement('a');
    wikipediaButton.setAttribute(WIKIPEDIA_BUTTON_ATTRIBUTE, '');
    const letterboxdButton = document.createElement('a');
    letterboxdButton.setAttribute(CARD_BUTTON_ATTRIBUTE, '');

    expect(keeps(wikipediaButton)).toBe(false);
    expect(keeps(letterboxdButton)).toBe(false);
    expect(keeps(document.createElement('h3'))).toBe(true);
    expect(keeps(document.createTextNode('Dvorichté'))).toBe(true);
  });

  it('should fail when the library draws nothing', async () => {
    vi.mocked(toBlob).mockResolvedValue(null);

    await expect(snapshotCard(document.createElement('div'))).rejects.toThrow(
      'The card could not be drawn',
    );
  });
});
