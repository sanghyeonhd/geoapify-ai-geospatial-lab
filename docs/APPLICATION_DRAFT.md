# Geoapify Batch #2 application draft — public repository published

**Official program:** https://www.geoapify.com/open-geospatial-program/#batch-2-ai-geospatial  
**Subject:** Geoapify Open Geospatial Program - Batch #2 Application

This is a proposal, NOT the post-selection Final Submission. The public project repository is published at https://github.com/sanghyeonhd/geoapify-ai-geospatial-lab. Offline tests pass; live Geoapify/AI-client validation is not yet claimed.

## 1. Who are you?
- Name: Daniel Lee
- Role (developer / student / analyst / creator): Independent Software Engineer / Developer
- Country / timezone: South Korea / Asia/Seoul (UTC+9)

## 2. Project overview
- Project title: Geoapify AI Geospatial Lab — Credit-Aware OpenAPI and MCP Experiments
- One-sentence summary: A small MIT-licensed Node.js CLI and MCP agent guide for reproducible geocoding, place discovery, and routing experiments, with safe API usage limits and OpenAPI contract tests.
- What problem, workflow, or AI/geospatial question will you explore? How accurately and efficiently can an AI assistant use Geoapify MCP compared with a deterministic OpenAPI-based reference workflow? The project tests city grounding, category selection, coordinate order, route arguments, error reporting and minimal credit consumption.
- Project format and category (Build / Agent / Automate / Experiment): Build + Experiment, with an optional MCP Agent track.

## 3. Links (existing resources)
- Your GitHub repository: https://github.com/sanghyeonhd/geoapify-ai-geospatial-lab
- Portfolio / blog / profile: https://github.com/sanghyeonhd
- Other: https://github.com/geoapify/maps-api-code-samples (MIT-licensed upstream example, properly credited).

## 4. Geoapify and AI approach
- Track (OpenAPI / MCP / both): Both.
- Which Geoapify specifications, APIs, or MCP tools do you expect to use? Forward Geocoding, Places and Routing OpenAPI schemas, plus MCP `tools/list`, `geocode_address`, `search_places`, and `calculate_route`. A deterministic `mcp-discover` command now chains geocoding and place discovery for side-by-side REST comparison.
- Which AI coding tool, AI client, or agent framework will you use? AI-assisted Node.js development, with Claude Code planned as the MCP-compatible agent client. No paid LLM API key is needed for the CLI reference.
- How will you capture prompts, tool use, and lessons learned? Public `prompts/CLAUDE_AGENT.md`, `docs/BUILD_LOG.md`, mocked unit tests, sanitized tool-call traces and `docs/FEEDBACK.md`. Live agent observations will be recorded after testing with a private Geoapify key, without sharing the key.

## 5. Deliverables
- Where will the public code be published? Published public GitHub repository: https://github.com/sanghyeonhd/geoapify-ai-geospatial-lab .
- How will reviewers run or reproduce your project (including AI client setup, if needed)? Node.js 20.12+; run `npm test`, `npm run spec:check`, and `npm run examples` offline. Use `GEOAPIFY_API_KEY` and explicit `--live` for real Geoapify API calls. For AI-led tests, connect the bundled `.mcp.json` to Claude Code and run example prompts. The documented initial offline suite passes 21 tests.
- Where will the tutorial or walkthrough be published? `docs/WALKTHROUGH.md` in the public repository, with architecture, setup, API calls, MCP configuration, agent prompts, known limitations and feedback.

## 6. Timeline
- Planned start date: October 23, 2026 (subject to selection).
- Planned completion date: November 6, 2026 (subject to the program schedule).

## 7. Payment availability
- Country where you can receive a payout: South Korea.
- Which methods can you receive? International bank transfer preferred; PayPal may be possible subject to mutual availability. No account details are included.

## 8. Additional notes
- Anything else we should know? This is a fully independent, narrowly scoped open-source example, developed from official Geoapify MIT-licensed code samples with attribution. The project does not use any proprietary application source or private data. Its baseline tests run at zero API-credit cost, and live API checks are explicitly opt-in and capped per command. Current results are verified locally with mocks, not misrepresented as live measurements.
