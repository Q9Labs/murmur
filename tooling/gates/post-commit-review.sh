#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

commit="$(git rev-parse HEAD)"
short_commit="$(git rev-parse --short HEAD)"
title="$(git log -1 --pretty=%s)"
review_runs="${CODEX_REVIEW_RUNS:-1}"

if ! [[ "$review_runs" =~ ^[1-9][0-9]*$ ]]; then
  echo "CODEX_REVIEW_RUNS must be a positive integer; got '$review_runs'." >&2
  exit 2
fi

log_dir=".git/codex-reviews/$short_commit"
mkdir -p "$log_dir"

run=1
while [ "$run" -le "$review_runs" ]; do
  log_file="$log_dir/run-$run.log"
  echo "Running Codex post-commit review $run/$review_runs for $short_commit: $title"
  if codex review --commit "$commit" --title "$title" 2>&1 | tee "$log_file"; then
    echo "Codex review $run/$review_runs passed. Log: $log_file"
  else
    status=$?
    echo "Codex review $run/$review_runs failed with exit code $status. Log: $log_file" >&2
    exit "$status"
  fi
  run=$((run + 1))
done
