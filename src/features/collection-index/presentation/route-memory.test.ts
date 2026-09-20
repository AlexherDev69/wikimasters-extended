import { describe, it, expect } from 'vitest';
import { createRouteMemory } from './route-memory';

const COLLECTION_PATH = '/collection';
const CATALOGUE_PATH = '/global-collection';

describe('createRouteMemory', () => {
  it('should report no change on the first scan of a session', () => {
    expect(createRouteMemory().noteScan(COLLECTION_PATH)).toBe(false);
  });

  it('should report no change while the scans stay on the same path', () => {
    const memory = createRouteMemory();
    memory.noteScan(COLLECTION_PATH);

    expect(memory.noteScan(COLLECTION_PATH)).toBe(false);
    expect(memory.noteScan(COLLECTION_PATH)).toBe(false);
  });

  it('should report a change on the first scan after the path changed', () => {
    const memory = createRouteMemory();
    memory.noteScan(COLLECTION_PATH);

    expect(memory.noteScan(CATALOGUE_PATH)).toBe(true);
    expect(memory.noteScan(CATALOGUE_PATH)).toBe(false);
  });

  it('should report a change again when the user comes back to a known path', () => {
    const memory = createRouteMemory();
    memory.noteScan(CATALOGUE_PATH);
    memory.noteScan(COLLECTION_PATH);

    expect(memory.noteScan(CATALOGUE_PATH)).toBe(true);
  });
});
