import { defineConfig } from 'wxt';

const EXTENSION_NAME = 'WikiMasters Extended';

/**
 * The name the development build carries instead. It is loaded from another
 * folder than a release, so Chrome gives it an identity of its own and the
 * two sit side by side on chrome://extensions: without this, two cards would
 * show the same name, the same version and the same icon, and the only way
 * to tell which is which would be the folder each was loaded from.
 *
 * `command` is "serve" for `wxt` alone, which is the build that lands in
 * .output/chrome-mv3-dev, and "build" for `wxt build` and `wxt zip`. A
 * release therefore cannot pick this name up, whatever mode it is built in.
 */
const DEV_SUFFIX = ' (dev)';

/**
 * The identity Firefox files the extension under. It becomes permanent with
 * the first version Mozilla signs: another one would make another extension,
 * installed beside this one instead of updating it.
 */
const GECKO_ID = 'wikimasters-extended@alexherdev69.github.io';

/**
 * From Firefox 127 on, the host permissions of a Manifest V3 extension are
 * granted with the install instead of waiting for the user to allow them, so
 * the calls to Wikimedia work from the first page, as they do on Chrome. 128
 * is the extended support release that follows.
 */
const FIREFOX_MIN_VERSION = '128.0';

export default defineConfig({
  srcDir: 'src',
  imports: false,
  // WXT builds Firefox in Manifest V2 by default. Pinned to 3, the Firefox
  // package declares its permissions the way the Chrome one does, and there is
  // one manifest format to reason about instead of two.
  manifestVersion: 3,
  zip: {
    // `wxt zip -b firefox` also packs the sources Mozilla asks for, and that
    // archive does not read .gitignore: the raw page exports, which carry a
    // real pseudonym, are kept out of it by name.
    excludeSources: ['tests/fixtures/raw/**'],
  },
  // The options page is an HTML page, so Vite would add its modulepreload
  // polyfill to it. That polyfill calls `fetch`, which an extension that
  // performs no request of its own in that page has no reason to ship. Chrome
  // supports modulepreload natively, so the preload links keep working.
  vite: () => ({
    build: { modulePreload: { polyfill: false } },
  }),
  // The site's Turnstile check rejects automated browser profiles, so the dev
  // build is loaded manually into the developer's own browser instead.
  webExt: {
    disabled: true,
  },
  manifest: ({ browser, command }) => {
    const name = command === 'serve' ? `${EXTENSION_NAME}${DEV_SUFFIX}` : EXTENSION_NAME;

    return {
      name,
      description:
        // Chrome cuts a description at 132 characters, so this one names the
        // three features that are visible on a card and stops there.
        "Overlay en lecture seule pour wiki-masters.com : images manquantes, bouton Wikipédia et lien Letterboxd, cartes des échanges.",
      // Firefox only: Chrome would flag these keys as unknown on its
      // extensions page.
      ...(browser === 'firefox'
        ? {
            browser_specific_settings: {
              gecko: {
                id: GECKO_ID,
                strict_min_version: FIREFOX_MIN_VERSION,
                // The titles of the cards are read on the page and sent to
                // Wikipedia and Wikidata: content of a website that leaves the
                // browser, which Mozilla asks to declare. Nothing goes to a
                // server of ours, there is none.
                data_collection_permissions: {
                  required: ['websiteContent'],
                },
              },
            },
          }
        : {}),
      version: '0.1.4',
      // No `action` here: the popup entrypoint writes the whole field, its
      // window from the file itself and its tooltip from the <title> of that
      // file, and it overrides whatever this config declares. Measured on the
      // built manifest, not assumed.
      permissions: ['storage'],
      // The only outgoing hosts. The site itself is never called by the extension.
      host_permissions: ['https://fr.wikipedia.org/*', 'https://query.wikidata.org/*'],
    };
  },
});
