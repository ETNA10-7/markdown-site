#!/bin/bash

echo "🧹 Clearing all caches..."

# Stop any running Convex processes (if any)
pkill -f "convex dev" 2>/dev/null || true

# Clear all cache directories
rm -rf .convex
rm -rf node_modules/.cache
rm -rf .tmp
rm -rf node_modules/.vite
rm -rf .vite

# Force file updates
touch convex/posts.ts
touch convex/schema.ts
touch convex/pages.ts

echo "✅ Caches cleared!"
echo ""
echo "Now restart Convex with: ./convex-dev.sh"
echo "Wait 2-3 minutes, then check dashboard for contentCid"

