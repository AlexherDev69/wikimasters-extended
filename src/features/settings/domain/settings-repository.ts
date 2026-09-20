import type { Settings } from './settings';

/** Called with the new settings every time they change, wherever from. */
export type SettingsListener = (settings: Settings) => void;

/** Takes back the listener a `watch` added. */
export type UnwatchSettings = () => void;

/**
 * Where the settings are kept. `watch` is what lets an open tab of the site
 * follow a switch flipped in the options page without a reload, and what the
 * content script gives up when its context is invalidated.
 *
 * There are two reads because the two callers need opposite things of a
 * failure. A failed `read` gives the defaults rather than rejecting: the
 * overlay must never stay off the page because storage answered badly.
 * `readStrict` rejects instead, for the options page, which must never show
 * four boxes it did not read: the next toggle would write those four over
 * whatever the user had really saved.
 *
 * A value that is there but corrupted is not a failure: both reads normalize
 * it, because the defaults ARE what the extension does with it.
 *
 * A failed `write` rejects, so the options page can say so.
 */
export interface SettingsRepository {
  read(): Promise<Settings>;
  readStrict(): Promise<Settings>;
  write(settings: Settings): Promise<void>;
  watch(listener: SettingsListener): UnwatchSettings;
}
