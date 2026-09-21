/**
 * The sound the extension plays when the bell of the site goes up, built from
 * two notes rather than loaded from a file: nothing is downloaded, nothing is
 * bundled, and no address is ever asked for. The page is not touched either,
 * since a sound is not a node.
 */

interface Note {
  frequency: number;
  /** Seconds after the chime starts. */
  startAt: number;
  durationSeconds: number;
}

/**
 * Two notes a fifth apart, the second one over the tail of the first: short,
 * soft and rising, which reads as "something arrived" rather than as an
 * alarm. A5 then E6.
 */
const NOTES: readonly Note[] = [
  { frequency: 880, startAt: 0, durationSeconds: 0.14 },
  { frequency: 1318.5, startAt: 0.08, durationSeconds: 0.22 },
];

const WAVE: OscillatorType = 'sine';

/** Well under the sounds of a page, so it never talks over anything. */
const PEAK_GAIN = 0.12;

/** Short enough not to click, long enough not to pop. */
const ATTACK_SECONDS = 0.012;

const SILENT_GAIN = 0.0001;

export interface ChimePlayer {
  /** Plays the chime, and does nothing at all when the browser refuses to. */
  play: () => void;
}

/**
 * The only thing the player needs of a page: its way of making a sound. A
 * page that has none is not an error, it is simply a page that stays quiet.
 */
export interface AudioCapableView {
  AudioContext?: typeof AudioContext;
}

/** Does nothing, for a page with no audio at all behind it. */
const SILENT_PLAYER: ChimePlayer = { play: (): void => undefined };

function playNote(context: AudioContext, note: Note): void {
  const startsAt = context.currentTime + note.startAt;
  const endsAt = startsAt + note.durationSeconds;

  const oscillator = context.createOscillator();
  oscillator.type = WAVE;
  oscillator.frequency.setValueAtTime(note.frequency, startsAt);

  // The envelope of the note: it has to rise and fall, because a note that
  // starts and stops square clicks at both ends.
  const gain = context.createGain();
  gain.gain.setValueAtTime(SILENT_GAIN, startsAt);
  gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, startsAt + ATTACK_SECONDS);
  gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, endsAt);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startsAt);
  oscillator.stop(endsAt);
}

/**
 * A browser plays nothing until the page it plays for has been interacted
 * with, and answers a suspended context to say so. Nothing is lost when that
 * happens: the chime is simply not heard, and the next one is, as soon as the
 * user has clicked anywhere on the site. Nothing of ours listens for that
 * click: the context is simply asked again on the next chime.
 */
async function playWhenAllowed(context: AudioContext): Promise<void> {
  try {
    if (context.state === 'suspended') {
      await context.resume();
    }
    if (context.state !== 'running') {
      return;
    }
    for (const note of NOTES) {
      playNote(context, note);
    }
  } catch {
    // A browser that refuses the sound is not an error of the extension.
    return;
  }
}

/** Opens one, or answers nothing at all on a page that refuses to. */
function openContext(AudioContextClass: typeof AudioContext): AudioContext | null {
  try {
    return new AudioContextClass();
  } catch {
    return null;
  }
}

/**
 * The player of one page. The audio context is opened on the first chime and
 * kept: a page must not open one per sound, and a browser stops handing them
 * out after a few dozen.
 */
export function createChimePlayer(view: AudioCapableView | null): ChimePlayer {
  const AudioContextClass = view?.AudioContext;
  if (AudioContextClass === undefined) {
    return SILENT_PLAYER;
  }
  let context: AudioContext | null = null;

  return {
    play: (): void => {
      context ??= openContext(AudioContextClass);
      if (context === null) {
        return;
      }
      void playWhenAllowed(context);
    },
  };
}
