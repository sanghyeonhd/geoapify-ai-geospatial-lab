/** Validate REST endpoint contracts against official OpenAPI 3.1 schema files. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { API_SPECS } from '../src/geoapify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://raw.githubusercontent.com/geoapify/geoapify-openapi-specs/main/api-specs/';
const expected = {
  geocode: { url: '/geocode/search', method: 'get', params: ['text', 'format', 'limit'] },
  places: { url: '/places', method: 'get', params: ['categories', 'filter', 'bias', 'limit'] },
  routing: { url: '/routing', method: 'get', params: ['waypoints', 'mode', 'format'] },
  mcp: { url: '/mcp', method: 'post', params: [] }
};

export function verifySpec(spec, contract, label) {
  const operation = spec?.paths?.[contract.url]?.[contract.method];
  if (!operation) throw new Error(`${label}: ${contract.method.toUpperCase()} ${contract.url} missing`);
  const actual = new Set((operation.parameters || []).map(p => p.name));
  for (const param of contract.params) if (!actual.has(param)) throw new Error(`${label}: missing parameter ${param}`);
  const security = spec.security || operation.security || [];
  if (!security.some(row => 'ApiKeyInHeader' in row)) throw new Error(`${label}: missing x-api-key header security scheme`);
  return { label, endpoint: `${contract.method.toUpperCase()} ${contract.url}`, parametersVerified: contract.params.length };
}

export async function checkSpecs({ online = false, read = readFile, fetchImpl = globalThis.fetch } = {}) {
  const results = [];
  for (const [key, relative] of Object.entries(API_SPECS)) {
    let spec;
    if (online) {
      const response = await fetchImpl(new URL(relative, base));
      if (!response.ok) throw new Error(`${key}: cannot fetch official OpenAPI (HTTP ${response.status})`);
      spec = await response.json();
    } else {
      spec = JSON.parse(await read(path.join(root, 'fixtures', 'openapi', `${key}.json`), 'utf8'));
    }
    results.push(verifySpec(spec, expected[key], key));
  }
  return results;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  checkSpecs({ online: process.argv.includes('--online') }).then(x => console.log(JSON.stringify(x, null, 2)))
    .catch(x => { console.error(x.message); process.exitCode = 1; });
}
