import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readJSON } from '../../server/lib/reader.js';
import { join } from 'node:path';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

describe('readJSON', () => {
  it('reads valid JSON file', async () => {
    const data = await readJSON(join(fixturesDir, 'valid.json'));
    assert.deepEqual(data, { name: 'test', version: '1.0.0' });
  });

  it('returns null for missing file', async () => {
    const data = await readJSON(join(fixturesDir, 'nonexistent.json'));
    assert.equal(data, null);
  });

  it('returns null for malformed JSON', async () => {
    const data = await readJSON(join(fixturesDir, 'malformed.json'));
    assert.equal(data, null);
  });
});
