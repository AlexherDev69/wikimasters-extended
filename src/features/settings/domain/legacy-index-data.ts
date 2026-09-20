/**
 * What is left on the machine of the collection index, the feature this
 * version removed. Nothing writes those keys any more, so the options page
 * offers to delete them once, and only while at least one of them is there.
 *
 * A port of its own rather than a branch of the categorization maintenance:
 * the two have nothing in common but the storage area they read.
 */
export interface LegacyIndexData {
  /** True while at least one of those keys is still stored. */
  isPresent(): Promise<boolean>;
  /** Removes those keys, and strictly nothing else. */
  remove(): Promise<void>;
}
