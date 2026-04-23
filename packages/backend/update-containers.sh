#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

usage() {
  cat <<'EOF'
Usage: ./update-containers.sh [all|api|worker] [--logs] [--env-file PATH]

Rebuilds the backend image and refreshes the running backend containers.
An external PostgreSQL instance is expected via DATABASE_URL.
If no env file is provided, the script automatically uses `.env.docker` when present.
Builds always run with `--pull --no-cache`.

Examples:
  ./update-containers.sh
  ./update-containers.sh api
  ./update-containers.sh --env-file .env.docker
  ./update-containers.sh worker --logs
EOF
}

target="all"
show_logs="false"
env_file=""

while (($# > 0)); do
  case "$1" in
    all|api|worker)
      target="$1"
      ;;
    --logs)
      show_logs="true"
      ;;
    --env-file)
      if (($# < 2)); then
        echo "--env-file requires a path argument." >&2
        usage >&2
        exit 1
      fi
      env_file="$2"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ -z "${env_file}" && -f "${SCRIPT_DIR}/.env.docker" ]]; then
  env_file="${SCRIPT_DIR}/.env.docker"
fi

if [[ -n "${env_file}" ]]; then
  if [[ ! -f "${env_file}" ]]; then
    echo "Env file not found: ${env_file}" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "${env_file}"
  set +a
fi

compose() {
  if [[ -n "${env_file}" ]]; then
    docker compose --env-file "${env_file}" -f "${COMPOSE_FILE}" "$@"
    return
  fi

  docker compose -f "${COMPOSE_FILE}" "$@"
}

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required and must point at your existing PostgreSQL instance." >&2
  if [[ -n "${env_file}" ]]; then
    echo "Checked env file: ${env_file}" >&2
  else
    echo "Provide it in the current shell or create ${SCRIPT_DIR}/.env.docker." >&2
  fi
  exit 1
fi

case "$target" in
  api)
    services=(backend-api)
    ;;
  worker)
    services=(backend-worker)
    ;;
  all)
    services=(backend-api backend-worker)
    ;;
esac

echo "Rebuilding backend image for: ${services[*]}"
compose build --pull --no-cache "${services[@]}"

echo "Recreating containers..."
compose up -d --remove-orphans "${services[@]}"

echo "Current container status:"
compose ps "${services[@]}"

if [[ "$show_logs" == "true" ]]; then
  echo
  echo "Recent logs:"
  compose logs --tail=100 "${services[@]}"
fi
