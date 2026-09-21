/**
 * Whether the compact view is on, kept between two visits. It is a preference
 * of the page rather than a setting of the options, because it is flipped
 * from the page itself, in the middle of looking at cards: the button is
 * right there, and the view it gives has to still be there tomorrow.
 *
 * A failed read gives "off" rather than rejecting, exactly as the settings
 * fall back to their defaults: the cards as the site draws them are a state
 * the user can read, an overlay that never draws is not.
 */
export interface CompactPreferenceStore {
  read(): Promise<boolean>;
  write(isCompact: boolean): Promise<void>;
}
