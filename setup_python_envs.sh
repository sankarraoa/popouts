#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICES_DIR="$ROOT_DIR/services"

if command -v python3.12 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3.12)"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
else
  echo "Python 3 is required but was not found on PATH."
  exit 1
fi

SERVICES=(
  "database-service"
  "license-service"
  "llm-service"
  "website"
)

for service in "${SERVICES[@]}"; do
  service_dir="$SERVICES_DIR/$service"
  requirements_file="$service_dir/requirements.txt"
  venv_dir="$service_dir/venv"
  python_bin="$venv_dir/bin/python"
  pip_bin="$venv_dir/bin/pip"

  if [[ ! -f "$requirements_file" ]]; then
    echo "Skipping $service: no requirements.txt found"
    continue
  fi

  echo
  echo "==> Setting up $service"

  if [[ ! -d "$venv_dir" ]]; then
    "$PYTHON_BIN" -m venv "$venv_dir"
  fi

  "$python_bin" -m pip install --upgrade pip
  "$pip_bin" install -r "$requirements_file"
done

echo
echo "All service environments are ready."
