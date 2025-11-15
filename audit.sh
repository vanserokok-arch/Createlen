#!/usr/bin/env bash
# audit.sh — simple audit script for dependencies and basic checks

set -e

echo "=== Dependency Audit ==="
npm audit --production || true

echo ""
echo "=== Package License Check ==="
npx license-checker --summary 2>/dev/null || echo "license-checker not available, skipping"

echo ""
echo "=== Basic File Checks ==="
if [ -f "server.js" ]; then
  echo "✓ server.js exists"
else
  echo "✗ server.js missing"
  exit 1
fi

if [ -f "package.json" ]; then
  echo "✓ package.json exists"
else
  echo "✗ package.json missing"
  exit 1
fi

echo ""
echo "=== Environment Variable Checks ==="
if [ -z "$OPENAI_KEY" ] && [ -z "$MOCK_OPENAI" ]; then
  echo "⚠ WARNING: OPENAI_KEY not set and MOCK_OPENAI not enabled"
else
  echo "✓ OPENAI_KEY or MOCK_OPENAI configured"
fi

if [ -n "$ALLOWED_TOKEN" ]; then
  echo "✓ ALLOWED_TOKEN is set"
else
  echo "⚠ WARNING: ALLOWED_TOKEN not set (auth disabled)"
fi

echo ""
echo "=== Audit Complete ==="
