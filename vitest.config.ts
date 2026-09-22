import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    /**
     * One environment per worker instead of one per file. The suite spent 246
     * seconds building happy-dom 90 times, which was 89 percent of its whole
     * running time.
     *
     * Per-file isolation is kept, so this is not the same trade as
     * `isolate: false`: what is shared is the virtual machine, not the state
     * of a test. The eleven files that drive `fakeBrowser` all reset it in
     * `beforeEach`, so nothing of one file reaches another.
     */
    pool: 'vmThreads',
  },
});
