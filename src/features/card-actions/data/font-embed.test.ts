import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { buildFontEmbedCss } from './font-embed';

/** Two families of the site, and one the card does not use. */
const FONT_RULES = `
@font-face { font-family: Inter; src: url("/media/inter.woff2") format("woff2"); }
@font-face { font-family: "Inter Fallback"; src: local("Arial"); }
@font-face { font-family: Outfit; src: url("/media/outfit.woff2") format("woff2"); }
`;

const FONT_BYTES = 'woff2-bytes';

type FetchMock = Mock<(input: string, init?: RequestInit) => Promise<Response>>;

function addStyle(css: string): void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

/** A card set in the body font of the site, as its computed style says. */
function makeCard(): HTMLElement {
  const card = document.createElement('div');
  card.style.fontFamily = 'Inter, "Inter Fallback"';
  card.appendChild(document.createElement('h3'));
  document.body.appendChild(card);
  return card;
}

function fontResponse(): Response {
  return new Response(new Blob([FONT_BYTES], { type: 'font/woff2' }));
}

function absolute(path: string): string {
  return new URL(path, document.baseURI).href;
}

describe('buildFontEmbedCss', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    fetchMock = vi.fn(() => Promise.resolve(fontResponse()));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should embed the file of a family the card uses, as a data URL', async () => {
    addStyle(FONT_RULES);

    const css = await buildFontEmbedCss(makeCard());

    expect(css).toContain('font-family: Inter');
    expect(css).toContain(`url("data:font/woff2;base64,${btoa(FONT_BYTES)}")`);
    expect(css).not.toContain('/media/inter.woff2');
  });

  it('should read the file from the cache only, never from the network', async () => {
    addStyle(FONT_RULES);

    await buildFontEmbedCss(makeCard());

    expect(fetchMock).toHaveBeenCalledWith(absolute('/media/inter.woff2'), {
      cache: 'only-if-cached',
      mode: 'same-origin',
    });
  });

  it('should leave out a family the card does not use, and fetch nothing for it', async () => {
    addStyle(FONT_RULES);

    const css = await buildFontEmbedCss(makeCard());

    expect(css).not.toContain('Outfit');
    expect(fetchMock).not.toHaveBeenCalledWith(absolute('/media/outfit.woff2'), expect.anything());
  });

  it('should keep a family of the machine the card uses, which loads no file', async () => {
    addStyle(FONT_RULES);

    const css = await buildFontEmbedCss(makeCard());

    expect(css).toContain('local("Arial")');
  });

  it('should leave out a rule whose file is not in the cache', async () => {
    addStyle(FONT_RULES);
    fetchMock.mockResolvedValue(new Response(null, { status: 504 }));

    const css = await buildFontEmbedCss(makeCard());

    expect(css).not.toContain('font-family: Inter;');
  });

  it('should leave out a rule whose file lives on another origin, and fetch nothing', async () => {
    addStyle('@font-face { font-family: Inter; src: url("https://fonts.example.org/inter.woff2"); }');

    const css = await buildFontEmbedCss(makeCard());

    expect(css).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should answer nothing when the page declares no font', async () => {
    await expect(buildFontEmbedCss(makeCard())).resolves.toBe('');
  });
});
