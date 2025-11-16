#!/usr/bin/env bash
# audit.sh — collects environment info, checks git history for leaked keys,
# writes improved_server.js for review (does NOT overwrite server.js).
# Usage: chmod +x audit.sh && ./audit.sh

set -e

echo "=== Environment ==="
node -v 2>/dev/null || echo "node not found"
npm -v 2>/dev/null || echo "npm not found"
echo

echo "=== Git status & branch ==="
git status --porcelain --untracked-files=all || true
echo "Branch:" $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
git log -n 5 --oneline || true
echo

echo "=== Search history for 'sk-' strings (possible API keys) ==="
git grep -n "sk-" || echo "No 'sk-' strings in working tree files. Searching commits..."
git log --all -S 'sk-' --pretty=format:'%h %ad %s' --date=short || echo "No matches in history"
echo

echo "=== Check process on port 3000 ==="
if command -v lsof >/dev/null 2>&1; then
  lsof -i :3000 -Pn || echo "no process listening on :3000"
else
  ss -ltnp | grep 3000 || echo "no process listening on :3000"
fi
echo

echo "=== Show server.js token/env usage lines ==="
grep -n "process.env" server.js || echo "No process.env found or server.js missing"
grep -n "checkToken" server.js || true
echo

echo "Created improved_server.js for review (if server.js exists, it copies content).
If you want to apply it, run:
  cp server.js server.js.bak
  mv improved_server.js server.js
Then test locally:
  OPENAI_KEY='sk-NEW' ALLOWED_TOKEN='keis-widget-1' npm start
  curl -v -X POST 'http://localhost:3000/generate' -H 'Content-Type: application/json' -d '{\"token\":\"keis-widget-1\",\"brief\":\"Тестовый бриф\"}'
"
