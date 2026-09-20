import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '#imports';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Clock } from '../../categorization/domain/ports';
import type { CatalogueTotals, CatalogueTotalsRepository } from '../domain/catalogue-totals';
import { createCatalogueTotalsRepository } from './catalogue-totals-repository';

const TOTALS_KEY = 'local:wme:catalogue-totals:v1';

const FIRST_TIME = new Date('2026-01-01T10:00:00.000Z').getTime();
const SECOND_TIME = new Date('2026-01-02T10:00:00.000Z').getTime();

const TOTALS: CatalogueTotals = {
  l: 1761,
  ur: 12_368,
  sr: 66_788,
  r: 179_657,
  pc: 516_762,
  c: 1_996_125,
};

const LARGER_TOTALS: CatalogueTotals = { ...TOTALS, l: 1800 };

/** A clock the test moves by hand, as the service worker would see time pass. */
function makeClock(): { clock: Clock; setTime: (value: number) => void } {
  let now = FIRST_TIME;
  return {
    clock: { now: (): number => now },
    setTime: (value: number): void => {
      now = value;
    },
  };
}

function makeRepository(clock: Clock): CatalogueTotalsRepository {
  return createCatalogueTotalsRepository(clock);
}

describe('createCatalogueTotalsRepository', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should return nothing when the catalogue page was never displayed', async () => {
    const { clock } = makeClock();

    expect(await makeRepository(clock).read()).toBeNull();
  });

  it('should keep the totals and the moment they were read when they are saved', async () => {
    const { clock } = makeClock();
    const repository = makeRepository(clock);

    await repository.save(TOTALS);

    expect(await repository.read()).toEqual({ totals: TOTALS, observedAt: FIRST_TIME });
  });

  it('should replace the previous reading when the catalogue has grown', async () => {
    const { clock, setTime } = makeClock();
    const repository = makeRepository(clock);
    await repository.save(TOTALS);

    setTime(SECOND_TIME);
    await repository.save(LARGER_TOTALS);

    expect(await repository.read()).toEqual({ totals: LARGER_TOTALS, observedAt: SECOND_TIME });
  });

  it('should use a single key, whatever the number of readings', async () => {
    const { clock } = makeClock();
    const repository = makeRepository(clock);

    await repository.save(TOTALS);
    await repository.save(LARGER_TOTALS);

    expect(Object.keys(await storage.snapshot('local'))).toEqual(['wme:catalogue-totals:v1']);
  });

  it('should return nothing when the stored value is not a record', async () => {
    const { clock } = makeClock();
    await storage.setItem(TOTALS_KEY, 'oops');

    expect(await makeRepository(clock).read()).toBeNull();
  });

  it('should return nothing when a stored total is missing or unusable', async () => {
    const { clock } = makeClock();
    const withoutCommon = { l: 1761, ur: 12_368, sr: 66_788, r: 179_657, pc: 516_762 };
    await storage.setItem(TOTALS_KEY, { totals: withoutCommon, observedAt: FIRST_TIME });

    expect(await makeRepository(clock).read()).toBeNull();

    await storage.setItem(TOTALS_KEY, { totals: { ...TOTALS, l: -1 }, observedAt: FIRST_TIME });
    expect(await makeRepository(clock).read()).toBeNull();
  });

  it('should return nothing when the stored reading has no date', async () => {
    const { clock } = makeClock();
    await storage.setItem(TOTALS_KEY, { totals: TOTALS });

    expect(await makeRepository(clock).read()).toBeNull();
  });

  it('should return nothing when the stored date is not a moment in time', async () => {
    const { clock } = makeClock();
    const repository = makeRepository(clock);

    // The popup turns that number into a date: none of these would read as one.
    for (const observedAt of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      await storage.setItem(TOTALS_KEY, { totals: TOTALS, observedAt });
      expect(await repository.read()).toBeNull();
    }
  });

  it('should store the six rarities alone when the reading carries other keys', async () => {
    const { clock } = makeClock();
    const withExtra = { ...TOTALS, mythic: 5 };

    await makeRepository(clock).save(withExtra);

    // The guard reads the six rarities and ignores the rest, so the record is
    // rebuilt before it is stored.
    expect(await storage.getItem(TOTALS_KEY)).toEqual({
      totals: TOTALS,
      observedAt: FIRST_TIME,
    });
  });

  it('should overwrite a corrupted value on the next reading', async () => {
    const { clock } = makeClock();
    const repository = makeRepository(clock);
    await storage.setItem(TOTALS_KEY, 'oops');

    await repository.save(TOTALS);

    expect(await repository.read()).toEqual({ totals: TOTALS, observedAt: FIRST_TIME });
  });
});
