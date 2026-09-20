import { describe, it, expect, vi } from 'vitest';
import type { Logger } from '../../../core/logger/logger';
import { createActionClickHandler } from './handle-action-click';

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createActionClickHandler', () => {
  it('should open the options page when the icon is clicked', () => {
    const openOptionsPage = vi.fn(() => Promise.resolve());

    createActionClickHandler(openOptionsPage, makeLogger())();

    expect(openOptionsPage).toHaveBeenCalledOnce();
  });

  it('should log the failure when the options page cannot be opened', async () => {
    const logger = makeLogger();
    const openOptionsPage = (): Promise<void> => Promise.reject(new Error('no window'));

    createActionClickHandler(openOptionsPage, logger)();

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        'The options page could not be opened',
        expect.objectContaining({ error: 'no window' }),
      );
    });
  });
});
