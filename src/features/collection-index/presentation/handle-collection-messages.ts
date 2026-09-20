import type { Logger } from '../../../core/logger/logger';
import type { CardFactsCache, ClassTargetCache } from '../../categorization/domain/ports';
import type { CatalogueTotalsRepository } from '../domain/catalogue-totals';
import type { CollectionIndexRepository } from '../domain/collection-index';
import { summarizeCollection } from '../domain/summarize-collection';
import {
  INDEX_UNAVAILABLE_ERROR,
  INVALID_REQUEST_ERROR,
  isClearCollectionIndexRequest,
  isCollectionIndexMessage,
  isGetCollectionSummaryRequest,
  isRecordCatalogueTotalsRequest,
  isRecordCollectionCardsRequest,
  type ClearCollectionIndexResponse,
  type CollectionIndexErrorResponse,
  type CollectionSummaryResponse,
  type RecordCatalogueTotalsResponse,
  type RecordCollectionCardsResponse,
} from './messages';

export type CollectionMessageResponse =
  | RecordCollectionCardsResponse
  | RecordCatalogueTotalsResponse
  | CollectionSummaryResponse
  | ClearCollectionIndexResponse
  | CollectionIndexErrorResponse;

type SendCollectionResponse = (response: CollectionMessageResponse) => void;

export type CollectionMessageHandler = (
  message: unknown,
  sendResponse: SendCollectionResponse,
) => boolean;

export interface CollectionMessageDeps {
  indexRepository: CollectionIndexRepository;
  /** Totals the content script read on the catalogue page of the site. */
  catalogueTotalsRepository: CatalogueTotalsRepository;
  cardFactsCache: CardFactsCache;
  classTargetCache: ClassTargetCache;
  logger: Logger;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Runs `task` and answers with its result. A rejection is logged and answered
 * with an error shape: whoever asked must never be left waiting for a response
 * that will not come.
 *
 * The rejection handler is the second argument of `then` and not a `catch`
 * after it: a `catch` would also run when `sendResponse` itself throws, and
 * answer a second time for an operation that had succeeded.
 */
function answer(
  task: () => Promise<CollectionMessageResponse>,
  sendResponse: SendCollectionResponse,
  logger: Logger,
): boolean {
  void task().then(sendResponse, (error: unknown) => {
    logger.error('Collection index message failed', { error: toErrorMessage(error) });
    sendResponse({ error: INDEX_UNAVAILABLE_ERROR });
  });

  return true;
}

/**
 * Handles the four messages of the collection index. Returns true so the
 * caller keeps the message channel open, and false for a message of another
 * feature, which is simply ignored.
 *
 * A known message type carrying an invalid payload is answered with an error
 * rather than ignored: it comes from our own code, and a silent drop would
 * look exactly like a service worker that never woke up.
 *
 * Kept out of the entrypoint so it can be unit-tested.
 */
export function createCollectionMessageHandler(
  deps: CollectionMessageDeps,
): CollectionMessageHandler {
  return function handleCollectionMessage(
    message: unknown,
    sendResponse: SendCollectionResponse,
  ): boolean {
    if (isRecordCollectionCardsRequest(message)) {
      return answer(
        async () => {
          await deps.indexRepository.upsert(message.cards);
          return { recorded: message.cards.length };
        },
        sendResponse,
        deps.logger,
      );
    }

    if (isRecordCatalogueTotalsRequest(message)) {
      return answer(
        async () => {
          await deps.catalogueTotalsRepository.save(message.totals);
          return { recorded: true };
        },
        sendResponse,
        deps.logger,
      );
    }

    if (isGetCollectionSummaryRequest(message)) {
      return answer(
        async () => ({ summary: await summarizeCollection(deps) }),
        sendResponse,
        deps.logger,
      );
    }

    if (isClearCollectionIndexRequest(message)) {
      return answer(
        async () => {
          await deps.indexRepository.clear();
          return { cleared: true };
        },
        sendResponse,
        deps.logger,
      );
    }

    if (isCollectionIndexMessage(message)) {
      sendResponse({ error: INVALID_REQUEST_ERROR });
      return true;
    }
    return false;
  };
}
