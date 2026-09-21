import { describe, it, expect, vi } from 'vitest';
import { createChimePlayer, type AudioCapableView } from './chime';

/**
 * happy-dom gives no audio at all, so the browser side is stood in for: what
 * is checked here is what the player asks of it, which is what decides
 * whether a sound comes out of a real browser.
 */

/** The envelope a note is played through, and where that envelope goes. */
interface StubGain {
  gain: {
    setValueAtTime: () => void;
    exponentialRampToValueAtTime: () => void;
  };
  connect: (target: object) => void;
  /** True once this envelope has been wired to the speakers. */
  reachesDestination: boolean;
}

interface ScheduledNote {
  frequency: number;
  startsAt: number;
  endsAt: number;
  /** What the note was played into, null while it was played into nothing. */
  output: StubGain | null;
}

/** A note nobody can hear is one whose envelope goes nowhere. */
function isAudible(note: ScheduledNote): boolean {
  return note.output?.reachesDestination === true;
}

const NOW = 12.5;

interface FakeContextOptions {
  /** The state a fresh context is in, as the browser hands it over. */
  state: AudioContextState;
  /** The state `resume()` leaves it in: a browser may well refuse. */
  resumesTo: AudioContextState;
}

interface FakeContext {
  state: AudioContextState;
  notes: ScheduledNote[];
  resumeCalls: number;
  closeCalls: number;
}

interface FakeAudio {
  view: AudioCapableView;
  /** Every context opened so far, in order. */
  contexts: FakeContext[];
}

/**
 * A window whose audio records what it is asked to play instead of playing
 * it. The envelopes are stood in for as well: what matters is that each note
 * reaches the destination through one, since a note wired to nothing at all
 * is scheduled and never heard.
 */
function fakeAudio(options: Partial<FakeContextOptions> = {}): FakeAudio {
  const { state = 'running', resumesTo = 'running' } = options;
  const contexts: FakeContext[] = [];

  class StubAudioContext {
    public state: AudioContextState = state;
    public currentTime = NOW;
    public readonly destination = { name: 'destination' };
    public readonly notes: ScheduledNote[] = [];
    public resumeCalls = 0;
    public closeCalls = 0;

    public constructor() {
      contexts.push(this);
    }

    public resume(): Promise<void> {
      this.resumeCalls += 1;
      this.state = resumesTo;
      return Promise.resolve();
    }

    public close(): Promise<void> {
      this.closeCalls += 1;
      this.state = 'closed';
      return Promise.resolve();
    }

    public createOscillator(): object {
      const note: ScheduledNote = { frequency: 0, startsAt: 0, endsAt: 0, output: null };
      this.notes.push(note);

      return {
        type: 'sine',
        frequency: {
          setValueAtTime: (value: number): void => {
            note.frequency = value;
          },
        },
        connect: (target: StubGain): void => {
          note.output = target;
        },
        start: (time: number): void => {
          note.startsAt = time;
        },
        stop: (time: number): void => {
          note.endsAt = time;
        },
      };
    }

    public createGain(): StubGain {
      const { destination } = this;
      const node: StubGain = {
        gain: {
          setValueAtTime: (): void => undefined,
          exponentialRampToValueAtTime: (): void => undefined,
        },
        connect: (target: object): void => {
          node.reachesDestination = target === destination;
        },
        reachesDestination: false,
      };
      return node;
    }
  }

  return { view: { AudioContext: StubAudioContext } as unknown as AudioCapableView, contexts };
}

describe('createChimePlayer', () => {
  it('should play two notes, one over the tail of the other, when asked for a chime', async () => {
    const audio = fakeAudio();

    createChimePlayer(audio.view).play();

    await vi.waitFor(() => {
      expect(audio.contexts[0]?.notes).toHaveLength(2);
    });
    const [first, second] = audio.contexts[0]?.notes ?? [];
    expect(first?.frequency).toBeGreaterThan(0);
    expect(second?.frequency).toBeGreaterThan(first?.frequency ?? 0);
    // One chime, and not two beeps: the second note starts before the first
    // one has died out, and the whole thing is over well inside a second.
    expect(second?.startsAt).toBeGreaterThan(first?.startsAt ?? 0);
    expect(second?.startsAt).toBeLessThan(first?.endsAt ?? 0);
    expect(second?.endsAt).toBeLessThan(NOW + 1);
  });

  it('should wire every note it plays to the speakers', () => {
    // A note wired to nothing is scheduled and never heard.
    const audio = fakeAudio();

    createChimePlayer(audio.view).play();

    expect(audio.contexts[0]?.notes.every(isAudible)).toBe(true);
  });

  it('should keep the one audio context it opened when asked for a second chime', () => {
    // A browser stops handing them out after a few dozen: one per sound and
    // the extension goes quiet for good.
    const audio = fakeAudio();
    const player = createChimePlayer(audio.view);

    player.play();
    player.play();

    expect(audio.contexts).toHaveLength(1);
    expect(audio.contexts[0]?.notes).toHaveLength(4);
  });

  it('should wake a context the browser handed over asleep', async () => {
    // Which is what a browser does until the page has been interacted with.
    const audio = fakeAudio({ state: 'suspended' });

    createChimePlayer(audio.view).play();

    await vi.waitFor(() => {
      expect(audio.contexts[0]?.notes).toHaveLength(2);
    });
    expect(audio.contexts[0]?.resumeCalls).toBe(1);
  });

  it('should play nothing when the browser refuses to wake the context', async () => {
    // No sound, no error, and nothing left running: the next chime asks again.
    const audio = fakeAudio({ state: 'suspended', resumesTo: 'suspended' });

    createChimePlayer(audio.view).play();

    await vi.waitFor(() => {
      expect(audio.contexts[0]?.resumeCalls).toBe(1);
    });
    expect(audio.contexts[0]?.notes).toHaveLength(0);
  });

  it('should give the audio of the page back when it is closed', () => {
    const audio = fakeAudio();
    const player = createChimePlayer(audio.view);
    player.play();

    player.close();

    expect(audio.contexts[0]?.closeCalls).toBe(1);
  });

  it('should close nothing when it was never asked for a chime', () => {
    // Nothing was opened, so there is nothing to give back.
    const audio = fakeAudio();

    createChimePlayer(audio.view).close();

    expect(audio.contexts).toHaveLength(0);
  });

  it('should open a fresh context rather than use the one it gave back', () => {
    // Nothing asks for a chime after the teardown, but reaching into a closed
    // context would throw into the page rather than stay quiet.
    const audio = fakeAudio();
    const player = createChimePlayer(audio.view);
    player.play();
    player.close();

    player.play();

    expect(audio.contexts).toHaveLength(2);
    expect(audio.contexts[1]?.closeCalls).toBe(0);
  });

  it('should do nothing at all when the page has no audio to play with', () => {
    // happy-dom is such a page, and so is a browser that has none.
    const player = createChimePlayer({});

    expect(() => {
      player.play();
    }).not.toThrow();
  });

  it('should do nothing at all when there is no page at all', () => {
    const player = createChimePlayer(null);

    expect(() => {
      player.play();
    }).not.toThrow();
  });

  it('should stay quiet rather than throw when opening a context fails', () => {
    const refusing = {
      AudioContext: function refuse(): never {
        throw new Error('no audio here');
      },
    } as unknown as AudioCapableView;
    const player = createChimePlayer(refusing);

    expect(() => {
      player.play();
    }).not.toThrow();
  });
});
