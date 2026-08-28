const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Point the module at a scratch database before requiring it.
const DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "huginn-metrics-")), "test.db");
process.env.DB_PATH = DB_PATH;

const db = require("../src/db");

const HOUR = 3600;
const now = Math.floor(Date.now() / 1000);
const currentHour = Math.floor(now / HOUR) * HOUR;

// A service that started recording 3 days ago and has been steady since.
const DAYS_OF_DATA = 3;
const firstHour = currentHour - DAYS_OF_DATA * 24 * HOUR;
const REQ_PER_HOUR = 3600; // 1 req/sec

test.before(() => {
  const d = db.getDb();
  const insert = d.prepare(
    `INSERT INTO hourly_stats (network, service, hour_ts, request_count, error_count, avg_response_time, peak_rps)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  d.transaction(() => {
    for (let ts = firstHour; ts < currentHour; ts += HOUR) {
      insert.run("mainnet", "rpc", ts, REQ_PER_HOUR, 0, 0.05, 1);
    }
  })();
});

test.after(() => fs.rmSync(path.dirname(DB_PATH), { recursive: true, force: true }));

test("all-time starts at the first recorded request, not a fixed lookback", () => {
  const stats = db.getStats("mainnet", "rpc", null);
  assert.strictEqual(stats.dataStart, firstHour);
  assert.strictEqual(stats.rangeStart, firstHour);

  const spanDays = (stats.rangeEnd - stats.rangeStart) / 86400;
  assert.ok(spanDays < DAYS_OF_DATA + 0.1, `all-time span ${spanDays}d should not exceed the data age`);
});

test("averages divide by the measured span, not the nominal period", () => {
  // 1 req/sec went in, so every window must report roughly 1 req/sec back.
  for (const period of [86400, 604800, 2592000, null]) {
    const { avgReqPerSec } = db.getStats("mainnet", "rpc", period);
    assert.ok(
      Math.abs(avgReqPerSec - 1) < 0.05,
      `period ${period}: expected ~1 req/s, got ${avgReqPerSec}`
    );
  }
});

test("fixed periods are clamped to the data we have", () => {
  // 30 days requested, 3 days recorded.
  const monthly = db.getStats("mainnet", "rpc", 2592000);
  assert.strictEqual(monthly.rangeStart, firstHour);
});

test("chart buckets never start before the first recorded request", () => {
  for (const [period, points] of [[86400, 24], [604800, 28], [2592000, 30], [null, 48]]) {
    const chart = db.getChartData("mainnet", "rpc", period, points);
    assert.ok(chart.data.length <= points, `${period}: ${chart.data.length} buckets exceeds ${points}`);
    assert.ok(
      chart.data[0].timestamp >= firstHour,
      `${period}: first bucket ${chart.data[0].timestamp} predates data start ${firstHour}`
    );
  }
});

test("the 24h view keeps hourly resolution", () => {
  const chart = db.getChartData("mainnet", "rpc", 86400, 24);
  assert.strictEqual(chart.bucketSeconds, HOUR);
  assert.strictEqual(chart.data.length, 24);
});

test("availability reports 100% only when every hour was clean", () => {
  const { uptime, gapHours } = db.getStats("mainnet", "rpc", null);
  assert.strictEqual(gapHours, 0);
  assert.strictEqual(uptime, "100.00%");
});

test("availability never exceeds 100% once the current hour has traffic", () => {
  db.insertRequests(
    Array.from({ length: 30 }, () => ({
      network: "mainnet",
      service: "rpc",
      timestamp: now - 10,
      status: 200,
      responseTime: 0.05,
    }))
  );

  const { uptime } = db.getStats("mainnet", "rpc", null);
  assert.ok(parseFloat(uptime) <= 100, `uptime ${uptime} exceeds 100%`);
});

test("hours with no traffic and 5xx responses both pull availability down", () => {
  const d = db.getDb();
  // One dead hour and one hour where a third of responses failed.
  d.prepare("UPDATE hourly_stats SET request_count = 0, error_count = 0 WHERE hour_ts = ?").run(
    firstHour + 5 * HOUR
  );
  d.prepare("UPDATE hourly_stats SET error_count = ? WHERE hour_ts = ?").run(
    REQ_PER_HOUR / 3,
    firstHour + 6 * HOUR
  );

  const { uptime, gapHours, observedHours } = db.getStats("mainnet", "rpc", null);
  assert.strictEqual(gapHours, 1);

  // One dead hour plus a third of another, over the observed window.
  const expected = ((observedHours - 1 - 1 / 3) / observedHours) * 100;
  assert.ok(
    Math.abs(parseFloat(uptime) - expected) < 0.05,
    `expected ~${expected.toFixed(2)}%, got ${uptime}`
  );
});

test("a service with no data at all reports N/A rather than 100%", () => {
  const stats = db.getStats("testnet", "validator_api", null);
  assert.strictEqual(stats.uptime, "N/A");
  assert.strictEqual(stats.totalRequests, 0);
  assert.strictEqual(stats.dataStart, null);
  assert.strictEqual(db.getChartData("testnet", "validator_api", null, 48).data.length >= 1, true);
});
