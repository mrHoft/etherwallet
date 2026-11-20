#!/usr/bin/env bash
set -euo pipefail

if [ ! -f dist/index.html ]; then
  echo "dist/index.html not found; run npm run build first." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has uncommitted changes. Commit or stash them before deploying." >&2
  exit 1
fi

original_branch=$(git rev-parse --abbrev-ref HEAD)
restore_branch() { git checkout -q "$original_branch" || true; }
trap restore_branch EXIT

git fetch origin gh-pages
git checkout -B gh-pages origin/gh-pages

git rm -rf --ignore-unmatch . ':(exclude).gitignore'

cp -r dist/. .
git add -A
git diff --cached --quiet || git commit -m 'feat: deploy'
git push --set-upstream origin gh-pages
