import { defineContentScript } from '#imports';
import { SITE_MATCH_PATTERNS } from '../core/config/site';
import { createLogger } from '../core/logger/logger';
import { findCardElements } from '../features/card-detection/data/find-card-elements';

export default defineContentScript({
  matches: [...SITE_MATCH_PATTERNS],
  runAt: 'document_idle',
  main(): void {
    const logger = createLogger('content-script');
    const cards = findCardElements(document);
    logger.info('Cards detected', {
      count: cards.length,
      pathname: window.location.pathname,
    });
  },
});
