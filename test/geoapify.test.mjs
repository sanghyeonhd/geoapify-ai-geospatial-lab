import test from 'node:test';
import assert from 'node:assert/strict';
import { GeoapifyClient, GeoapifyError, parsePoint, safeCategory, bestGeocodeResult, summarizePlaces, summarizeRoute } from '../src/geoapify.mjs';
import { discoverPlaces } from '../src/workflow.mjs';
import { batchGeocode } from '../src/batch-geocode.mjs';
import { parseArgs, execute } from '../src/cli.mjs';
import { checkSpecs, verifySpec } from '../scripts/check-openapi.mjs';

function mockClient(handler, opts = {}) {
  return new GeoapifyClient({ apiKey: 'test-only-value', maxCalls: 6, fetchImpl: async (url, req) => {
    const body = await handler(new URL(url), req);
    if (body?.mockStatus) return { ok: false, status: body.mockStatus };
    return { ok: true, status: 200, json: async () => body };
  }, ...opts });
}

test('parses latitude,longitude and rejects longitude-first out-of-range input', () => {
  assert.deepEqual(parsePoint('52.52,13.405'), { lat: 52.52, lon: 13.405 });
  assert.throws(() => parsePoint('180,52'), /Coordinates/);
  assert.throws(() => parsePoint('Berlin'), /latitude,longitude/);
});

test('category validation rejects injected request parameters', () => {
  assert.equal(safeCategory('catering.cafe'), 'catering.cafe');
  assert.throws(() => safeCategory('catering.cafe&apiKey=oops'), /Category/);
});

test('no key, no API request', async () => {
  let called = false;
  const client = new GeoapifyClient({ fetchImpl: async () => { called = true; } });
  await assert.rejects(client.geocode('Berlin'), /Missing GEOAPIFY_API_KEY/);
  assert.equal(called, false);
});

test('header-based auth, path, parameters and sanitized logging', async () => {
  const client = mockClient((url, req) => {
    assert.equal(url.pathname, '/v1/geocode/search');
    assert.equal(url.searchParams.get('text'), 'Berlin, Germany');
    assert.equal(url.searchParams.get('format'), 'json');
    assert.equal(req.headers['x-api-key'], 'test-only-value');
    assert.equal(url.searchParams.has('apiKey'), false);
    return { results: [{ lat: 52.52, lon: 13.405, formatted: 'Berlin, Germany' }] };
  });
  assert.equal(bestGeocodeResult(await client.geocode('Berlin, Germany')).lat, 52.52);
  assert.deepEqual(client.trace, [{ method: 'GET', path: '/v1/geocode/search', call: 1 }]);
  assert.equal(JSON.stringify(client.trace).includes('Berlin'), false);
});

test('does not guess missing geocoding results', () => {
  assert.throws(() => bestGeocodeResult({ results: [] }), /stop rather than guess/);
});

test('places circle uses longitude,latitude, opposite of routing waypoint format', async () => {
  const client = mockClient(url => {
    assert.equal(url.pathname, '/v2/places');
    assert.equal(url.searchParams.get('filter'), 'circle:13.405,52.52,1000');
    assert.equal(url.searchParams.get('limit'), '5');
    return { features: [{ properties: { place_id: 'test', name: 'Synthetic Café', categories: ['catering.cafe'], lat: 52.52, lon: 13.405 } }] };
  });
  assert.equal(summarizePlaces(await client.places({ lat: 52.52, lon: 13.405 }))[0].name, 'Synthetic Café');
});

test('routing uses latitude,longitude and reports time and distance', async () => {
  const client = mockClient(url => {
    assert.equal(url.searchParams.get('waypoints'), '52.52,13.405|52.5163,13.3777');
    assert.equal(url.searchParams.get('mode'), 'walk');
    return { results: [{ distance: 2100, time: 1750 }] };
  });
  assert.deepEqual(summarizeRoute(await client.route({ from: { lat: 52.52, lon: 13.405 }, to: { lat: 52.5163, lon: 13.3777 } })), {
    distanceMeters: 2100, durationSeconds: 1750
  });
});

test('request budget stops before any seventh request', async () => {
  const client = mockClient(() => ({ results: [] }), { maxCalls: 2 });
  await client.geocode('A'); await client.geocode('B');
  await assert.rejects(client.geocode('C'), /budget reached/);
  assert.equal(client.calls, 2);
});

test('HTTP errors do not expose response bodies or key', async () => {
  const client = mockClient(() => ({ mockStatus: 429 }));
  await assert.rejects(client.geocode('X'), error => error.status === 429 && !error.message.includes('test-only-value'));
});

test('two-call discovery uses geocoding result, then POI search', async () => {
  const calls = [];
  const client = mockClient(url => {
    calls.push(url.pathname);
    if (url.pathname === '/v1/geocode/search') return { results: [{ lat: 52.52, lon: 13.405, formatted: 'Berlin' }] };
    return { features: [{ properties: { name: 'Synthetic Café', lat: 52.52, lon: 13.405 } }] };
  });
  const result = await discoverPlaces(client, { address: 'Berlin' });
  assert.deepEqual(calls, ['/v1/geocode/search', '/v2/places']);
  assert.equal(result.observedApiCalls, 2);
  assert.equal(result.places.length, 1);
});

test('MCP tools/list requests valid JSON-RPC with secret header', async () => {
  const client = mockClient((url, req) => {
    assert.equal(url.pathname, '/v1/mcp');
    assert.equal(req.method, 'POST');
    assert.deepEqual(JSON.parse(req.body), { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    return { jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'geocode_address' }] } };
  });
  assert.equal((await client.mcpTools()).tools[0].name, 'geocode_address');
});

test('MCP tool call validates tool name and sends arguments', async () => {
  const client = mockClient((_url, req) => {
    const rpc = JSON.parse(req.body);
    assert.equal(rpc.method, 'tools/call');
    assert.equal(rpc.params.name, 'search_places');
    assert.deepEqual(rpc.params.arguments, { category: 'catering.cafe', lat: 52.52, lon: 13.405 });
    return { jsonrpc: '2.0', id: 1, result: { content: [] } };
  });
  await assert.rejects(client.mcpCall('search_places&evil'), /Invalid MCP tool name/);
  await client.mcpCall('search_places', { category: 'catering.cafe', lat: 52.52, lon: 13.405 });
});

test('MCP protocol failure and tool error propagate safely', async () => {
  const protocolError = mockClient(() => ({ error: { code: -32600, message: 'bad request' } }));
  await assert.rejects(protocolError.mcpTools(), /MCP -32600/);
  const toolError = mockClient(() => ({ result: { isError: true } }));
  await assert.rejects(toolError.mcpCall('geocode_address', { query: 'x' }), /isError/);
});

test('batch geocoding enforces budget and preserves input order', async () => {
  const client = mockClient(url => ({ results: [{ lat: 1, lon: 2, formatted: url.searchParams.get('text') }] }), { maxCalls: 2 });
  const results = await batchGeocode(['One', 'Two'], { client, wait: async () => {} });
  assert.deepEqual(results.map(x => x.formatted), ['One', 'Two']);
  await assert.rejects(batchGeocode(['Three'], { client, wait: async () => {} }), /budget/);
});

test('CLI parseArgs never turns positional input into a key', () => {
  assert.deepEqual(parseArgs(['geocode', 'Berlin', '--live']).opts, { live: true });
  assert.throws(() => parseArgs(['geocode', '--apiKey', 'secret']), /Unknown option/);
});

test('offline spec excerpts match OpenAPI operations and parameters', async () => {
  const results = await checkSpecs();
  assert.equal(results.length, 4);
  assert.throws(() => verifySpec({ paths: {} }, { url: '/missing', method: 'get', params: [] }, 'wrong'), /missing/);
});


test('MCP input validation blocks credit-wasting invalid points or categories', async () => {
  await assert.rejects(execute(['mcp-places', '--lat', 'oops', '--lon', '13.4', '--live']), /Coordinates/);
  await assert.rejects(execute(['mcp-places', '--lat', '52.52', '--lon', '13.4', '--category', 'invalid?value', '--live']), /Category/);
  await assert.rejects(execute(['mcp-route', '--from', '52.52,13.405', '--to', '52.52,13.4', '--mode', 'rocket', '--live']), /Mode must/);
});
