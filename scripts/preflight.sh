#!/usr/bin/env bash
# preflight.sh — runs BEFORE `docker compose build`.
# Verifies .env exists and required values are set so the build doesn't waste time
# only to fail at runtime. Prints a friendly checklist either way.

set -euo pipefail

cd "$(dirname "$0")/.."

C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'; C_BLUE='\033[0;34m'; C_OFF='\033[0m'

info()  { printf "${C_BLUE}ℹ${C_OFF}  %s\n" "$*"; }
ok()    { printf "${C_GREEN}✓${C_OFF}  %s\n" "$*"; }
warn()  { printf "${C_YELLOW}!${C_OFF}  %s\n" "$*"; }
fail()  { printf "${C_RED}✗${C_OFF}  %s\n" "$*"; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PharmaCare — preflight checks (must pass before building)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ERRORS=0

# 1) .env file exists
if [[ ! -f .env ]]; then
  fail ".env file is missing"
  echo "    → Run: cp .env.example .env  then edit it."
  echo "    → Required values: MONGO_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ADMIN_PASSWORD"
  exit 1
fi
ok ".env file present"

# Source .env without polluting current shell's exit code on bad lines
set -a
# shellcheck disable=SC1091
source .env || true
set +a

# 2) Required env vars set + not placeholder
check_var() {
  local name="$1" placeholder_pattern="$2"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    fail "$name is not set in .env"
    ERRORS=$((ERRORS+1))
    return
  fi
  if [[ -n "$placeholder_pattern" ]] && [[ "$value" =~ $placeholder_pattern ]]; then
    fail "$name still uses the placeholder value — replace it with a real one"
    ERRORS=$((ERRORS+1))
    return
  fi
  ok "$name is set"
}

check_var MONGO_URI       'replace_with|<password>|<user>|<cluster>'
check_var JWT_ACCESS_SECRET  'replace_with'
check_var JWT_REFRESH_SECRET 'replace_with'
check_var ADMIN_PASSWORD     ''

# 3) JWT secrets long enough
for v in JWT_ACCESS_SECRET JWT_REFRESH_SECRET; do
  val="${!v:-}"
  if [[ ${#val} -lt 32 ]]; then
    warn "$v is short (${#val} chars) — recommend at least 32. Generate with: openssl rand -base64 64"
  fi
done

# 4) Mongo URI shape (atlas srv or plain mongo)
if [[ -n "${MONGO_URI:-}" ]] && ! [[ "$MONGO_URI" =~ ^mongodb(\+srv)?:// ]]; then
  fail "MONGO_URI doesn't start with mongodb:// or mongodb+srv://"
  ERRORS=$((ERRORS+1))
fi

# 5) Docker available
if ! command -v docker >/dev/null 2>&1; then
  fail "docker is not installed or not in PATH"
  ERRORS=$((ERRORS+1))
elif ! docker info >/dev/null 2>&1; then
  fail "docker daemon is not reachable (is it running?)"
  ERRORS=$((ERRORS+1))
else
  ok "docker is reachable"
fi

echo ""
if [[ $ERRORS -gt 0 ]]; then
  fail "$ERRORS check(s) failed — fix the .env values above before continuing."
  echo ""
  exit 1
fi

ok "All checks passed."
echo ""
info "Next: run    docker compose build    (or: make build)"
echo ""
