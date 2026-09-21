import { browser } from '#imports';
import { createLogger } from '../../core/logger/logger';
import { createSettingsRepository } from '../../features/settings/data/settings-repository';
import type { Settings } from '../../features/settings/domain/settings';
import { mountPopup } from '../../features/settings/presentation/popup-app';

const APP_ELEMENT_ID = 'app';

const OPEN_FAILED_MESSAGE = 'The options page could not be opened';

const logger = createLogger('popup');

const container = document.getElementById(APP_ELEMENT_ID);
if (container === null) {
  logger.error('The popup has no container element');
} else {
  // The settings are read and written straight from storage: they are not the
  // business of the service worker, and the tabs of the site follow the change
  // through the watcher of the repository.
  const settingsRepository = createSettingsRepository();

  mountPopup(container, {
    // The strict read: a window that showed the defaults it had not read
    // would write those switches over the saved ones on the next toggle.
    readSettings: (): Promise<Settings> => settingsRepository.readStrict(),
    writeSettings: (settings: Settings): Promise<void> => settingsRepository.write(settings),
    openOptions: (): void => {
      // The browser closes this window as the options page opens, so a
      // failure has nowhere left to be shown: it is logged instead.
      browser.runtime.openOptionsPage().catch((error: unknown) => {
        logger.error(OPEN_FAILED_MESSAGE, {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
  });
}
