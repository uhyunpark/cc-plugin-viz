import { writeFile, rename, copyFile, mkdir, readdir, unlink, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';

export async function writeJSON(filePath, data, backupDir) {
  // Validate serialization before touching anything
  const json = JSON.stringify(data, null, 2) + '\n';

  // Backup existing file if it exists and backupDir is provided
  if (backupDir) {
    try {
      await stat(filePath);
      await mkdir(backupDir, { recursive: true });
      const name = basename(filePath, '.json');
      const backupName = `${name}.${Date.now()}.json`;
      await copyFile(filePath, join(backupDir, backupName));
      await pruneBackups(backupDir, name, 5);
    } catch {
      // File doesn't exist yet, no backup needed
    }
  }

  // Atomic write: tmp file -> rename
  const tmpPath = filePath + '.tmp';
  await writeFile(tmpPath, json, 'utf-8');

  // Validate written content is parseable
  JSON.parse(json);

  await rename(tmpPath, filePath);
}

async function pruneBackups(backupDir, prefix, keep) {
  const files = await readdir(backupDir);
  const matching = files
    .filter(f => f.startsWith(prefix + '.') && f.endsWith('.json'))
    .sort()
    .reverse();

  for (const file of matching.slice(keep)) {
    await unlink(join(backupDir, file));
  }
}
