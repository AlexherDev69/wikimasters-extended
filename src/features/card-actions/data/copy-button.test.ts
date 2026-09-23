import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  cardOf,
  makeLogger,
  openModal,
  queryButton,
  stubFullscreen,
  userClick,
  type FullscreenStub,
} from '../../../../tests/helpers/card-actions-harness';
import { applyCardActions, type CardActionsDeps } from './card-actions';
import { COPY_BUTTON_SELECTOR } from './card-actions-selectors';
import { snapshotCard } from './card-snapshot';

// The drawing of the card needs a canvas and a layout, which happy-dom has
// neither of: what is tested here is what the button does with the picture.
vi.mock('./card-snapshot', () => ({ snapshotCard: vi.fn() }));

const PICTURE = new Blob(['png'], { type: 'image/png' });

const IDLE_LABEL = "Copier l'image de la carte";
const DONE_LABEL = 'Carte copiée';
const FAILED_LABEL = "La carte n'a pas pu être copiée";
const OUTCOME_ATTRIBUTE = 'data-wme-copy-outcome';

/** The feedback of each press, held rather than run, as the context would. */
type Scheduled = { callback: () => void; delayMs: number }[];

interface Mounted {
  button: HTMLButtonElement;
  /** The card of the modal, the one the button copies. */
  card: HTMLElement;
}

function mount(deps: CardActionsDeps): Mounted {
  const modal = openModal();
  applyCardActions(modal, { fullscreen: false, copy: true }, deps);
  return { button: queryButton(COPY_BUTTON_SELECTOR), card: cardOf(modal) };
}

function makeDeps(scheduled: Scheduled): CardActionsDeps {
  return {
    logger: makeLogger(),
    schedule: (callback, delayMs): void => {
      scheduled.push({ callback, delayMs });
    },
  };
}

describe('the copy button', () => {
  let write: Mock<(items: ClipboardItem[]) => Promise<void>>;
  let fullscreen: FullscreenStub;
  let scheduled: Scheduled;

  beforeEach(() => {
    scheduled = [];
    fullscreen = stubFullscreen();
    write = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
    vi.mocked(snapshotCard).mockReset();
    vi.mocked(snapshotCard).mockResolvedValue(PICTURE);
  });

  afterEach(() => {
    fullscreen.restore();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('should say what it does before any press', () => {
    expect(mount(makeDeps(scheduled)).button.getAttribute('aria-label')).toBe(IDLE_LABEL);
  });

  it('should hand the clipboard a PNG picture of the card beside it', async () => {
    const { button, card } = mount(makeDeps(scheduled));

    userClick(button);

    expect(write).toHaveBeenCalledOnce();
    const [items] = write.mock.calls[0] ?? [];
    const [item] = items ?? [];
    expect(item?.types).toEqual(['image/png']);
    // happy-dom hands back a copy of the picture rather than the same object.
    const picture = await item?.getType('image/png');
    expect(picture?.type).toBe('image/png');
    expect(await picture?.text()).toBe('png');
    expect(snapshotCard).toHaveBeenCalledWith(card);
  });

  it('should ignore a click raised by a script', () => {
    const { button } = mount(makeDeps(scheduled));

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(write).not.toHaveBeenCalled();
    expect(snapshotCard).not.toHaveBeenCalled();
  });

  it('should show for a moment that the card was copied, then read as a button again', async () => {
    const { button } = mount(makeDeps(scheduled));

    userClick(button);

    await vi.waitFor(() => {
      expect(button.getAttribute(OUTCOME_ATTRIBUTE)).toBe('done');
    });
    expect(button.getAttribute('aria-label')).toBe(DONE_LABEL);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.delayMs).toBe(2000);

    scheduled[0]?.callback();

    expect(button.hasAttribute(OUTCOME_ATTRIBUTE)).toBe(false);
    expect(button.getAttribute('aria-label')).toBe(IDLE_LABEL);
  });

  it('should say so, and why in the journal, when the clipboard refuses the picture', async () => {
    const deps = makeDeps(scheduled);
    write.mockRejectedValue(new Error('Document is not focused.'));
    const { button } = mount(deps);

    userClick(button);

    await vi.waitFor(() => {
      expect(button.getAttribute(OUTCOME_ATTRIBUTE)).toBe('failed');
    });
    expect(button.getAttribute('aria-label')).toBe(FAILED_LABEL);
    expect(deps.logger.warn).toHaveBeenCalledWith('The card could not be copied', {
      error: 'Document is not focused.',
    });
  });

  it('should leave the outcome of a later press to its own timer', async () => {
    const { button } = mount(makeDeps(scheduled));
    userClick(button);
    await vi.waitFor(() => {
      expect(button.getAttribute(OUTCOME_ATTRIBUTE)).toBe('done');
    });
    write.mockRejectedValue(new Error('Document is not focused.'));
    userClick(button);
    await vi.waitFor(() => {
      expect(button.getAttribute(OUTCOME_ATTRIBUTE)).toBe('failed');
    });

    // The timer of the first press runs out while the second one shows.
    scheduled[0]?.callback();

    expect(button.getAttribute(OUTCOME_ATTRIBUTE)).toBe('failed');
  });
});
