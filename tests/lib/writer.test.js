import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeJSON } from '../../server/lib/writer.js';
import { readJSON } from '../../server/lib/reader.js';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('writeJSON', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'writer-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('writes valid JSON to file', async () => {
    const filePath = join(tempDir, 'out.json');
    const data = { key: 'value' };
    await writeJSON(filePath, data);
    const result = await readJSON(filePath);
    assert.deepEqual(result, data);
  });

  it('creates backup before overwriting existing file', async () => {
    const filePath = join(tempDir, 'out.json');
    const backupDir = join(tempDir, '.backup');
    await writeJSON(filePath, { v: 1 }, backupDir);
    await writeJSON(filePath, { v: 2 }, backupDir);
    const backups = await readdir(backupDir);
    assert.ok(backups.length >= 1, 'should have at least one backup');
  });

  it('keeps only last 5 backups per file', async () => {
    const filePath = join(tempDir, 'out.json');
    const backupDir = join(tempDir, '.backup');
    for (let i = 0; i < 8; i++) {
      await writeJSON(filePath, { v: i }, backupDir);
    }
    const backups = await readdir(backupDir);
    const relevant = backups.filter(b => b.startsWith('out.'));
    assert.ok(relevant.length <= 5, `expected <= 5 backups, got ${relevant.length}`);
  });

  it('does not leave .tmp files on success', async () => {
    const filePath = join(tempDir, 'out.json');
    await writeJSON(filePath, { ok: true });
    const files = await readdir(tempDir);
    const tmpFiles = files.filter(f => f.endsWith('.tmp'));
    assert.equal(tmpFiles.length, 0);
  });
});
