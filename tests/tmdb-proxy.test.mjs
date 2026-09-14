import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { catalogResponse, imageResponse } from '../lib/tmdb-proxy.mjs';

const originalFetch = globalThis.fetch;
const originalKey = process.env.TMDB_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.TMDB_API_KEY;
  else process.env.TMDB_API_KEY = originalKey;
});
const request = (query = '') => new Request(`https://site.example/api/test${query}`);

test('catalog preserves language and filters and adds credentials only upstream', async () => {
  process.env.TMDB_API_KEY = 'server-test-key';
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.themoviedb.org');
    assert.equal(parsed.pathname, '/3/discover/movie');
    assert.equal(parsed.searchParams.get('language'), 'my-MM');
    assert.equal(parsed.searchParams.get('with_genres'), '16');
    assert.equal(parsed.searchParams.get('api_key'), 'server-test-key');
    assert.equal(options.redirect, 'error');
    return Response.json({ results: [{ id: 1 }] });
  };
  const result = await catalogResponse(request('?language=my-MM&with_genres=16&page=500'), ['discover', 'movie']);
  assert.equal(result.status, 200);
  assert.match(result.headers.get('cache-control'), /s-maxage=3600/);
  assert.deepEqual(await result.json(), { results: [{ id: 1 }] });
});

test('unsupported paths, credentials and invalid pagination never reach upstream', async () => {
  globalThis.fetch = () => { throw new Error('Must not fetch'); };
  for (const path of [['https:', 'evil.example'], ['movie', '..', 'account'], ['account', '1']]) {
    assert.equal((await catalogResponse(request(), path)).status, 400);
  }
  for (const query of ['?api_key=override', '?url=https://evil.example', '?page=501', '?page=0', '?page=1&page=2', '?append_to_response=account']) {
    assert.equal((await catalogResponse(request(query), ['movie', '1'])).status, 400);
  }
});

test('upstream errors and timeouts are not cached or exposed', async () => {
  process.env.TMDB_API_KEY = 'secret';
  globalThis.fetch = async () => new Response('private upstream details', { status: 429 });
  let result = await catalogResponse(request(), ['movie', '1']);
  assert.equal(result.status, 429);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await result.text(), /private upstream/);
  globalThis.fetch = async () => { throw new Error('URL contains secret'); };
  result = await catalogResponse(request(), ['movie', '1']);
  assert.equal(result.status, 502);
  assert.doesNotMatch(await result.text(), /secret/);
});

test('image proxy returns image bytes with cache headers', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://image.tmdb.org/t/p/w500/poster.jpg');
    assert.equal(options.redirect, 'error');
    return new Response(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } });
  };
  const result = await imageResponse(request(), ['w500', 'poster.jpg']);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('content-type'), 'image/jpeg');
  assert.match(result.headers.get('cache-control'), /s-maxage=604800/);
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array([255, 216, 255]));
});

test('image proxy refuses arbitrary URLs, traversal, SVG and unexpected queries', async () => {
  globalThis.fetch = () => { throw new Error('Must not fetch'); };
  for (const path of [['original', '..', 'x.jpg'], ['w500', 'https://evil.example/x.jpg'], ['w500', 'x.svg'], ['w9999', 'x.jpg']]) {
    assert.equal((await imageResponse(request(), path)).status, 400);
  }
  assert.equal((await imageResponse(request('?url=evil'), ['w500', 'x.jpg'])).status, 400);
});

test('image failures never become cacheable images', async () => {
  for (const upstream of [new Response('missing', { status: 404 }), new Response('<html>blocked</html>', { headers: { 'Content-Type': 'text/html' } })]) {
    globalThis.fetch = async () => upstream;
    const result = await imageResponse(request(), ['w500', 'x.jpg']);
    assert.ok([404, 502].includes(result.status));
    assert.equal(result.headers.get('cache-control'), 'no-store');
  }
});

test('browser helper uses first-party images and API URLs and preserves Burmese merging', async () => {
  const source = await readFile(new URL('../lib/tmdb.js', import.meta.url), 'utf8');
  const { IMG, getMovieDetails } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  for (const [type, size] of Object.entries({ original: 'original', backdrop: 'w1280', poster: 'w500', profile: 'w185' })) {
    assert.equal(IMG[type]('/poster.jpg'), `/api/tmdb-image/${size}/poster.jpg`);
    assert.equal(IMG[type](null), null);
  }
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(url);
    assert.ok(url.startsWith('/api/tmdb/movie/1?'));
    assert.ok(!url.includes('api_key'));
    const query = new URL(url, 'https://site.example').searchParams;
    assert.equal(query.get('append_to_response'), 'credits,videos,similar');
    return Response.json({ id: 1, title: 'English title', overview: query.get('language') === 'my-MM' ? 'မြန်မာ' : 'English' });
  };
  const result = await getMovieDetails(1);
  assert.equal(urls.length, 2);
  assert.equal(result.title, 'English title');
  assert.equal(result.overview, 'မြန်မာ');
});
