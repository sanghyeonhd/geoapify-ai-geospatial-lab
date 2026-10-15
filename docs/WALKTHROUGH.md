# Walkthrough: Geoapify OpenAPI + MCP without a hosted product

This tutorial is designed for reviewers with Node.js 20.12+ and optionally Claude Code. For exact API parameters, refer to the official machine-readable Geoapify specs. No screenshots are required: all critical settings and expected commands are shown below.

## Step 1: Run the offline reference scenario

```bash
npm test
npm run spec:check
npm run examples
```

Expected: 16+ unit tests pass; four endpoint contracts pass; a synthetic place is printed with `apiCalls: 0`. The sample place is fake and is used only to demonstrate output shape. This step must not make any API request.

## Step 2: Read the relevant OpenAPI definitions

The official catalog is at https://github.com/geoapify/geoapify-openapi-specs/blob/main/api-specs/index.json.

- Forward Geocoding: `/v1/geocode/search` (`text`, `format`, `limit`)
- Places: `/v2/places` (`categories`, `filter`, `bias`, `limit`)
- Routing: `/v1/routing` (`waypoints`, `mode`, `format`)
- MCP: `POST /v1/mcp` with JSON-RPC `tools/list` or `tools/call`

The local validator is intentionally conservative: it verifies method, path, required request names used by this sample, and x-api-key support. It does not replace runtime response validation or a comprehensive OpenAPI generator.

Compare the *current* spec instead of the bundled snapshot with:

```bash
node scripts/check-openapi.mjs --online
```

## Step 3: Create a separate Geoapify test API key

Sign into https://myprojects.geoapify.com, create or select a developer project, and copy your key into an untracked `.env` file:

```bash
cp .env.example .env
# edit .env and set GEOAPIFY_API_KEY to your own key
```

Important: never paste the key into prompts, chats, screenshots, GitHub issues, or public repo files. The `.gitignore` prevents accidental tracking of `.env`.

## Step 4: Run a minimal, two-call search

```bash
node --env-file=.env src/cli.mjs discover 'Berlin, Germany' --category catering.cafe --radius 1000 --limit 5 --live
```

The program calls geocoding once, extracts a returned location, then calls Geoapify Places once. It returns a `resolvedAddress`, a `center`, a list of available POIs, and a `sanitizedTrace` showing only method and endpoint names.

Manual check: Is `resolvedAddress` in the intended country? If not, do not accept the result as proof of a correct location. The sample refuses an empty geocoding response, but an ambiguous *nonempty* response still requires inspection.

## Step 5: Inspect Geoapify MCP independently

```bash
node --env-file=.env src/cli.mjs mcp-tools --live
node --env-file=.env src/cli.mjs mcp-geocode 'Berlin, Germany' --live
```

`mcp-tools` sends JSON-RPC `tools/list`; `mcp-geocode` sends `tools/call` for `geocode_address`. The endpoint is `https://api.geoapify.com/v1/mcp`, with `x-api-key` stored only in the HTTP header. `mcp-geocode` displays the raw tool response to avoid undocumented assumptions about return shapes.

## Step 6: Connect a real AI assistant (Claude Code)

The repository contains this **credential-free** `.mcp.json`:

```json
{
  "mcpServers": {
    "geoapify": {
      "type": "http",
      "url": "https://api.geoapify.com/v1/mcp",
      "headers": { "x-api-key": "${GEOAPIFY_API_KEY}" }
    }
  }
}
```

Export the API key to the environment used to start Claude Code. Example for a local macOS/Linux shell:

```bash
export GEOAPIFY_API_KEY='your_private_key_here'
claude
```

Then run `/mcp` in Claude Code and verify the server is connected. Paste a prompt from `prompts/CLAUDE_AGENT.md` into Claude Code. Approve Geoapify tool calls only if they are within your intended test scope. Official configuration guidance: https://apidocs.geoapify.com/how-to/api-tooling-ai/connect-ai-client-mcp/.

The agent should call `geocode_address`, optionally `list_place_categories`, then `search_places`; for routing questions it can call `calculate_route`. Inspect tool calls and their arguments instead of assuming a fluent answer means the geographic facts are accurate.

## Step 7: Compare REST baseline and AI tool use

Use a compact, privacy-safe worksheet:

| Criterion | Direct REST baseline | MCP agent experiment |
| --- | --- | --- |
| Address requested | Berlin, Germany | Berlin, Germany |
| Category | catering.cafe | catering.cafe |
| Radius | 1000 m | 1000 m |
| Correct location/country? | Verify returned address | Verify chosen tool arguments |
| Query count | Typically 2 calls | Count actual MCP calls |
| Hallucinated names? | No synthesized POIs | Check agent answer against tool output |
| Failures/corrections | Record here | Record here |

This is a **reproducibility template**, not a fabricated benchmark. Actual API/agent measurements should be filled in only after the corresponding live experiment.

## Step 8: Build from the official Geoapify code sample

The batch-geocoding exercise was adapted from the official MIT-licensed [Geoapify Node.js example](https://github.com/geoapify/maps-api-code-samples/tree/main/node/geocoding-with-RPS-limit-respect). Its original shape (read input lines → submit geocoding requests → write results) was kept, while credential handling, error semantics, and request budgeting were improved.

Try a three-address batch (requires up to three real geocoding requests):

```bash
node --env-file=.env src/batch-geocode.mjs fixtures/sample-addresses.txt results.json
```

The batch sample waits at least 200 ms between requests. Do not use it to work around your daily Geoapify quota.

## Step 9: Collect honest feedback

Start at `docs/FEEDBACK.md` and record evidence separately from proposed improvements. The program values where an AI coding assistant or MCP agent needed human guidance as much as successful examples.
