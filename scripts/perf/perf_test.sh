#!/usr/bin/env bash
# ============================================================
#  Performance Test — Product Transactions History Report API
#  แค่ curl ล้วน ไม่ต้องติดตั้งอะไรเพิ่ม
#
#  วิธีใช้:
#    export ARIN_TOKEN='eyJ0eXAi...'      # เอาค่ามาจาก env ไม่ hardcode
#    chmod +x scripts/perf/perf_test.sh
#    ./scripts/perf/perf_test.sh                        # รันครบทุก scenario
#    ./scripts/perf/perf_test.sh baseline               # เฉพาะ baseline
#    ./scripts/perf/perf_test.sh daterange              # เฉพาะ date-range scaling
#    ./scripts/perf/perf_test.sh includes               # เฉพาะ include[] scaling
#    ./scripts/perf/perf_test.sh concurrency            # เฉพาะ concurrent load
#
#  ปรับแต่งผ่าน env: RUNS=20 CONC=10 TOTAL=50 ./scripts/perf/perf_test.sh
# ============================================================

set -uo pipefail

# ---------- CONFIG ----------
HOST="${ARIN_HOST:-https://api-stg.arincare.com}"
TOKEN="${ARIN_TOKEN:-}"
COMPANY="${COMPANY:-4}"
BRANCH="${BRANCH:-4}"
PRODUCT="${PRODUCT:-13}"

RUNS="${RUNS:-10}"        # จำนวนครั้งต่อ 1 scenario (sequential)
CONC="${CONC:-5}"         # จำนวน concurrent worker
TOTAL="${TOTAL:-25}"      # จำนวน request รวมเพื่อทดสอบ concurrency
WARMUP="${WARMUP:-1}"     # จำนวน warm-up request (ไม่นับผล)
TIMEOUT="${TIMEOUT:-120}" # curl max-time (วินาที)

FULL_FROM="${FULL_FROM:-2024-01-01}"
FULL_TO="${FULL_TO:-2026-09-10}"

OUTDIR="${OUTDIR:-./perf-results}"
STAMP="$(date +%Y%m%d-%H%M%S)"
CSV="$OUTDIR/results-$STAMP.csv"

# ---------- GUARDS ----------
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: ยังไม่ได้ตั้ง ARIN_TOKEN"
  echo "  export ARIN_TOKEN='eyJ0eXAi...'"
  exit 1
fi

mkdir -p "$OUTDIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "scenario,run,http_code,dns,connect,tls,ttfb,total,size_bytes" > "$CSV"

# ---------- HELPERS ----------

build_url() {
  # build_url <from> <to> <include...>
  local from="$1" to="$2"; shift 2
  local url="$HOST/v2/reports/inventories/product-transactions-history"
  url+="/companies/$COMPANY/branches/$BRANCH/products/$PRODUCT"
  url+="?companies=$COMPANY&branches=$BRANCH&products=$PRODUCT"
  local inc
  for inc in "$@"; do
    url+="&include%5B%5D=$inc"
  done
  url+="&from_date=$from&to_date=$to"
  printf '%s' "$url"
}

do_curl() {
  # do_curl <url>  -> "code dns connect tls ttfb total size"
  curl -sS -o /dev/null \
    --max-time "$TIMEOUT" \
    -w '%{http_code} %{time_namelookup} %{time_connect} %{time_appconnect} %{time_starttransfer} %{time_total} %{size_download}\n' \
    --url "$1" \
    -H 'accept: */*' \
    -H "authorization: Bearer $TOKEN" \
    -H 'cache-control: no-cache' \
    -H 'pragma: no-cache' \
    -H 'origin: https://app-stg.arincare.com' \
    -H 'referer: https://app-stg.arincare.com/' \
    -H 'user-agent: perf-test/1.0' \
    2>/dev/null || echo "000 0 0 0 0 0 0"
}

percentile() {
  # percentile <p> <file-of-numbers>
  sort -n "$2" | awk -v p="$1" '
    { a[NR] = $1 }
    END {
      if (NR == 0) { print "n/a"; exit }
      idx = int((p/100) * NR + 0.9999)
      if (idx < 1) idx = 1
      if (idx > NR) idx = NR
      printf "%.3f", a[idx]
    }'
}

stat_avg() {
  awk '{ s += $1; n++ } END { if (n==0) print "n/a"; else printf "%.3f", s/n }' "$1"
}

human_size() {
  awk -v b="$1" 'BEGIN {
    if (b < 1024) printf "%d B", b
    else if (b < 1048576) printf "%.1f KB", b/1024
    else printf "%.2f MB", b/1048576
  }'
}

run_scenario() {
  # run_scenario <label> <from> <to> <include...>
  local label="$1" from="$2" to="$3"; shift 3
  local url; url="$(build_url "$from" "$to" "$@")"

  local f_ttfb="$TMP/ttfb" f_total="$TMP/total"
  : > "$f_ttfb"; : > "$f_total"

  printf '\n\033[1m▶ %s\033[0m\n' "$label"
  printf '  range=%s → %s | include=[%s]\n' "$from" "$to" "$(IFS=,; echo "$*")"

  local i
  for ((i = 1; i <= WARMUP; i++)); do do_curl "$url" > /dev/null; done

  local codes="" sizes=0 errors=0
  for ((i = 1; i <= RUNS; i++)); do
    read -r code dns conn tls ttfb total size <<< "$(do_curl "$url")"
    echo "$ttfb"  >> "$f_ttfb"
    echo "$total" >> "$f_total"
    echo "$label,$i,$code,$dns,$conn,$tls,$ttfb,$total,$size" >> "$CSV"
    codes+="$code "
    sizes=$size
    [[ "$code" != "200" ]] && ((errors++))
    printf '  #%-3d %s  ttfb=%ss  total=%ss  size=%s\n' \
      "$i" "$code" "$ttfb" "$total" "$(human_size "$size")"
  done

  printf '  \033[36m── สรุป ──\033[0m\n'
  printf '  avg=%ss  p50=%ss  p90=%ss  p95=%ss  p99=%ss  max=%ss\n' \
    "$(stat_avg "$f_total")" \
    "$(percentile 50 "$f_total")" \
    "$(percentile 90 "$f_total")" \
    "$(percentile 95 "$f_total")" \
    "$(percentile 99 "$f_total")" \
    "$(percentile 100 "$f_total")"
  printf '  ttfb: avg=%ss  p95=%ss   |  payload=%s  |  error=%d/%d\n' \
    "$(stat_avg "$f_ttfb")" "$(percentile 95 "$f_ttfb")" \
    "$(human_size "$sizes")" "$errors" "$RUNS"
}

run_concurrency() {
  local label="conc-${CONC}vu"
  local url; url="$(build_url "$FULL_FROM" "$FULL_TO" sr gr sa it)"

  printf '\n\033[1m▶ Concurrency: %d workers × %d requests\033[0m\n' "$CONC" "$TOTAL"

  export -f do_curl
  export TOKEN TIMEOUT

  local f_total="$TMP/conc_total"
  local start end wall
  start=$(date +%s.%N)

  seq 1 "$TOTAL" | xargs -P "$CONC" -I{} bash -c 'do_curl "$0"' "$url" > "$TMP/conc_raw"

  end=$(date +%s.%N)
  wall=$(awk -v s="$start" -v e="$end" 'BEGIN { printf "%.2f", e - s }')

  awk '{ print $6 }' "$TMP/conc_raw" > "$f_total"
  local ok bad
  ok=$(awk '$1 == 200' "$TMP/conc_raw" | wc -l | tr -d ' ')
  bad=$((TOTAL - ok))

  printf '  wall=%ss  throughput=%s req/s\n' \
    "$wall" "$(awk -v t="$TOTAL" -v w="$wall" 'BEGIN { printf "%.2f", t/w }')"
  printf '  avg=%ss  p50=%ss  p95=%ss  p99=%ss  max=%ss\n' \
    "$(stat_avg "$f_total")" \
    "$(percentile 50 "$f_total")" \
    "$(percentile 95 "$f_total")" \
    "$(percentile 99 "$f_total")" \
    "$(percentile 100 "$f_total")"
  printf '  success=%d  failed=%d\n' "$ok" "$bad"

  local i=0
  while read -r code _ _ _ ttfb total size; do
    i=$((i+1))
    echo "$label,$i,$code,,,,$ttfb,$total,$size" >> "$CSV"
  done < "$TMP/conc_raw"
}

# ---------- SCENARIOS ----------

sc_baseline() {
  run_scenario "baseline-full" "$FULL_FROM" "$FULL_TO" sr gr sa it
}

sc_daterange() {
  printf '\n\033[1;33m=== Date-range scaling (include ครบ 4 ตัว) ===\033[0m\n'
  run_scenario "range-7d"   "2026-09-03" "$FULL_TO" sr gr sa it
  run_scenario "range-1m"   "2026-08-10" "$FULL_TO" sr gr sa it
  run_scenario "range-3m"   "2026-06-10" "$FULL_TO" sr gr sa it
  run_scenario "range-1y"   "2025-09-10" "$FULL_TO" sr gr sa it
  run_scenario "range-full" "$FULL_FROM" "$FULL_TO" sr gr sa it
}

sc_includes() {
  printf '\n\033[1;33m=== include[] scaling (ทีละตัวเทียบ) ===\033[0m\n'
  run_scenario "inc-sr"      "$FULL_FROM" "$FULL_TO" sr
  run_scenario "inc-gr"      "$FULL_FROM" "$FULL_TO" gr
  run_scenario "inc-sa"      "$FULL_FROM" "$FULL_TO" sa
  run_scenario "inc-it"      "$FULL_FROM" "$FULL_TO" it
  run_scenario "inc-sr+gr"   "$FULL_FROM" "$FULL_TO" sr gr
  run_scenario "inc-all4"    "$FULL_FROM" "$FULL_TO" sr gr sa it
}

# ---------- MAIN ----------
MODE="${1:-all}"
printf '\033[1mTarget:\033[0m %s\n' "$HOST"
printf '\033[1mRuns/scenario:\033[0m %s | \033[1mWarm-up:\033[0m %s\n' "$RUNS" "$WARMUP"

case "$MODE" in
  baseline)    sc_baseline ;;
  daterange)   sc_daterange ;;
  includes)    sc_includes ;;
  concurrency) run_concurrency ;;
  all)
    sc_baseline
    sc_daterange
    sc_includes
    run_concurrency
    ;;
  *) echo "Unknown mode: $MODE (ใช้: baseline|daterange|includes|concurrency|all)"; exit 1 ;;
esac

printf '\n\033[32m✔ เสร็จแล้ว → ผลอยู่ที่ %s\033[0m\n' "$CSV"
