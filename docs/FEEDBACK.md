# Geoapify OpenAPI / MCP feedback — preliminary

Separate **facts confirmed against published specifications** from suggestions and future experiments. Do not interpret this page as a live API performance report.

## Published-spec observations

| Observation | Impact on this project | Evidence |
| --- | --- | --- |
| REST APIs support `x-api-key` authentication | A server-side CLI can avoid putting credentials in query URLs | Official OpenAPI `security` definitions |
| Places `filter=circle:` encodes `lon,lat` | Coordinate order needs a unit test | Places API documentation |
| Routing waypoint strings encode `lat,lon` | Cannot reuse GeoJSON coordinate arrays blindly | Routing OpenAPI operation description |
| MCP uses HTTP POST JSON-RPC `tools/list` and `tools/call` | A minimal standalone client can inspect or invoke tools without a full MCP SDK | Geoapify MCP developer documentation |
| `list_place_categories` is documented as zero-credit | Useful to select exact categories before paid searches | Geoapify MCP reference |

## Suggested developer-experience improvements (not verified provider defects)

1. Add a compact, downloadable **cross-API coordinate-order cheat sheet** that contrasts named `{lat, lon}`, route waypoint strings, circle filters and GeoJSON arrays.
2. Provide an end-to-end **zero-dependency MCP example** (tools/list → geocode → place search) in Node.js with an environment-protected API key and explicit error handling.
3. Publish runnable **OpenAPI/MCP contract tests** showing how to detect breaking endpoint and schema changes across generated specifications.
4. Consider standardized examples for **no geocoding match**, **ambiguous cities** and **empty place searches**, so agents are encouraged to abstain rather than generate confident but unsupported place recommendations.
5. Include **credit-cost hints** in tool descriptions and guidance on minimal tool calls for multi-step geospatial questions.

## Planned evaluation (requires API key; not yet executed)

- Compare the REST reference `discover` run and Claude Code MCP for the same address/category/radius in three cities.
- Count calls, note tool selection, check country disambiguation and result grounding, record the difference between retries and actual user requests.
- Maintain a small redacted table of false assumptions or schema interpretation errors that required human correction.

There are intentionally no made-up benchmarks, accuracy percentages or claims of production integration here.
