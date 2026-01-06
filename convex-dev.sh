#!/bin/bash
# Wrapper script to run Convex dev with TMPDIR set to avoid cross-device link errors
# This ensures temporary files are created on the same filesystem as .convex directory

cd "$(dirname "$0")"
export TMPDIR="$(pwd)/.tmp"
mkdir -p "$TMPDIR"

# Run convex dev with all arguments passed through
exec bunx convex dev "$@"


