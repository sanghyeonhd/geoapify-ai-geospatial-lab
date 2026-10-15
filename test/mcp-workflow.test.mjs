import test from 'node:test';
import assert from 'node:assert/strict';
import { mcpDiscoverPlaces } from '../src/mcp-workflow.mjs';

function clientWith(resultCountry = 'de', geocodeResults = true) {
  const calls = [];
  return {
    calls,
    async mcpCall(name, args) {
      calls.push({ name, args });
      if (name === 'geocode_address') return {
        structuredContent: { results: geocodeResults ? [{ lat: 52.52, lon: 13.405, formatted: 'Berlin, Germany', country_code: resultCountry }] : [] }
      };
      if (name === 'search_places') return {
        structuredContent: { results: [{ name: 'Sample café', formatted: 'Sample, Berlin', lat: 52.5203, lon: 13.4054, place_id: 'fixture-only' }] }
      };
      throw new Error('Unexpected tool: ' + name);
    }
  };
}

test('MCP chained workflow uses exactly geocode then places with documented argument names', async () => {
  const client = clientWith();
  const result = await mcpDiscoverPlaces(client, { address: 'Berlin, Germany', countryCode: 'DE', category: 'catering.cafe' });
  assert.equal(client.calls.length, 2);
  assert.deepEqual(client.calls[0], { name: 'geocode_address', args: { query: 'Berlin, Germany', limit: 1 } });
  assert.deepEqual(client.calls[1], { name: 'search_places', args: { category: 'catering.cafe', lat: 52.52, lon: 13.405, radius_meters: 1000, limit: 5 } });
  assert.equal(result.places[0].name, 'Sample café');
  assert.match(result.source, /no LLM/);
});

test('no match and wrong country both stop before paid Places search', async () => {
  const missing = clientWith('de', false);
  await assert.rejects(mcpDiscoverPlaces(missing, { address: 'Nowhere' }), /No geocoding match/);
  assert.equal(missing.calls.length, 1);
  const wrong = clientWith('fr');
  await assert.rejects(mcpDiscoverPlaces(wrong, { address: 'Paris', countryCode: 'de' }), /country differs/);
  assert.equal(wrong.calls.length, 1);
});

test('rejects invalid arguments before any MCP call', async () => {
  const client = clientWith();
  await assert.rejects(mcpDiscoverPlaces(client, { address: 'Berlin', countryCode: 'Germany' }), /two-letter/);
  await assert.rejects(mcpDiscoverPlaces(client, { address: 'Berlin', radius: -1 }), /radius/);
  await assert.rejects(mcpDiscoverPlaces(client, { address: 'Berlin', category: 'catering.cafe&apiKey=x' }), /Category/);
  assert.equal(client.calls.length, 0);
});

test('rejects unexpected structuredContent shape instead of inventing places', async () => {
  const calls = [];
  const client = { async mcpCall(name) {
    calls.push(name);
    if (name === 'geocode_address') return { structuredContent: { results: [{ lat: 52.52, lon: 13.405 }] } };
    return { structuredContent: { count: 1 } };
  } };
  await assert.rejects(mcpDiscoverPlaces(client, { address: 'Berlin' }), /malformed/);
  assert.deepEqual(calls, ['geocode_address', 'search_places']);
});
