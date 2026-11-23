import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { Router } from '../src/http/router.js';
import { createApp, sendJson } from '../src/http/app.js';

describe('Router unit tests', () => {
  it('matches static and parameterized routes and extracts :params', () => {
    const router = new Router();
    const dummyHandler = () => {};

    router.get('/api/events/:eventId/tiers/:tierId', dummyHandler);

    const matched = router.match('GET', '/api/events/evt-42/tiers/tier-9');
    assert.ok(matched);
    assert.equal(matched.handler, dummyHandler);
    assert.deepEqual(matched.params, {
      eventId: 'evt-42',
      tierId: 'tier-9',
    });

    assert.equal(router.match('POST', '/api/events/evt-42/tiers/tier-9'), null);
    assert.equal(router.match('GET', '/api/other'), null);
  });
});

describe('HTTP Server integration tests', () => {
  const { server } = createApp({
    configureRoutes(router) {
      router.post('/api/echo', (req, res) => {
        sendJson(res, 200, { received: req.body });
      });
      router.get('/api/boom', () => {
        throw new Error('Secret database password leaked in stack trace!');
      });
    },
  });

  let baseUrl = '';

  const ready = new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  after(() => {
    server.close();
  });

  it('responds to GET /health with {"status":"ok"}', async () => {
    await ready;
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { status: 'ok' });
  });

  it('returns JSON 404 with uniform error shape for unknown /api paths', async () => {
    await ready;
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(typeof body.error.message, 'string');
  });

  it('returns JSON 400 when request body contains invalid JSON', async () => {
    await ready;
    const res = await fetch(`${baseUrl}/api/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json ',
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'BAD_JSON');
  });

  it('serves static files from public/ and blocks directory traversal', async () => {
    await ready;
    const okRes = await fetch(`${baseUrl}/`);
    assert.equal(okRes.status, 200);
    const html = await okRes.text();
    assert.match(html, /Event Ticketing &amp; Booking Platform/);

    // Attempt to escape public/ to read package.json
    const escapeRes = await fetch(`${baseUrl}/%2e%2e/package.json`);
    assert.ok(escapeRes.status === 403 || escapeRes.status === 404);
  });

  it('never leaks stack traces on unexpected internal errors', async () => {
    await ready;
    const res = await fetch(`${baseUrl}/api/boom`);
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.doesNotMatch(text, /Secret database password/);
    assert.doesNotMatch(text, /at /);
    const body = JSON.parse(text);
    assert.deepEqual(body, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  });
});