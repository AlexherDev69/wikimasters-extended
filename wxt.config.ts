import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  imports: false,
  // The site's Turnstile check rejects automated browser profiles, so the dev
  // build is loaded manually into the developer's own Chrome instead.
  webExt: {
    disabled: true,
  },
  manifest: {
    name: 'WikiMasters Extended',
    description: "Overlay en lecture seule pour wiki-masters.com : catégorisation des cartes via Wikidata.",
    version: '0.1.0',
  },
});
