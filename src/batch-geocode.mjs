/**
 * Adapted research exercise, originally inspired by Geoapify's MIT-licensed
 * node/geocoding-with-RPS-limit-respect/geocode.js example (copyright 2025 Geoapify).
 * Unlike that sample, the key comes from the environment, not committed source.
 * Sequential processing plus a configurable per-run budget protects free credits.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { GeoapifyClient, bestGeocodeResult, GeoapifyError } from './geoapify.mjs';

export async function batchGeocode(addresses, { client, wait = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  if (!Array.isArray(addresses)) throw new GeoapifyError('addresses must be an array');
  const results = [];
  for (const [index, address] of addresses.entries()) {
    if (index) await wait(200); // <= 5 geocoding requests/sec on Free plan.
    try {
      const item = bestGeocodeResult(await client.geocode(address));
      results.push({ address, ...item });
    } catch (error) {
      if (/budget reached/i.test(error.message)) throw error; // Do not bypass the safety cap.
      results.push({ address, error: error.message });
    }
  }
  return results;
}

export async function batchFromFile(path, outputPath, client) {
  if (!client.apiKey) throw new GeoapifyError('Missing GEOAPIFY_API_KEY');
  const addresses = (await readFile(path, 'utf8')).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (addresses.length > client.maxCalls) {
    throw new GeoapifyError(`Input contains ${addresses.length} addresses but maxCalls=${client.maxCalls}`);
  }
  const results = await batchGeocode(addresses, { client });
  if (outputPath) await writeFile(outputPath, JSON.stringify(results, null, 2), 'utf8');
  return results;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [file, output] = process.argv.slice(2);
  if (!file) { console.error('Usage: GEOAPIFY_API_KEY=... node src/batch-geocode.mjs input.txt [results.json]'); process.exitCode = 1; }
  else {
    try {
      const client = new GeoapifyClient({ apiKey: process.env.GEOAPIFY_API_KEY, maxCalls: Number(process.env.GEOAPIFY_MAX_CALLS || 6) });
      console.log(JSON.stringify(await batchFromFile(file, output, client), null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
