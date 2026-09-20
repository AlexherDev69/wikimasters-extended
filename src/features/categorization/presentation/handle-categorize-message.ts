import { categorizeCards, type CategorizeCardsDeps } from '../domain/categorize-cards';
import { isCategorizeCardsRequest, type CategorizeCardsResponse } from './messages';

type SendCategorizeResponse = (response: CategorizeCardsResponse) => void;

export type CategorizeMessageHandler = (
  message: unknown,
  sendResponse: SendCategorizeResponse,
) => boolean;

/**
 * Answers a categorization message asynchronously. Returns true so the caller
 * keeps the message channel open, and false for any other message.
 *
 * Kept out of the entrypoint so it can be unit-tested.
 */
export function createCategorizeMessageHandler(
  deps: CategorizeCardsDeps,
): CategorizeMessageHandler {
  return function handleCategorizeMessage(
    message: unknown,
    sendResponse: SendCategorizeResponse,
  ): boolean {
    if (!isCategorizeCardsRequest(message)) {
      return false;
    }

    void categorizeCards(message.cards, deps)
      .then((cards) => {
        sendResponse({ cards });
      })
      .catch((error: unknown) => {
        // The use case is not supposed to reject: answer anyway so that the
        // content script never waits for a response that will not come.
        deps.logger.error('Categorization failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        sendResponse({ cards: [] });
      });

    return true;
  };
}
