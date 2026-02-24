import { readFile } from 'node:fs/promises';

export async function readJSON(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}
