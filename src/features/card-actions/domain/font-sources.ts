/**
 * Reading the two descriptors of a `@font-face` rule the copy of a card needs:
 * which family it declares, and which files it loads.
 */

/** Quotes around one family name, which CSS may or may not write. */
const QUOTES_PATTERN = /^["']|["']$/g;

/**
 * The names a `font-family` value lists, in order and without their quotes:
 * `Inter, "Inter Fallback"` gives both names, the way the page wrote them.
 */
export function fontFamilyNames(value: string): string[] {
  return value
    .split(',')
    .map((name) => name.trim().replace(QUOTES_PATTERN, ''))
    .filter((name) => name.length > 0);
}

/**
 * One `url(...)` of a `src` descriptor, quoted twice, once or not at all.
 * Read with `matchAll`, which works on a copy: the `lastIndex` of this one
 * never moves.
 */
const URL_PATTERN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g;

/**
 * The addresses a `src` descriptor loads, exactly as the rule writes them, so
 * each can be found again in the text of the rule. A `local()` source names a
 * font of the machine and loads nothing, so it gives no address.
 */
export function sourceUrls(src: string): string[] {
  const urls: string[] = [];
  for (const match of src.matchAll(URL_PATTERN)) {
    const url = match[1] ?? match[2] ?? match[3] ?? '';
    if (url.length > 0) {
      urls.push(url);
    }
  }
  return urls;
}
