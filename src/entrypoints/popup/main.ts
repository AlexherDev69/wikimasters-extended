import { browser } from '#imports';
import { createLogger } from '../../core/logger/logger';
import type { CollectionSummary } from '../../features/collection-index/domain/collection-summary';
import {
  CLEAR_COLLECTION_INDEX_MESSAGE,
  GET_COLLECTION_SUMMARY_MESSAGE,
  isClearCollectionIndexResponse,
  isCollectionSummaryResponse,
  type ClearCollectionIndexRequest,
  type GetCollectionSummaryRequest,
} from '../../features/collection-index/presentation/messages';
import { mountPopup } from '../../features/collection-index/presentation/popup-app';

const APP_ELEMENT_ID = 'app';

const logger = createLogger('popup');

const INVALID_SUMMARY_RESPONSE = 'Unexpected collection summary response';
const INVALID_CLEAR_RESPONSE = 'Unexpected clear index response';

/**
 * Both answers cross a process boundary, so they are validated like any other
 * untrusted input: an unexpected one rejects and the popup shows its error
 * screen rather than drawing something made up.
 */
async function loadSummary(): Promise<CollectionSummary> {
  const request: GetCollectionSummaryRequest = { type: GET_COLLECTION_SUMMARY_MESSAGE };
  const response: unknown = await browser.runtime.sendMessage(request);

  if (!isCollectionSummaryResponse(response)) {
    throw new Error(INVALID_SUMMARY_RESPONSE);
  }
  return response.summary;
}

async function clearIndex(): Promise<void> {
  const request: ClearCollectionIndexRequest = { type: CLEAR_COLLECTION_INDEX_MESSAGE };
  const response: unknown = await browser.runtime.sendMessage(request);

  if (!isClearCollectionIndexResponse(response)) {
    throw new Error(INVALID_CLEAR_RESPONSE);
  }
}

/**
 * The browser decides where the options page opens, and closes the popup on
 * its own. There is no popup left to show a failure in, so a rejection is
 * logged rather than shown: swallowing it would leave no trace at all.
 */
function openOptions(): void {
  browser.runtime.openOptionsPage().catch((error: unknown) => {
    logger.error('The options page could not be opened', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

const container = document.getElementById(APP_ELEMENT_ID);
if (container === null) {
  logger.error('The popup has no container element');
} else {
  mountPopup(container, { loadSummary, clearIndex, openOptions });
}
