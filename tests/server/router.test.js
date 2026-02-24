import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../../server/index.js';

describe('HTTP server', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await createServer({ port: 0 }); // random port
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    server.close();
  });

  it('serves static files from public/', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('<!DOCTYPE html') || text.includes('<html'), 'should serve HTML');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent`);
    assert.equal(res.status, 404);
  });

  it('returns JSON for API routes', async () => {
    const res = await fetch(`${baseUrl}/api/plugins`);
    assert.equal(res.headers.get('content-type'), 'application/json');
  });
});
