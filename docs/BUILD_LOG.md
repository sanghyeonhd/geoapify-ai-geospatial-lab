# Development log and human guidance

This independent experiment was created with AI coding assistance and manual review of Geoapify's public API documentation and published MIT-licensed examples. This is a transparent engineering log, not an invented transcript of a live Geoapify API session.

## Starting point

- Official upstream MIT sample: `geoapify/maps-api-code-samples/node/geocoding-with-RPS-limit-respect/geocode.js`.
- Official OpenAPI catalog: `geoapify/geoapify-openapi-specs/api-specs/index.json`.
- Official MCP reference: https://apidocs.geoapify.com/docs/mcp/.

## Prompts and implementation

The reproducible development instruction is included under "Development prompt" in `prompts/CLAUDE_AGENT.md`. A small, independent Node.js CLI was built rather than a hosted application. The original geocoding sample's input → request → output sequence was adapted to avoid hardcoding an API key and to stop when the local request budget runs out.

## Where manual guidance was important

1. **Coordinate order.** Places `filter=circle:` uses longitude then latitude; Routing `waypoints` uses latitude then longitude. The tool needs context-specific serialization and tests.
2. **Trust boundaries.** AI responses may fabricate missing fields. The REST baseline lists only fields returned by the API and stops on a missing geocoding result.
3. **API budgeting.** Auto retries and large Places limits risk exhausting a small free quota. Live calls must be explicitly opted into; defaults are intentionally small.
4. **Key handling.** The upstream pedagogical sample shows a placeholder API key embedded in code. The adaptation uses an environment variable and the private `x-api-key` HTTP header.
5. **MCP protocol.** Tool names and arguments must follow the current server schema; a short `tools/list` discovery test and raw response mode are safer than assuming undocumented field names.

## Verified results (offline)

- Automated mocked tests cover REST serialization, coordinate handling, HTTP error treatment, budget blocking, discovery workflow and MCP JSON-RPC shape.
- `npm run spec:check` verifies local, reduced OpenAPI endpoint contract snapshots. This is **not** a complete specification validator.
- `npm run examples` produces a marked synthetic example with zero real API calls.

## Not yet verified

- Live Geoapify REST or MCP endpoint responses with a real key.
- Real Claude Code tool discovery and agent-led outputs.
- Performance, search relevance, current quota consumption or accuracy across multiple countries.

A live evaluation should record actual call counts and error cases after a developer provides their own key. The absence of live testing is not being represented as a success.
