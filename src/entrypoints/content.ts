import { defineContentScript } from '#imports';
import { SITE_MATCH_PATTERNS } from '../core/config/site';
import { createLogger } from '../core/logger/logger';
import { observeCards } from '../features/card-detection/data/card-observer';
import { scanCards, type ObservedCard } from '../features/card-detection/data/scan-cards';
import { handleScan } from '../features/card-detection/presentation/handle-scan';

export default defineContentScript({
  matches: [...SITE_MATCH_PATTERNS],
  runAt: 'document_idle',
  main(ctx): void {
    const logger = createLogger('content-script');
    const seenTitles = new Set<string>();

    function onScan(observedCards: ObservedCard[]): void {
      handleScan(observedCards, seenTitles, logger);
    }

    const root = document.body;
    onScan(scanCards(root));

    const disconnect = observeCards({ root, onScan });
    ctx.onInvalidated(disconnect);
  },
});
