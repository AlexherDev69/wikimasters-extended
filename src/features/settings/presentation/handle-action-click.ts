import type { Logger } from '../../../core/logger/logger';

/** Opening the options page, the one thing the toolbar button does. */
export type OpenOptionsPage = () => Promise<void>;

const OPEN_FAILED_MESSAGE = 'The options page could not be opened';

/**
 * What a click on the icon of the extension does now that there is no popup
 * left to open. The browser decides where the options page opens, and there is
 * no window of ours on screen to show a failure in, so a rejection is logged
 * rather than shown: swallowing it would leave no trace at all.
 *
 * Kept out of the entrypoint so it can be unit-tested.
 */
export function createActionClickHandler(
  openOptionsPage: OpenOptionsPage,
  logger: Logger,
): () => void {
  return function handleActionClick(): void {
    openOptionsPage().catch((error: unknown) => {
      logger.error(OPEN_FAILED_MESSAGE, {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  };
}
