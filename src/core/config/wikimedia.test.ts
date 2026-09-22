import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { API_USER_AGENT } from './wikimedia';

/**
 * The version the extension tells Wikimedia about is written by hand in
 * `wikimedia.ts`, and it drifted: the header said 0.1.0 while the package,
 * the config and the built manifest all said 0.1.1. The comment above the
 * constant claimed it was kept in sync, which made the drift harder to see
 * rather than easier.
 *
 * These tests are what the comment could not be. They read the two files that
 * declare the version rather than repeating the number, so there is no third
 * place to forget.
 */

/**
 * Reads a file of the repository by its name. Resolved against the working
 * directory, which vitest sets to the root of the project, and not against
 * `import.meta.url`, which vitest rewrites.
 */
function readFromRoot(name: string): string {
  return readFileSync(join(process.cwd(), name), 'utf8');
}

const PACKAGE_VERSION = (JSON.parse(readFromRoot('package.json')) as { version: string }).version;

/** The `version` of the manifest, as `wxt.config.ts` writes it. */
const MANIFEST_VERSION_PATTERN = /version: '([^']+)'/;

describe('API_USER_AGENT', () => {
  it('should carry the version the package declares', () => {
    // A leading slash and a trailing space, so 0.1.1 cannot match 0.1.10.
    expect(API_USER_AGENT).toContain(`/${PACKAGE_VERSION} `);
  });

  it('should carry the version the manifest is built with', () => {
    const declared = MANIFEST_VERSION_PATTERN.exec(readFromRoot('wxt.config.ts'));

    expect(declared?.[1]).toBe(PACKAGE_VERSION);
  });

  it('should name the extension and where it comes from, which is what Wikimedia asks of a client', () => {
    expect(API_USER_AGENT).toMatch(
      /^WikiMastersExtended\/\d+\.\d+\.\d+ \(https:\/\/github\.com\/[^)]+\)$/,
    );
  });
});
