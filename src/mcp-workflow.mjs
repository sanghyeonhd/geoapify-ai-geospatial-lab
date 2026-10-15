/** A deterministic two-tool MCP comparison workflow; NOT an LLM agent. */
import { GeoapifyError, safeCategory, validatePoint } from './geoapify.mjs';

function structured(result, toolName) {
  const data = result?.structuredContent;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new GeoapifyError(toolName + ' did not return structured content');
  }
  return data;
}

export async function mcpDiscoverPlaces(client, {
  address, category = 'catering.cafe', radius = 1000, limit = 5, countryCode
} = {}) {
  if (!client || typeof client.mcpCall !== 'function') throw new GeoapifyError('MCP client is required');
  if (typeof address !== 'string' || !address.trim() || address.length > 1024) {
    throw new GeoapifyError('Provide an address between 1 and 1024 characters');
  }
  const validatedCategory = safeCategory(category);
  if (!Number.isInteger(radius) || radius < 1 || radius > 50000) throw new GeoapifyError('radius must be 1..50000 meters');
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new GeoapifyError('limit must be 1..20');
  const expectedCountry = countryCode === undefined ? null : String(countryCode).trim().toLowerCase();
  if (expectedCountry !== null && !/^[a-z]{2}$/.test(expectedCountry)) {
    throw new GeoapifyError('countryCode must be a two-letter ISO country code');
  }

  const geocoded = structured(await client.mcpCall('geocode_address', {
    query: address.trim(), limit: 1
  }), 'geocode_address');
  const first = Array.isArray(geocoded.results)
    ? geocoded.results.find(x => Number.isFinite(x?.lat) && Number.isFinite(x?.lon))
    : undefined;
  if (!first) throw new GeoapifyError('No geocoding match; place search was not sent');
  const point = validatePoint(first);
  if (expectedCountry && first.country_code?.toLowerCase() !== expectedCountry) {
    throw new GeoapifyError('Resolved country differs from requested country; place search was not sent');
  }

  const found = structured(await client.mcpCall('search_places', {
    category: validatedCategory, ...point, radius_meters: radius, limit
  }), 'search_places');
  if (!Array.isArray(found.results)) throw new GeoapifyError('search_places results missing or malformed');
  const places = found.results.slice(0, limit).map(place => ({
    name: typeof place.name === 'string' ? place.name : null,
    formatted: typeof place.formatted === 'string' ? place.formatted : null,
    lat: Number.isFinite(place.lat) ? place.lat : null,
    lon: Number.isFinite(place.lon) ? place.lon : null,
    placeId: place.place_id || null
  }));
  return {
    source: 'Geoapify MCP tools; no LLM reasoning in this command',
    resolvedAddress: first.formatted || null,
    countryCode: first.country_code || null,
    center: point,
    category: validatedCategory,
    radiusMeters: radius,
    places
  };
}
