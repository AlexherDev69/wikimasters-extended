import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import contentScript from '../../src/entrypoints/content';

/**
 * Here and not beside the file it tests, which is the convention everywhere
 * else in this repository: WXT reads EVERY file of `src/entrypoints` as an
 * entrypoint of the extension, so a `content.test.ts` sitting there is a
 * second entrypoint named `content` and the build refuses to run. Nothing
 * else catches that, since the test suite, the linter, the type checker and
 * knip all pass with the file in the wrong place.
 *
 * The one piece of the content script that is a decision rather than wiring:
 * the extension may be reloaded while the settings are being read, and the
 * overlay must then never be put on the page at all.
 *
 * It matters because of what comes after it. The teardown is registered on
 * the context AFTER this point, and a listener added to a context that is
 * already invalid is never called: an overlay mounted past the guard would
 * stay on the page with nothing left able to take it back.
 */

/** A context of a content script, reduced to what `main` reads of it. */
function makeContext(isInvalid: boolean): {
  isInvalid: boolean;
  onInvalidated: ReturnType<typeof vi.fn>;
  setTimeout: ReturnType<typeof vi.fn>;
  requestAnimationFrame: ReturnType<typeof vi.fn>;
} {
  return {
    isInvalid,
    onInvalidated: vi.fn(),
    setTimeout: vi.fn(),
    requestAnimationFrame: vi.fn(),
  };
}

type ContentScriptMain = (context: ReturnType<typeof makeContext>) => Promise<void>;

/** Runs the content script's `main` against a context built here. */
async function run(isInvalid: boolean): Promise<ReturnType<typeof makeContext>> {
  const context = makeContext(isInvalid);
  await (contentScript.main as unknown as ContentScriptMain)(context);
  return context;
}

describe('the content script', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '';
  });

  it('should put nothing on the page when the extension was reloaded while the settings were read', async () => {
    const context = await run(true);

    expect(document.body.innerHTML).toBe('');
    // Registering a teardown is what comes right after the guard, so a guard
    // that let the run through would show up here even before the overlay did.
    expect(context.onInvalidated).not.toHaveBeenCalled();
  });

  it('should arm its own teardown when the extension is still there after the read', async () => {
    // The other side of the guard, so the test above cannot pass merely
    // because `main` does nothing at all.
    const context = await run(false);

    expect(context.onInvalidated).toHaveBeenCalledTimes(1);
  });
});
