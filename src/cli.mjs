#!/usr/bin/env node
import { GeoapifyClient, GeoapifyError, parsePoint, validatePoint, safeCategory, summarizePlaces, summarizeRoute, bestGeocodeResult } from './geoapify.mjs';
import { discoverPlaces } from './workflow.mjs';

function help() {
  return `Geoapify AI Geospatial Lab — independent OpenAPI + MCP experiment

Offline (0 credits, no key):
  npm run examples
  npm test

Live (explicit --live + GEOAPIFY_API_KEY, maximum 6 requests per invocation):
  node src/cli.mjs geocode "Berlin, Germany" --live
  node src/cli.mjs nearby --lat 52.52 --lon 13.405 --category catering.cafe --live
  node src/cli.mjs discover "Berlin, Germany" --category catering.cafe --live
  node src/cli.mjs route --from 52.52,13.405 --to 52.5163,13.3777 --mode walk --live
  node src/cli.mjs mcp-tools --live
  node src/cli.mjs mcp-geocode "Berlin, Germany" --live
  node src/cli.mjs mcp-places --lat 52.52 --lon 13.405 --category catering.cafe --live
  node src/cli.mjs mcp-route --from 52.52,13.405 --to 52.5163,13.3777 --live

All requests use a private x-api-key header. No real key is stored in this repository.
`;
}

export function parseArgs(argv) {
  const [command = 'help', ...raw] = argv;
  const opts = {};
  const positional = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (item === '--live') { opts.live = true; continue; }
    if (item.startsWith('--')) {
      const key = item.slice(2);
      if (!['lat', 'lon', 'category', 'radius', 'limit', 'from', 'to', 'mode'].includes(key)) throw new GeoapifyError(`Unknown option ${item}`);
      if (i + 1 >= raw.length || raw[i + 1].startsWith('--')) throw new GeoapifyError(`Missing value for ${item}`);
      opts[key] = raw[++i];
    } else positional.push(item);
  }
  return { command, opts, positional };
}

const examples = {
  source: 'synthetic offline fixture — not live businesses or routes',
  request: { address: 'Berlin, Germany', category: 'catering.cafe', radiusMeters: 1000 },
  geocode: { lat: 52.52, lon: 13.405, formatted: 'Berlin, Germany' },
  places: [{ name: 'Sample Café (synthetic)', lat: 52.5205, lon: 13.4058, categories: ['catering.cafe'] }],
  mode: 'offline', apiCalls: 0
};

export async function execute(args) {
  const { command, opts, positional } = parseArgs(args);
  if (command === 'help' || command === '--help') return { help: help() };
  if (command === 'examples') return examples;
  if (!opts.live) throw new GeoapifyError('Live API calls require --live; try `npm run examples` first.');
  const client = new GeoapifyClient({
    apiKey: process.env.GEOAPIFY_API_KEY,
    maxCalls: Number(process.env.GEOAPIFY_MAX_CALLS || 6)
  });
  let result;
  switch (command) {
    case 'geocode':
      result = bestGeocodeResult(await client.geocode(positional.join(' '))); break;
    case 'nearby':
      result = summarizePlaces(await client.places({
        lat: Number(opts.lat), lon: Number(opts.lon), category: opts.category,
        radius: opts.radius === undefined ? 1000 : Number(opts.radius),
        limit: opts.limit === undefined ? 5 : Number(opts.limit)
      })); break;
    case 'discover':
      result = await discoverPlaces(client, {
        address: positional.join(' '), category: opts.category,
        radius: opts.radius === undefined ? 1000 : Number(opts.radius),
        limit: opts.limit === undefined ? 5 : Number(opts.limit)
      }); break;
    case 'route':
      result = summarizeRoute(await client.route({ from: parsePoint(opts.from), to: parsePoint(opts.to), mode: opts.mode || 'walk' })); break;
    case 'mcp-tools':
      result = (await client.mcpTools()).tools?.map(({ name, description }) => ({ name, description })) || []; break;
    case 'mcp-geocode':
      if (!positional.length) throw new GeoapifyError('MCP geocode query is required');
      result = await client.mcpCall('geocode_address', { query: positional.join(' '), limit: 1 }); break;
    case 'mcp-places': {
      const point = validatePoint({ lat: Number(opts.lat), lon: Number(opts.lon) });
      const radius = opts.radius === undefined ? 1000 : Number(opts.radius);
      const limit = opts.limit === undefined ? 5 : Number(opts.limit);
      if (!Number.isInteger(radius) || radius < 1 || radius > 50000) throw new GeoapifyError('radius must be 1..50000 meters');
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new GeoapifyError('limit must be 1..20');
      result = await client.mcpCall('search_places', {
        category: safeCategory(opts.category),
        ...point, radius_meters: radius, limit
      }); break;
    }
    case 'mcp-route': {
      const mode = opts.mode || 'walk';
      if (!['walk', 'bicycle', 'drive'].includes(mode)) throw new GeoapifyError('Mode must be walk, bicycle, or drive');
      result = await client.mcpCall('calculate_route', {
        waypoints: [parsePoint(opts.from), parsePoint(opts.to)],
        mode, geometry_scope: 'none'
      }); break;
    }
    default: throw new GeoapifyError(`Unknown command: ${command}`);
  }
  return { result, meta: { apiCalls: client.calls, maxCalls: client.maxCalls, sanitizedTrace: client.trace } };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  execute(process.argv.slice(2)).then(result => {
    if (result.help) console.log(result.help);
    else console.log(JSON.stringify(result, null, 2));
  }).catch(error => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
