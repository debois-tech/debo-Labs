#!/usr/bin/env bash
# Builds the lab server image and pushes it to Vercel Container Registry, where Vercel Sandbox boots it from.
# Run from anywhere inside the repo, logged in to Vercel (`npx vercel login`) and linked to the project (`npx vercel link`).
#   bash deploy/vercel/push-image.sh            pushes debo-labs-server:latest
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }
[ "$(uname -m)" = "x86_64" ] || echo "Note: Vercel Sandbox needs a linux/amd64 image; on this machine the build may be emulated and slow."
npx --yes vercel vcr build docker . "${IMAGE:-debo-labs-server:latest}" --push
echo "Pushed. In the Vercel project set LAB_SANDBOX=1 (and the other variables in deploy/vercel/README.md), then redeploy."
