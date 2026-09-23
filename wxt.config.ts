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

export default defineConfig({
  srcDir: 'src',
  imports: false,
  // The options page is an HTML page, so Vite would add its modulepreload
  // polyfill to it. That polyfill calls `fetch`, which an extension that
  // performs no request of its own in that page has no reason to ship. Chrome
  // supports modulepreload natively, so the preload links keep working.
  vite: () => ({
    build: { modulePreload: { polyfill: false } },
  }),
  // The site's Turnstile check rejects automated browser profiles, so the dev
  // build is loaded manually into the developer's own Chrome instead.
  webExt: {
    disabled: true,
  },
  manifest: ({ command }) => {
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
    };
  },
});
