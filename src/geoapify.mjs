/** Minimal credit-aware REST + HTTP MCP client. No dependencies and no baked-in keys. */
export const REST_ORIGIN = 'https://api.geoapify.com';
export const API_SPECS = Object.freeze({
  geocode: 'forward-geocoding/forward-geocoding-api-openapi-specs.json',
  places: 'places/places-api-openapi-specs.json',
  routing: 'routing/routing-api-openapi-specs.json',
  mcp: 'mcp/mcp-api-openapi-specs.json',
});

export class GeoapifyError extends Error {
  constructor(message, status = undefined) {
    super(message);
    this.name = 'GeoapifyError';
    this.status = status;
  }
}

export function validatePoint(point) {
  const { lat, lon } = point || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new GeoapifyError('Coordinates must be {lat: -90..90, lon: -180..180}');
  }
  return { lat, lon };
}

export function parsePoint(input) {
  const parts = String(input || '').split(',').map(s => s.trim());
  if (parts.length !== 2 || parts.some(s => !s || !/^-?\d+(?:\.\d+)?$/.test(s))) {
    throw new GeoapifyError('Use latitude,longitude (example: 52.52,13.405)');
  }
  return validatePoint({ lat: Number(parts[0]), lon: Number(parts[1]) });
}

export function safeCategory(value) {
  const category = String(value || 'catering.cafe').trim();
  if (!/^[a-z_]+(?:\.[a-z_]+)*$/.test(category)) {
    throw new GeoapifyError('Category must use Geoapify dot notation (e.g. catering.cafe)');
  }
  return category;
}

export class GeoapifyClient {
  constructor({ apiKey, fetchImpl = globalThis.fetch, maxCalls = 6, timeoutMs = 12000, origin = REST_ORIGIN } = {}) {
    if (typeof fetchImpl !== 'function') throw new GeoapifyError('fetch is not available');
    if (!Number.isSafeInteger(Number(maxCalls)) || Number(maxCalls) < 1 || Number(maxCalls) > 100) {
      throw new GeoapifyError('maxCalls must be an integer between 1 and 100');
    }
    this.apiKey = String(apiKey || '');
    this.fetchImpl = fetchImpl;
    this.maxCalls = Number(maxCalls);
    this.timeoutMs = timeoutMs;
    this.origin = origin;
    this.calls = 0;
    this.trace = [];
    this.nextId = 1;
  }

  async request(path, { method = 'GET', params = {}, body } = {}) {
    if (!this.apiKey) throw new GeoapifyError('Missing GEOAPIFY_API_KEY');
    if (this.calls >= this.maxCalls) throw new GeoapifyError(`Request budget reached (${this.maxCalls}). No request sent.`);
    const url = new URL(path, this.origin);
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    this.calls += 1; // Count before request; failed requests still consume the safety budget.
    this.trace.push({ method, path: url.pathname, call: this.calls }); // No secrets, locations or query text.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          'x-api-key': this.apiKey,
          'Accept': 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal
      });
      if (!response.ok) throw new GeoapifyError(`Geoapify HTTP ${response.status}`, response.status);
      if (response.status === 204 || response.status === 202) return {};
      return await response.json();
    } catch (error) {
      if (error instanceof GeoapifyError) throw error;
      if (error?.name === 'AbortError') throw new GeoapifyError('Geoapify request timed out');
      throw new GeoapifyError(`Network request failed: ${error?.message || 'unknown error'}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async geocode(text, { limit = 1 } = {}) {
    if (typeof text !== 'string' || !text.trim()) throw new GeoapifyError('A nonempty address is required');
    const n = positiveInt(limit, 1, 10);
    return this.request('/v1/geocode/search', { params: { text: text.trim(), format: 'json', limit: n } });
  }

  async places({ lat, lon, category = 'catering.cafe', radius = 1000, limit = 5 } = {}) {
    validatePoint({ lat, lon });
    const m = positiveInt(radius, 1, 50000);
    const n = positiveInt(limit, 1, 20); // Limit<=20 minimizes Places credit consumption.
    return this.request('/v2/places', { params: {
      categories: safeCategory(category), filter: `circle:${lon},${lat},${m}`,
      bias: `proximity:${lon},${lat}`, limit: n
    } });
  }

  async route({ from, to, mode = 'walk' } = {}) {
    validatePoint(from); validatePoint(to);
    if (!['walk', 'bicycle', 'drive'].includes(mode)) throw new GeoapifyError('Mode must be walk, bicycle, or drive');
    return this.request('/v1/routing', { params: {
      waypoints: `${from.lat},${from.lon}|${to.lat},${to.lon}`, mode, format: 'json'
    } });
  }

  async mcp(method, params) {
    const json = await this.request('/v1/mcp', { method: 'POST', body: {
      jsonrpc: '2.0', id: this.nextId++, method, ...(params ? { params } : {})
    } });
    if (json.error) throw new GeoapifyError(`MCP ${json.error.code || ''}: ${json.error.message || 'error'}`);
    if (json.result?.isError) throw new GeoapifyError('MCP tool returned isError=true');
    return json.result;
  }

  async mcpTools() { return this.mcp('tools/list'); }
  async mcpCall(name, args = {}) {
    if (!/^[a-z_]+$/.test(name)) throw new GeoapifyError('Invalid MCP tool name');
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new GeoapifyError('Invalid MCP arguments');
    return this.mcp('tools/call', { name, arguments: args });
  }
}

function positiveInt(value, min, max) {
  const v = Number(value);
  if (!Number.isInteger(v) || v < min || v > max) throw new GeoapifyError(`Must be an integer in ${min}..${max}`);
  return v;
}

export function bestGeocodeResult(reply) {
  const list = Array.isArray(reply?.results) ? reply.results : [];
  const result = list.find(x => Number.isFinite(x?.lat) && Number.isFinite(x?.lon));
  if (!result) throw new GeoapifyError('No geocoding match found; stop rather than guess a city');
  return { lat: result.lat, lon: result.lon, formatted: result.formatted || '(no formatted address)' };
}

export function summarizePlaces(reply) {
  return (reply?.features || []).filter(x => x?.properties).map(({ properties: p }) => ({
    id: p.place_id || null,
    name: p.name || '(unnamed place)',
    address: p.formatted || null,
    lat: Number.isFinite(p.lat) ? p.lat : null,
    lon: Number.isFinite(p.lon) ? p.lon : null,
    categories: (p.categories || []).slice(0, 3)
  }));
}

export function summarizeRoute(reply) {
  const route = reply?.results?.[0] || reply?.features?.[0]?.properties;
  if (!route) throw new GeoapifyError('Routing API returned no route');
  return { distanceMeters: route.distance ?? null, durationSeconds: route.time ?? null };
}
