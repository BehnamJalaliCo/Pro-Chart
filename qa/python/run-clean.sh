#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
RUN_ID="${QA_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
OUT="${1:-$ROOT/artifacts/qa/python/$COMMIT/$RUN_ID}"
if [[ "$OUT" != /* ]]; then
  OUT="$ROOT/$OUT"
fi
BASE_IMAGE="${PROCHART_QA_BASE_IMAGE:-prochart-api:latest}"
TEST_IMAGE="${PROCHART_QA_TEST_IMAGE:-prochart-qa-pytest:9.1.1}"
STAGE="$(mktemp -d /tmp/prochart-python-clean.XXXXXX)"

cleanup() {
  rm -rf "$STAGE"
  unset DB_PASSWORD REDIS_PASSWORD ADMIN_PASSWORD GRAFANA_PASSWORD JWT_SECRET_KEY DATABASE_URL REDIS_URL
}
trap cleanup EXIT

mkdir -p "$STAGE/repo" "$OUT"

# Copy the observable worktree (including ignored legacy tests) while excluding
# credentials, runtime data, generated bundles, caches, backups, and artifacts.
rsync -a \
  --exclude='.git/' \
  --exclude='.env*' \
  --exclude='.cf' \
  --exclude='.igkey' \
  --exclude='*service-account*.json' \
  --exclude='*credentials*.json' \
  --exclude='secrets/' \
  --exclude='backups/' \
  --exclude='.codex-backups/' \
  --exclude='artifacts/' \
  --exclude='security-report/' \
  --exclude='avatar_work/' \
  --exclude='ml_models/' \
  --exclude='samples/' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='www/' \
  --exclude='media/' \
  --exclude='models/' \
  --exclude='logs/' \
  --exclude='*.log' \
  --exclude='*.bak' \
  --exclude='__pycache__/' \
  --exclude='.pytest_cache/' \
  "$ROOT/" "$STAGE/repo/"

# Do not execute a snapshot that still appears to contain a secret. The report is
# fully redacted and kept alongside the run evidence.
docker run --rm \
  -v "$STAGE/repo:/scan:ro" \
  -v "$OUT:/out" \
  zricethezav/gitleaks:v8.30.1 \
  dir /scan --redact=100 --report-format=json --report-path=/out/stage-gitleaks.json \
  --exit-code=1 --no-banner

SOURCE_FINGERPRINT="$(
  cd "$STAGE/repo"
  find src tests qa/python -type f -not -path '*/__pycache__/*' -print0 \
    | sort -z \
    | xargs -0 sha256sum \
    | sha256sum \
    | cut -d' ' -f1
)"

# Dependency installation is confined to the image build. Test execution below
# starts with --network none and cannot reach live DB/cache/provider services.
docker build \
  --build-arg "BASE_IMAGE=$BASE_IMAGE" \
  -t "$TEST_IMAGE" \
  "$ROOT/qa/python" \
  >"$OUT/image-build.log"

docker run --rm --network none --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=256m \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e PYTHONDONTWRITEBYTECODE=1 \
  "$TEST_IMAGE" --version >"$OUT/pytest-version.txt"

docker run --rm --network none --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=256m \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  --entrypoint python \
  "$TEST_IMAGE" -m pip freeze >"$OUT/package-freeze.txt"

set +e
docker run --rm --network none --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=256m \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  --entrypoint python \
  "$TEST_IMAGE" -m pip check >"$OUT/pip-check.txt" 2>&1
PIP_CHECK_EXIT="$?"
set -e

export DB_PASSWORD="$(openssl rand -hex 24)"
export REDIS_PASSWORD="$(openssl rand -hex 24)"
export ADMIN_PASSWORD="$(openssl rand -hex 24)"
export GRAFANA_PASSWORD="$(openssl rand -hex 24)"
export JWT_SECRET_KEY="$(openssl rand -hex 48)"
export DATABASE_URL="postgresql+asyncpg://qa:${DB_PASSWORD}@127.0.0.1:1/qa"
export REDIS_URL="redis://:${REDIS_PASSWORD}@127.0.0.1:1/0"

# The standalone middleware probe exercises HSTS enabled/disabled and custom
# CSP branches without starting the API or touching a live dependency.
set +e
docker run --rm --network none --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e PYTHONDONTWRITEBYTECODE=1 \
  -v "$STAGE/repo:/workspace:ro" \
  --entrypoint python \
  "$TEST_IMAGE" qa/python/security_headers_api_regression.py \
  2>&1 | tee "$OUT/security-headers-api-regression.log"
API_HEADER_REGRESSION_EXIT="${PIPESTATUS[0]}"
set -e

# The frontend runtime verifier needs a served HTTPS image, which this
# network-none Python suite intentionally does not start. Exercise its CLI and
# imports here, and record that behavioral coverage is out of this run's scope.
set +e
docker run --rm --network none --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e PYTHONDONTWRITEBYTECODE=1 \
  -v "$STAGE/repo:/workspace:ro" \
  --entrypoint python \
  "$TEST_IMAGE" qa/python/security_headers_runtime.py --help \
  >"$OUT/security-headers-runtime-cli.txt" 2>&1
RUNTIME_HEADER_HARNESS_SMOKE_EXIT="$?"
set -e

set +e
docker run --rm --network none --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=512m \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e DB_PASSWORD \
  -e REDIS_PASSWORD \
  -e ADMIN_PASSWORD \
  -e GRAFANA_PASSWORD \
  -e JWT_SECRET_KEY \
  -e DATABASE_URL \
  -e REDIS_URL \
  -v "$STAGE/repo:/workspace:ro" \
  -v "$OUT:/evidence" \
  "$TEST_IMAGE" \
  tests/ qa/python/security_regressions.py qa/python/referral_redirects_regression.py \
  qa/python/legacy_forex_referral_boundary_regression.py \
  qa/python/oneroyal_referral_boundary_regression.py \
  -v -p no:cacheprovider --continue-on-collection-errors \
  --junitxml=/evidence/results.xml \
  2>&1 | tee "$OUT/full.log"
TEST_EXIT="${PIPESTATUS[0]}"
set -e

jq -n \
  --arg runId "$RUN_ID" \
  --arg commit "$COMMIT" \
  --arg sourceFingerprint "$SOURCE_FINGERPRINT" \
  --arg baseImage "$BASE_IMAGE" \
  --arg testImage "$TEST_IMAGE" \
  --argjson exitCode "$TEST_EXIT" \
  --argjson apiHeaderRegressionExitCode "$API_HEADER_REGRESSION_EXIT" \
  --argjson runtimeHeaderHarnessSmokeExitCode "$RUNTIME_HEADER_HARNESS_SMOKE_EXIT" \
  --argjson pipCheckExitCode "$PIP_CHECK_EXIT" \
  '{
    runId: $runId,
    commit: $commit,
    sourceFingerprint: $sourceFingerprint,
    baseImage: $baseImage,
    testImage: $testImage,
    repositorySnapshot: "sanitized worktree copy mounted read-only",
    testNetwork: "none",
    testTargets: ["tests/", "qa/python/security_regressions.py", "qa/python/referral_redirects_regression.py", "qa/python/legacy_forex_referral_boundary_regression.py", "qa/python/oneroyal_referral_boundary_regression.py", "qa/python/security_headers_api_regression.py", "qa/python/security_headers_runtime.py --help"],
    liveServicesOrDataUsed: false,
    pythonDontWriteBytecode: true,
    pytestCacheDisabled: true,
    pytestExitCode: $exitCode,
    apiHeaderRegressionExitCode: $apiHeaderRegressionExitCode,
    runtimeHeaderHarnessSmokeExitCode: $runtimeHeaderHarnessSmokeExitCode,
    runtimeHeaderBehaviorExecuted: false,
    runtimeHeaderBehaviorExclusion: "requires a served HTTPS frontend image; incompatible with this network-none backend suite",
    pipCheckExitCode: $pipCheckExitCode,
    exitCode: (
      if $exitCode != 0 then $exitCode
      elif $apiHeaderRegressionExitCode != 0 then $apiHeaderRegressionExitCode
      elif $runtimeHeaderHarnessSmokeExitCode != 0 then $runtimeHeaderHarnessSmokeExitCode
      else $pipCheckExitCode
      end
    )
  }' >"$OUT/run-metadata.json"

(
  cd "$OUT"
  find . -type f ! -name SHA256SUMS -print0 \
    | sort -z \
    | xargs -0 sha256sum \
    | sed 's#  \./#  #' >SHA256SUMS
  sha256sum --check SHA256SUMS
)

if (( TEST_EXIT != 0 )); then
  exit "$TEST_EXIT"
fi
if (( API_HEADER_REGRESSION_EXIT != 0 )); then
  exit "$API_HEADER_REGRESSION_EXIT"
fi
if (( RUNTIME_HEADER_HARNESS_SMOKE_EXIT != 0 )); then
  exit "$RUNTIME_HEADER_HARNESS_SMOKE_EXIT"
fi
exit "$PIP_CHECK_EXIT"
