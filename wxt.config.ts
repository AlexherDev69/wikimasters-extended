import { defineConfig } from 'wxt';

const EXTENSION_NAME = 'WikiMasters Extended';

/**
 * The name the development build carries instead. It is loaded from another
 * folder than a release, so the browser gives it an identity of its own and
 * the two sit side by side on chrome://extensions and about:debugging: without
 * this, two cards would show the same name, the same version and the same
 * icon, and the only way to tell which is which would be the folder each was
 * loaded from.
 *
 * `command` is "serve" for `wxt` alone, which is the build that lands in
 * .output/chrome-mv3-dev, and "build" for `wxt build` and `wxt zip`. A
 * release therefore cannot pick this name up, whatever mode it is built in.
 */
const DEV_SUFFIX = ' (dev)';

/**
 * The identity Firefox files this extension under, and the one AMO ties the
 * listing to. It is permanent: once a version is signed with it, changing it
 * makes a different extension, which installs beside the first instead of
 * updating it. Chrome ignores the key, so it is only written on the Firefox
 * build.
 */
const GECKO_ID = 'wikimasters-extended@mattouriste.github.io';

/**
 * The oldest Firefox the package declares. 128 rather than the 109 that first
 * shipped MV3: it is the version from which host permissions are asked for in
 * the install prompt and granted with it, so `host_permissions` below behaves
 * the way it does in Chrome instead of starting out ungranted. Zen is built on
 * a far more recent Firefox, so this costs it nothing.
 */
const FIREFOX_MIN_VERSION = '128.0';

export default defineConfig({
  srcDir: 'src',
  imports: false,
  /**
   * WXT builds Firefox as MV2 by default. Pinned to 3 so both packages carry
   * the same manifest, the same split between `permissions` and
   * `host_permissions`, and a background that starts on demand: one extension
   * to reason about rather than two. Firefox has no service worker for an
   * extension, so WXT writes the same file as `background.scripts` there,
   * which Firefox runs as an event page.
   */
  manifestVersion: 3,
  // The options page is an HTML page, so Vite would add its modulepreload
  // polyfill to it. That polyfill calls `fetch`, which an extension that
  // performs no request of its own in that page has no reason to ship. Chrome
  // and Firefox both support modulepreload natively, so the preload links keep
  // working.
  vite: () => ({
    build: { modulePreload: { polyfill: false } },
  }),
  // The site's Turnstile check rejects automated browser profiles, so the dev
  // build is loaded manually into the developer's own browser instead.
  webExt: {
    disabled: true,
  },
  zip: {
    /**
     * `wxt zip -b firefox` also archives the sources, which AMO requires for a
     * bundled package. That archive is built from the working tree and does
     * NOT read .gitignore, so anything ignored but still on disk would be
     * handed to Mozilla. The raw page exports may carry a real pseudonym and
     * private messages, hence the first line; the rest is only noise.
     */
    excludeSources: ['tests/fixtures/raw/**', 'coverage/**', '**/*.log', '.output/**'],
  },
  manifest: ({ browser, command }) => {
    const name = command === 'serve' ? `${EXTENSION_NAME}${DEV_SUFFIX}` : EXTENSION_NAME;

    return {
      name,
      description:
        // Chrome cuts a description at 132 characters, so this one names the
        // three features that are visible on a card and stops there.
        "Overlay en lecture seule pour wiki-masters.com : images manquantes, bouton Wikipédia et lien Letterboxd, cartes des échanges.",
      version: '0.1.3',
      // No `action` here: the popup entrypoint writes the whole field, its
      // window from the file itself and its tooltip from the <title> of that
      // file, and it overrides whatever this config declares. Measured on the
      // built manifest, not assumed.
      permissions: ['storage'],
      // The only outgoing hosts. The site itself is never called by the extension.
      host_permissions: ['https://fr.wikipedia.org/*', 'https://query.wikidata.org/*'],
      ...(browser === 'firefox'
        ? {
            browser_specific_settings: {
              gecko: {
                id: GECKO_ID,
                strict_min_version: FIREFOX_MIN_VERSION,
                /**
                 * What leaves the machine, which Firefox shows in the install
                 * prompt and AMO requires since November 2025. The titles of
                 * the cards are read from the page and sent to Wikipedia and
                 * Wikidata to find an image, and that is content of a website
                 * handled outside the browser, so it is declared rather than
                 * "none". Nothing is collected for us: there is no server of
                 * ours, no telemetry, and the counters of the popup never
                 * leave `storage.local`.
                 */
                data_collection_permissions: {
                  required: ['websiteContent'],
                },
              },
            },
          }
        : {}),
    };
  },
});
