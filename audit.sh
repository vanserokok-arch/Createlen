#!/usr/bin/env bash
# audit.sh — run basic audit/checks on the codebase

set -e

echo "=== Running audit checks ==="

# 1. Check required files exist
echo "[1/4] Checking required files..."
for f in server.js package.json .replit; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: Missing required file: $f"
    exit 1
  fi
done
echo "✓ All required files present"

# 2. Check package.json dependencies
echo "[2/4] Checking dependencies in package.json..."
required_deps=("express" "node-fetch" "archiver" "dotenv")
for dep in "${required_deps[@]}"; do
  if ! grep -q "\"$dep\"" package.json; then
    echo "ERROR: Missing dependency in package.json: $dep"
    exit 1
  fi
done
echo "✓ All required dependencies present"

# 3. Syntax check server.js
echo "[3/4] Checking server.js syntax..."
if command -v node &> /dev/null; then
  node --check server.js
  echo "✓ server.js syntax OK"
else
  echo "⚠ Node.js not found, skipping syntax check"
fi

# 4. Check for obvious security issues (hardcoded secrets)
echo "[4/4] Scanning for hardcoded secrets..."
if grep -rn --include="*.js" --include="*.json" -E "(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36})" . 2>/dev/null; then
  echo "ERROR: Found potential hardcoded secrets"
  exit 1
fi
echo "✓ No obvious hardcoded secrets found"

echo ""
echo "=== Audit complete: All checks passed ==="
