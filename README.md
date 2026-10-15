# Geoapify AI Geospatial Lab

**A standalone, MIT-licensed OpenAPI + MCP reference workflow for address lookup, nearby places and routing, designed for an AI × geospatial experiment.**

This repository has no product backend, no third-party private source code, no tracking, no user accounts, and **no real API credentials**. It is deliberately narrow: you can reproduce the core workflow with zero API credits, and opt in to live requests when ready.

## Why this exists

Location agents often fail on subtle details: geocoding the wrong city, using longitude and latitude in the wrong order, selecting an unsupported place category, inventing names for missing POIs, or wasting credits through retries. This experiment offers a deterministic REST baseline alongside Geoapify's live MCP tools. A human can then run the same tasks through an MCP-compatible AI assistant and compare the outcomes.

**Tracks:** Build (AI-assisted OpenAPI integration), Agent/Experiment (MCP tool-use walkthrough, failure analysis). **Status:** Local runnable proof of concept; offline automated tests passed. Live API / AI-client evaluations are **not** claimed until someone runs them with their own key.

## Quick start (0 API credits)

Requirements: Node.js **20.12+** (tested with Node.js 22); no `npm install` needed because this repo has no runtime dependencies.

```bash
npm test
npm run spec:check          # checks bundled, clearly labeled OpenAPI subsets offline
npm run examples            # displays a synthetic, explicitly labeled output
node src/cli.mjs help
```

## Live OpenAPI calls (explicit opt-in)

1. Create a personal development key at https://myprojects.geoapify.com/.
2. Copy `.env.example` to `.env`, and set `GEOAPIFY_API_KEY` there. **Never commit `.env`.**
3. Set `GEOAPIFY_MAX_CALLS=6` (default). This is a *per-process request cap*, not a guarantee against account-level spending across multiple runs.
4. Run commands with `--live` (necessary for every network call):

```bash
node --env-file=.env src/cli.mjs geocode 'Berlin, Germany' --live
node --env-file=.env src/cli.mjs nearby --lat 52.52 --lon 13.405 --category catering.cafe --live
node --env-file=.env src/cli.mjs discover 'Berlin, Germany' --category catering.cafe --live
node --env-file=.env src/cli.mjs route --from 52.52,13.405 --to 52.5163,13.3777 --mode walk --live
```

The `discover` flow intentionally uses **one geocoding request plus one Places request**. Places `limit` is capped at 20. Missing results are reported instead of making up a place or guessing a city. HTTP failures do not trigger automatic retries.

A rewrite of Geoapify's original MIT Node.js batch-geocoding example is included:

```bash
node --env-file=.env src/batch-geocode.mjs fixtures/sample-addresses.txt results.json
```

This batch example processes at most `GEOAPIFY_MAX_CALLS` input addresses and spaces calls by at least 200 ms. API calls are charged according to the Geoapify plan. **Offline demos and tests cost zero.**

## Geoapify MCP: manual calls or real AI agent

The CLI can discover and invoke Geoapify's remote HTTP MCP tools through JSON-RPC with a private `x-api-key` header:

```bash
node --env-file=.env src/cli.mjs mcp-tools --live
node --env-file=.env src/cli.mjs mcp-geocode 'Berlin, Germany' --live
node --env-file=.env src/cli.mjs mcp-discover 'Berlin, Germany' --category catering.cafe --country-code de --live
node --env-file=.env src/cli.mjs mcp-places --lat 52.52 --lon 13.405 --category catering.cafe --live
node --env-file=.env src/cli.mjs mcp-route --from 52.52,13.405 --to 52.5163,13.3777 --live
```

The new `mcp-discover` command chains `geocode_address` → `search_places` with a two-letter country guard and no LLM reasoning, so reviewers can compare identical REST and MCP workflows directly. It requires a real Geoapify key and uses up to two billable tool calls.

For agent-led tool selection, connect the bundled `.mcp.json` in **Claude Code**. Export `GEOAPIFY_API_KEY` into the shell environment where Claude Code starts; see [step-by-step walkthrough](docs/WALKTHROUGH.md) and [safe agent prompts](prompts/CLAUDE_AGENT.md). Official provider MCP docs: https://apidocs.geoapify.com/docs/mcp/.

**API-credit protection:** `list_place_categories` currently costs zero credits, but may still count against the local request budget. Test agent prompts with one city and a small POI limit before scaling. Never expose API keys in screenshots, logs, or commits.

## Architecture

```text
       Human / Claude Code (MCP-compatible client)
                   |          |
             .mcp.json    prompt instructions
                   |          |
                   +---- Geoapify HTTP MCP (/v1/mcp)
                               |
                               +--> tools/list, tools/call

            Local CLI + deterministic baseline
                   |
          GeoapifyClient + request budget
                   |
           REST/OpenAPI contracts
                   |
          +--------+---------+
          |        |         |
     /v1/geocode /v2/places /v1/routing

  Offline unit tests use mock responses (no real requests).
```

Main files: `src/geoapify.mjs` (REST and MCP client), `src/workflow.mjs` (two-call REST POI workflow), `src/mcp-workflow.mjs` (two-tool MCP reference workflow), `src/cli.mjs` (explicit opt-in CLI), `src/batch-geocode.mjs` (upstream sample adaptation), `scripts/check-openapi.mjs` (OpenAPI endpoint contract checks).

## Geoapify OpenAPI sources

Based on the MIT-licensed official specs at https://github.com/geoapify/geoapify-openapi-specs:

- Forward geocoding: `api-specs/forward-geocoding/forward-geocoding-api-openapi-specs.json`
- Places: `api-specs/places/places-api-openapi-specs.json`
- Routing: `api-specs/routing/routing-api-openapi-specs.json`
- MCP: `api-specs/mcp/mcp-api-openapi-specs.json`

`npm run spec:check` compares against intentionally **minimal local schema snapshots** (no network). To verify the *current official* GitHub specs over the network without using Geoapify credits:

```bash
node scripts/check-openapi.mjs --online
```

The latter requires internet access and can reveal breaking changes in the source documentation; it does **not** test live API responses.

## Reproducibility and documentation

- [Full illustrated-in-text tutorial and MCP client setup](docs/WALKTHROUGH.md)
- [Build log, AI instructions and human corrections](docs/BUILD_LOG.md)
- [Measured vs proposed feedback](docs/FEEDBACK.md)
- [Agent prompts](prompts/CLAUDE_AGENT.md)
- [Upstream copyright and attribution](THIRD_PARTY_NOTICES.md)

To compare an AI agent with the deterministic baseline: run `discover` with an address, then ask a connected MCP agent to geocode the **same** address, choose a matching category, and search within the **same** radius. Record each tool call, selected city, result count, errors, and credit usage, without publishing personal location data.

## Known limitations

- No hosted UI; it is a command-line reproducible workflow (which the Batch #2 program explicitly accepts).
- Geoapify services and any AI client require the user's own keys and connectivity; live services were not accessed during local unit testing.
- MCP `tools/call` responses are shown in raw form to avoid guessing schema-specific data shapes; tool discovery is recommended before a call.
- MCP CLI does not perform LLM reasoning; Claude Code or another MCP-compatible AI client performs the AI tool selection step.
- No cross-process account-wide credit budget, persistent cache or production abuse protection. The six-request limit resets on a new invocation.
- Geocoding may be ambiguous: verify the formatted address/country instead of assuming the first result is always the intended location.
- Coordinates in Geoapify route waypoint strings are `lat,lon`; Places circles use `lon,lat`. These are tested independently.

## Privacy, licensing, and disclaimer

No personal data or actual location traces are collected by this repository. Provider requests send the address/coordinates supplied to the CLI to Geoapify when the user chooses `--live`.

MIT licensed. This independent sample acknowledges its basis in Geoapify's own [MIT Node.js sample](https://github.com/geoapify/maps-api-code-samples/tree/main/node/geocoding-with-RPS-limit-respect) in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Not officially affiliated with Geoapify.

**Attribution:** When showing Geoapify-powered places/maps in a UI, follow Geoapify's and OpenStreetMap's attribution requirements. This CLI only prints raw/summarized JSON and no tile map.
