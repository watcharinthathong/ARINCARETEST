// ============================================================
//  k6 Load Test — Product Transactions History Report API
//
//  ติดตั้ง k6:  brew install k6   (macOS)
//               https://k6.io/docs/get-started/installation/
//
//  รัน:
//    export ARIN_TOKEN='eyJ0eXAi...'
//    k6 run scripts/perf/k6_load.js                       # โปรไฟล์ default (load)
//    PROFILE=smoke  k6 run scripts/perf/k6_load.js        # 1 VU สั้นๆ เช็คว่าใช้ได้
//    PROFILE=stress k6 run scripts/perf/k6_load.js        # ไต่จนพัง
//    PROFILE=spike  k6 run scripts/perf/k6_load.js        # กระชากทันที
//    PROFILE=soak   k6 run scripts/perf/k6_load.js        # ยิงยาว หา memory leak
//
//    k6 run --out json=raw.json scripts/perf/k6_load.js   # เก็บผลดิบ
// ============================================================

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ---------- CONFIG ----------
const HOST     = __ENV.ARIN_HOST || 'https://api-stg.arincare.com';
const TOKEN    = __ENV.ARIN_TOKEN;
const COMPANY  = __ENV.COMPANY || '4';
const BRANCH   = __ENV.BRANCH  || '4';
const PRODUCT  = __ENV.PRODUCT || '13';
const FROM     = __ENV.FROM_DATE || '2024-01-01';
const TO       = __ENV.TO_DATE   || '2026-09-10';
const PROFILE  = __ENV.PROFILE   || 'load';

if (!TOKEN) {
  throw new Error('ยังไม่ได้ตั้ง ARIN_TOKEN — export ARIN_TOKEN="eyJ..." ก่อนรัน');
}

// ---------- PROFILES ----------
// ปรับตัวเลขตามกำลังของ staging — อย่าเริ่มยิงหนักแบบไม่แจ้งทีม
const profiles = {
  smoke: {
    executor: 'constant-vus', vus: 1, duration: '30s',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: '30s', target: 5 },   // เริ่มขึ้น
      { duration: '2m',  target: 5 },   // คงที่ — ดูพื้นฐานที่โหลดอ้อมๆ
      { duration: '30s', target: 10 },
      { duration: '2m',  target: 10 },
      { duration: '30s', target: 0 },   // ไต่ลง
    ],
    gracefulRampDown: '30s',
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: '1m', target: 10 },
      { duration: '1m', target: 25 },
      { duration: '1m', target: 50 },
      { duration: '1m', target: 100 },  // หา breaking point
      { duration: '1m', target: 0 },
    ],
    gracefulRampDown: '30s',
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: '10s', target: 1 },
      { duration: '10s', target: 60 },  // กระชาก
      { duration: '1m',  target: 60 },
      { duration: '10s', target: 1 },
      { duration: '1m',  target: 1 },   // ดูว่าฟื้นตัวไหม
    ],
    gracefulRampDown: '20s',
  },
  soak: {
    executor: 'constant-vus', vus: 5, duration: '30m',
  },
};

// ---------- CUSTOM METRICS ----------
const ttfb        = new Trend('report_ttfb', true);
const payloadSize = new Trend('report_payload_bytes');
const failRate    = new Rate('report_failed');
const rowCount    = new Counter('report_rows_total');

export const options = {
  scenarios: { main: profiles[PROFILE] },
  thresholds: {
    // ปรับ threshold ให้ตรงกับ SLA จริงของทีม — ค่าด้านล่างเป็นค่าตั้งต้นเท่านั้น
    'http_req_duration': ['p(95)<3000', 'p(99)<5000'],
    'report_ttfb':       ['p(95)<2800'],
    'report_failed':     ['rate<0.01'],
    'http_req_failed':   ['rate<0.01'],
  },
  // staging มักใช้ cert ปกติอยู่แล้ว ถ้าเจอ self-signed ให้เปิดบรรทัดล่าง
  // insecureSkipTLSVerify: true,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ---------- URL BUILDER ----------
function buildUrl(from, to, includes) {
  const base = `${HOST}/v2/reports/inventories/product-transactions-history` +
               `/companies/${COMPANY}/branches/${BRANCH}/products/${PRODUCT}`;
  const qs = [
    `companies=${COMPANY}`,
    `branches=${BRANCH}`,
    `products=${PRODUCT}`,
    ...includes.map((i) => `include%5B%5D=${i}`),
    `from_date=${from}`,
    `to_date=${to}`,
  ].join('&');
  return `${base}?${qs}`;
}

const params = {
  headers: {
    'accept': '*/*',
    'authorization': `Bearer ${TOKEN}`,
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'origin': 'https://app-stg.arincare.com',
    'referer': 'https://app-stg.arincare.com/',
    'user-agent': 'k6-perf-test/1.0',
  },
  timeout: '120s',
  tags: { endpoint: 'product-transactions-history' },
};

export default function () {
  const url = buildUrl(FROM, TO, ['sr', 'gr', 'sa', 'it']);
  const res = http.get(url, params);

  ttfb.add(res.timings.waiting);
  payloadSize.add(res.body ? res.body.length : 0);

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'มี body': (r) => !!r.body && r.body.length > 0,
    'เป็น JSON': (r) => (r.headers['Content-Type'] || '').includes('json'),
    'ไม่ timeout': (r) => r.status !== 0,
  });

  failRate.add(!ok);

  // นับจำนวนแถวแบบคร่าวๆ จาก parse ไว — ช่วยดูว่า latency โตตามจำนวนข้อมูลไหม
  if (res.status === 200) {
    try {
      const body = res.json();
      const rows = Array.isArray(body) ? body.length
                 : Array.isArray(body.data) ? body.data.length
                 : null;
      if (rows !== null) rowCount.add(rows);
    } catch (_) { /* ไม่ใช่ JSON ก็ข้ามไป */ }
  }

  if (res.status !== 200) {
    console.error(`FAIL status=${res.status} dur=${res.timings.duration}ms body=${String(res.body).slice(0, 200)}`);
  }
}

export function handleSummary(data) {
  const m = data.metrics;
  const g = (name, stat) => (m[name] && m[name].values[stat] != null
    ? m[name].values[stat].toFixed(0) : 'n/a');

  const lines = [
    '',
    `โปรไฟล์: ${PROFILE}   ช่วงวันที่: ${FROM} → ${TO}`,
    `total requests : ${g('http_reqs', 'count')}`,
    `throughput     : ${m.http_reqs ? m.http_reqs.values.rate.toFixed(2) : 'n/a'} req/s`,
    `duration       : avg=${g('http_req_duration','avg')}ms  p50=${g('http_req_duration','med')}ms  ` +
    `p95=${g('http_req_duration','p(95)')}ms  p99=${g('http_req_duration','p(99)')}ms  max=${g('http_req_duration','max')}ms`,
    `ttfb (waiting) : avg=${g('report_ttfb','avg')}ms  p95=${g('report_ttfb','p(95)')}ms`,
    `payload        : avg=${(Number(g('report_payload_bytes','avg')) / 1024).toFixed(1)} KB`,
    `error rate     : ${m.report_failed ? (m.report_failed.values.rate * 100).toFixed(2) : 'n/a'}%`,
    '',
  ].join('\n');

  return {
    stdout: lines,
    'perf-results/k6-summary.json': JSON.stringify(data, null, 2),
  };
}
