/**
 * The addresses this feature is willing to put in the `src` of its own image.
 *
 * A thumbnail address is not built here, it is RECEIVED: the frwiki API answers
 * with the address of the file on the Wikimedia thumbnail servers, tracking
 * parameters included, and that address is kept exactly as given. Nothing in it
 * is rebuilt, so the only thing standing between an answer and an attribute of
 * the page is this guard, which every boundary applies again: the source, the
 * cache, the message and the DOM.
 */

/**
 * The two hosts Wikimedia serves file thumbnails from. A CLOSED list, matched
 * on the whole host and never by a suffix: `upload.wikimedia.org.evil.example`
 * ends with one of these names and is a host of somebody else entirely.
 *
 * The comparison uses `URL.host`, which carries the port when there is one, so
 * a thumbnail offered on another port is refused along with the rest.
 */
const THUMBNAIL_HOSTS: readonly string[] = ['upload.wikimedia.org', 'thumb.wikimedia.org'];

const HTTPS_PROTOCOL = 'https:';

/**
 * Narrows an address read back from the API, from storage or from a message.
 * Anything that does not pass is treated as "not resolved", which costs the
 * card nothing: the address the extension builds itself is used instead.
 */
export function isWikimediaThumbnailUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    // Not an absolute URL at all: a relative path, a `javascript:` payload with
    // no host, or plain text.
    return false;
  }

  return (
    parsed.protocol === HTTPS_PROTOCOL &&
    // Credentials in an address are never part of a Wikimedia thumbnail, and
    // they are how a look-alike hides its real host from a hurried reader.
    parsed.username === '' &&
    parsed.password === '' &&
    THUMBNAIL_HOSTS.includes(parsed.host)
  );
}
