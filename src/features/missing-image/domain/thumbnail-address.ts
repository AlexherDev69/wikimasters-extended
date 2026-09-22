import type { CardImage } from '../../../core/mediawiki/card-image';
import { commonsThumbnailUrl } from '../../../core/mediawiki/commons-url';
import { isWikimediaThumbnailUrl } from '../../../core/mediawiki/thumbnail-url';

/**
 * Address a picture is asked for at: the one resolved by the service worker
 * when there is one, and the one built from the file name otherwise. The
 * resolved address is checked again here, whatever the caller believes it
 * holds: this is the last step before an `src`.
 *
 * The fallback is not a failure, it is the path that shipped before the
 * addresses were resolved at all: the same picture, reached through two
 * redirects the browser is told not to cache.
 *
 * Shared by the two features that draw a Commons file: the picture the cards
 * of the site are missing, and the preview of a card named in a trade offer.
 */
export function thumbnailAddress(image: CardImage): string {
  return isWikimediaThumbnailUrl(image.thumbnailUrl)
    ? image.thumbnailUrl
    : commonsThumbnailUrl(image.fileName);
}
