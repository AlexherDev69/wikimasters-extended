import { defineConfig } from 'wxt';

const EXTENSION_NAME = 'WikiMasters Extended';

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
  manifest: {
    name: EXTENSION_NAME,
    description:
      // Chrome cuts a description at 132 characters, so this one names the
      // three features that are visible on a card and stops there.
      "Overlay en lecture seule pour wiki-masters.com : images manquantes, bouton Wikipédia et lien Letterboxd, cartes des échanges.",
    version: '0.1.0',
    // The popup entrypoint gives the button its window; only the tooltip is
    // left to declare here.
    action: { default_title: EXTENSION_NAME },
    permissions: ['storage'],
    // The only outgoing hosts. The site itself is never called by the extension.
    host_permissions: ['https://fr.wikipedia.org/*', 'https://query.wikidata.org/*'],
  },
});
