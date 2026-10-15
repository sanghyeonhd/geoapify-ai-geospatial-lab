#!/usr/bin/env bash
# Run locally after installing/authenticating GitHub CLI. Never uploads .env.
set -euo pipefail
cd "$(dirname "$0")/.."
repo="sanghyeonhd/geoapify-ai-geospatial-lab"
if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required: https://cli.github.com/" >&2; exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "Authenticate with 'gh auth login', then rerun." >&2; exit 1
fi
login="$(gh api user --jq .login)"
if [[ "$login" != "sanghyeonhd" ]]; then
  echo "Refusing to publish as $login: expected sanghyeonhd." >&2; exit 1
fi
if [[ -f .env ]]; then
  echo "Note: .env exists but is excluded by .gitignore. Checking..."
fi
if [[ ! -d .git ]]; then
  git init -b main
fi
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "Refusing to publish: .env is tracked." >&2; exit 1
fi
git add README.md LICENSE THIRD_PARTY_NOTICES.md .gitignore .env.example .mcp.json package.json src test fixtures scripts docs prompts .github
if git diff --cached --quiet; then
  echo "No new changes to commit." >&2
else
  git commit -m "Initial independent Geoapify OpenAPI and MCP lab"
fi
if gh repo view "$repo" >/dev/null 2>&1; then
  echo "Repository already exists; refusing to overwrite or force-push: $repo" >&2
  exit 1
fi
gh repo create "$repo" --public --description "Standalone credit-aware Geoapify OpenAPI and MCP reproducibility lab" --source=. --remote=origin --push
printf '\nPublished: https://github.com/%s\n' "$repo"
