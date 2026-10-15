import { bestGeocodeResult, safeCategory, summarizePlaces } from './geoapify.mjs';

/** Credit-minimal reference workflow: 1 geocode + 1 Places request, no LLM required. */
export async function discoverPlaces(client, { address, category = 'catering.cafe', radius = 1000, limit = 5 } = {}) {
  const selected = safeCategory(category);
  const geocoded = bestGeocodeResult(await client.geocode(address));
  const places = summarizePlaces(await client.places({ ...geocoded, category: selected, radius, limit }));
  return {
    query: address,
    resolvedAddress: geocoded.formatted,
    center: { lat: geocoded.lat, lon: geocoded.lon },
    category: selected,
    places,
    observedApiCalls: client.calls,
    note: 'Only Geoapify data is presented; missing properties are not invented.'
  };
}
