# Agent prompt pack (Claude Code with Geoapify MCP)

## Prompt A — Tool discovery and location grounding

Use the connected Geoapify MCP server. Before giving any recommendation, confirm that MCP tools are available. Geocode "Berlin, Germany" using `geocode_address` with limit 1. Print the returned formatted location and coordinates. If the returned location is ambiguous or does not match Berlin, stop and ask for clarification. Never invent coordinates.

## Prompt B — Minimal-credit place discovery

Using Geoapify MCP and the coordinates returned in Prompt A, find at most five cafés within 1000 meters. If needed, consult `list_place_categories` (it is currently a zero-credit tool) and then call `search_places` using an exact category identifier such as `catering.cafe`. Do not call multiple fallback services or repeat a search automatically. Show only locations actually returned by Geoapify. Explicitly distinguish absent fields from available facts. Include the Geoapify and OpenStreetMap attribution if displaying the results in a user interface.

## Prompt C — Route verification

Use the connected Geoapify MCP tool `calculate_route` to calculate a walking route from (52.52, 13.405) to (52.5163, 13.3777). Confirm whether the tool needs named `{lat, lon}` waypoints. Ask for `geometry_scope: "none"` where supported to avoid downloading unnecessary geometry. Return distance and duration only if present in the tool output. Do not guess a travel time when the call fails.

## Prompt D — Human guidance evaluation

Run the same café-location request as the direct REST CLI baseline. Write a short table containing: selected tool names, number of calls, confirmed location, category, result count, which fields were absent, and any prompt correction required. Do not publish API keys, full raw headers, user-specific location data, or tool logs containing credentials. If a result is uncertain, mark it as unverified.

## Development prompt (AI-assisted OpenAPI track)

Using Geoapify's official machine-readable OpenAPI specifications as the source of truth, build a minimal Node.js 20+ CLI integrating forward geocoding, Places and Routing. Require header-based private API-key authentication, an explicit --live flag, a strict per-process request budget, small Places limits, and offline mocked unit tests. Add a manual JSON-RPC MCP client for tools/list and tools/call and a Claude Code .mcp.json that references a private environment variable. Document coordinate order, known limitations, licensing and upstream MIT attribution. Do not include any private product code or user data.

## Human review checklist

- Verify endpoint paths, operation methods, request names and allowed travel modes against the official specs.
- Confirm that `circle` filters use `longitude,latitude` and that Routing waypoints use `latitude,longitude`.
- Never claim successful live tests based on synthetic or mocked API responses.
- Avoid accidental paid usage: no default live mode, no retry loops, small result sets.
- Ensure a public release contains no secrets or confidential application source.
