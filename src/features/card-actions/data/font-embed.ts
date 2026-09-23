import { fontFamilyNames, sourceUrls } from '../domain/font-sources';

/**
 * The fonts of the card, written as `@font-face` rules whose files are data
 * URLs, for the picture of the card to be set in the typeface of the site.
 * The picture is drawn from an SVG image, and an image loads nothing of its
 * own: a font it names but does not carry falls back to the default one.
 *
 * Built here rather than left to `html-to-image`, whose own way inserts rules
 * into the style sheets of the page when it cannot read one: a write on the
 * site, which this extension never makes. Here every sheet is only read, and a
 * sheet the browser does not let us read is left alone.
 *
 * Only a file the page has already loaded is ever embedded, read from the
 * cache of the browser and never asked of the network: copying a card sends
 * no request to the site. A file missing from the cache leaves its rule out,
 * and the text falls back to the next font the page names.
 */

/** Reads the cache only, which the browser allows for the page's own origin alone. */
const CACHE_ONLY: RequestInit = { cache: 'only-if-cached', mode: 'same-origin' };

/** How many bytes are turned into characters at once, well under any call stack limit. */
const BYTES_PER_CHUNK = 0x8000;

const FONT_FAMILY_DESCRIPTOR = 'font-family';
const SRC_DESCRIPTOR = 'src';
const DESCENDANTS_SELECTOR = '*';

interface FontFaceOfSheet {
  rule: CSSFontFaceRule;
  /** What the addresses of the rule are relative to: the sheet, or the page for an inline one. */
  baseUrl: string;
}

/** Every family the card and its descendants are set in. */
function usedFamilies(card: Element): Set<string> {
  const families = new Set<string>();
  for (const element of [card, ...card.querySelectorAll(DESCENDANTS_SELECTOR)]) {
    for (const name of fontFamilyNames(getComputedStyle(element).fontFamily)) {
      families.add(name);
    }
  }
  return families;
}

/** The `@font-face` rules of every sheet the browser lets the page read. */
function readableFontFaces(document: Document): FontFaceOfSheet[] {
  const faces: FontFaceOfSheet[] = [];
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // A sheet of another origin that does not allow reading: left alone.
      continue;
    }
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) {
        faces.push({ rule, baseUrl: sheet.href ?? document.baseURI });
      }
    }
  }
  return faces;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += BYTES_PER_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + BYTES_PER_CHUNK));
  }
  return btoa(binary);
}

/** The file at `url` as a data URL, from the cache of the browser and nowhere else. */
async function cachedDataUrl(url: string): Promise<string> {
  const response = await fetch(url, CACHE_ONLY);
  if (!response.ok) {
    throw new Error('The font is not in the cache');
  }
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type};base64,${toBase64(bytes)}`;
}

/**
 * The text of the rule with each file replaced by its data URL, or null when
 * one of them cannot be embedded: a rule that still named a file would make
 * the picture wait for a load that never comes.
 */
async function embedFace(face: FontFaceOfSheet, pageOrigin: string): Promise<string | null> {
  let cssText = face.rule.cssText;
  for (const url of sourceUrls(face.rule.style.getPropertyValue(SRC_DESCRIPTOR))) {
    const absolute = new URL(url, face.baseUrl);
    if (absolute.origin !== pageOrigin) {
      return null;
    }
    try {
      cssText = cssText.split(url).join(await cachedDataUrl(absolute.href));
    } catch {
      return null;
    }
  }
  return cssText;
}

/**
 * The `@font-face` rules the card needs, with their files inside them. Empty
 * when the page declares none of the families the card uses, or when none of
 * their files is in the cache: the picture is then set in a fallback font.
 */
export async function buildFontEmbedCss(card: Element): Promise<string> {
  const document = card.ownerDocument;
  const families = usedFamilies(card);
  const pageOrigin = new URL(document.baseURI).origin;

  const needed = readableFontFaces(document).filter(({ rule }) => {
    const [family] = fontFamilyNames(rule.style.getPropertyValue(FONT_FAMILY_DESCRIPTOR));
    return family !== undefined && families.has(family);
  });
  const embedded = await Promise.all(needed.map((face) => embedFace(face, pageOrigin)));

  return embedded.filter((cssText): cssText is string => cssText !== null).join('\n');
}
