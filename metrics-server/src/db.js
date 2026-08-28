const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "metrics.db");

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS request_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      network TEXT NOT NULL DEFAULT 'mainnet',  -- 'mainnet' or 'testnet'
      service TEXT NOT NULL,        -- 'rpc', 'wss', 'validator_api'
      timestamp INTEGER NOT NULL,   -- unix timestamp
      status INTEGER,
      response_time REAL
    );

    CREATE TABLE IF NOT EXISTS hourly_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      network TEXT NOT NULL DEFAULT 'mainnet',
      service TEXT NOT NULL,
      hour_ts INTEGER NOT NULL,     -- unix timestamp rounded to hour
      request_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      avg_response_time REAL DEFAULT 0,
      peak_rps REAL DEFAULT 0,      -- peak req/sec observed during this hour (per-minute granularity)
      UNIQUE(network, service, hour_ts)
    );

    CREATE INDEX IF NOT EXISTS idx_request_log_ts ON request_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_request_log_service ON request_log(service);
    CREATE INDEX IF NOT EXISTS idx_request_log_network ON request_log(network);
    CREATE INDEX IF NOT EXISTS idx_hourly_stats_service_ts ON hourly_stats(service, hour_ts);
    CREATE INDEX IF NOT EXISTS idx_hourly_stats_network ON hourly_stats(network);
  `);

  // Migration: add peak_rps column if missing (existing DBs)
  try {
    db.exec(`ALTER TABLE hourly_stats ADD COLUMN peak_rps REAL DEFAULT 0`);
    console.log("[DB] Migrated: added peak_rps column to hourly_stats");
  } catch {
    // Column already exists, ignore
  }

  // Back-fill peak_rps from request_count for existing rows that have 0 peak
  // Use request_count/3600 as a lower-bound estimate
  db.exec(`
    UPDATE hourly_stats SET peak_rps = request_count / 3600.0
    WHERE peak_rps = 0 AND request_count > 0
  `);
}

// Insert a single request record
function insertRequest(network, service, timestamp, status, responseTime) {
  const stmt = getDb().prepare(
    "INSERT INTO request_log (network, service, timestamp, status, response_time) VALUES (?, ?, ?, ?, ?)"
  );
  stmt.run(network, service, timestamp, status, responseTime);
}

// Batch insert requests (for log parsing)
function insertRequests(requests) {
  const stmt = getDb().prepare(
    "INSERT INTO request_log (network, service, timestamp, status, response_time) VALUES (?, ?, ?, ?, ?)"
  );
  const insertMany = getDb().transaction((rows) => {
    for (const row of rows) {
      stmt.run(row.network, row.service, row.timestamp, row.status, row.responseTime);
    }
  });
  insertMany(requests);
}

// Aggregate raw logs into hourly stats and clean old raw logs
function aggregateHourly() {
  const d = getDb();
  const now = Math.floor(Date.now() / 1000);
  const oneHourAgo = now - 3600;

  // Run entire aggregation in a transaction to prevent data loss on crash
  const runAggregation = d.transaction(() => {
    // Step 1: Calculate per-minute peak for each network/service/hour being aggregated
    const peakRows = d.prepare(`
      SELECT network, service, (timestamp / 3600) * 3600 AS hour_ts,
             MAX(cnt) as peak_count
      FROM (
        SELECT network, service, timestamp,
               COUNT(*) as cnt
        FROM request_log
        WHERE timestamp < ?
        GROUP BY network, service, timestamp / 60
      )
      GROUP BY network, service, hour_ts
    `).all(oneHourAgo);

    // Build peak lookup map
    const peakMap = new Map();
    for (const row of peakRows) {
      peakMap.set(`${row.network}|${row.service}|${row.hour_ts}`, row.peak_count / 60);
    }

    // Step 2: Aggregate completed hours into hourly_stats
    d.prepare(`
      INSERT INTO hourly_stats (network, service, hour_ts, request_count, error_count, avg_response_time, peak_rps)
      SELECT
        network,
        service,
        (timestamp / 3600) * 3600 AS hour_ts,
        COUNT(*) AS request_count,
        SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS error_count,
        AVG(response_time) AS avg_response_time,
        0 AS peak_rps
      FROM request_log
      WHERE timestamp < ?
      GROUP BY network, service, hour_ts
      ON CONFLICT(network, service, hour_ts) DO UPDATE SET
        request_count = hourly_stats.request_count + excluded.request_count,
        error_count = hourly_stats.error_count + excluded.error_count,
        avg_response_time = (hourly_stats.avg_response_time * hourly_stats.request_count + excluded.avg_response_time * excluded.request_count)
          / (hourly_stats.request_count + excluded.request_count)
    `).run(oneHourAgo);

    // Step 3: Update peak_rps (keep the higher value between existing and new)
    const updatePeak = d.prepare(`
      UPDATE hourly_stats SET peak_rps = MAX(COALESCE(peak_rps, 0), ?)
      WHERE network = ? AND service = ? AND hour_ts = ?
    `);
    for (const row of peakRows) {
      const peakRps = row.peak_count / 60;
      updatePeak.run(peakRps, row.network, row.service, row.hour_ts);
    }

    // Step 4: Delete aggregated raw logs (keep last hour for current stats)
    d.prepare("DELETE FROM request_log WHERE timestamp < ?").run(oneHourAgo);
  });

  runAggregation();
}

// Smallest window we are willing to report on, so a brand-new deployment does
// not divide by zero seconds.
const MIN_WINDOW = 3600;

// Earliest moment we hold any data for. Returns null when nothing was recorded
// yet. Aggregated hours and not-yet-aggregated raw rows are disjoint sets, so
// both have to be consulted.
function getDataStart(network, service) {
  const d = getDb();
  const hourly = d
    .prepare(
      "SELECT MIN(hour_ts) as ts FROM hourly_stats WHERE network = ? AND service = ? AND request_count > 0"
    )
    .get(network, service);
  const raw = d
    .prepare("SELECT MIN(timestamp) as ts FROM request_log WHERE network = ? AND service = ?")
    .get(network, service);

  const candidates = [hourly?.ts, raw?.ts].filter((ts) => typeof ts === "number" && ts > 0);
  return candidates.length ? Math.min(...candidates) : null;
}

// Resolve the window a query should actually cover.
//
// `periodSeconds` of null/0 means "all time", which spans from the first
// recorded request to now instead of some arbitrary fixed lookback. Fixed
// periods are clamped the same way: we never report on time before metrics
// collection started, so a 30d view on a 5-day-old service covers 5 days
// rather than padding the chart with 25 empty days.
function resolveWindow(network, service, periodSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const dataStart = getDataStart(network, service);
  // End of the hour in progress. Anchoring here keeps fixed periods a whole
  // number of hours wide, which is what hourly_stats buckets on.
  const endAligned = Math.floor(now / 3600) * 3600 + 3600;

  let start;
  if (periodSeconds > 0) {
    start = endAligned - periodSeconds;
    if (dataStart !== null) start = Math.max(start, dataStart);
  } else {
    start = dataStart !== null ? dataStart : now - MIN_WINDOW;
  }

  // Align to the hour so the first partial hour of data is not dropped by the
  // hourly_stats lookups, which key on hour boundaries.
  const since = Math.floor(start / 3600) * 3600;
  const spanSeconds = Math.max(MIN_WINDOW, now - since);

  return { now, endAligned, since, spanSeconds, dataStart };
}

// Get stats for a specific period. Pass a falsy periodSeconds for all-time.
function getStats(network, service, periodSeconds) {
  const d = getDb();
  const { now, since, spanSeconds, dataStart } = resolveWindow(network, service, periodSeconds);

  // Hourly aggregated data
  const hourlyData = d
    .prepare(
      `SELECT SUM(request_count) as total, SUM(error_count) as errors, AVG(avg_response_time) as avg_rt
       FROM hourly_stats WHERE network = ? AND service = ? AND hour_ts >= ?`
    )
    .get(network, service, since);

  // Recent raw data (not yet aggregated; disjoint from hourly_stats)
  const recentData = d
    .prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) as errors, AVG(response_time) as avg_rt
       FROM request_log WHERE network = ? AND service = ? AND timestamp >= ?`
    )
    .get(network, service, since);

  const totalRequests =
    (hourlyData?.total || 0) + (recentData?.total || 0);
  const totalErrors =
    (hourlyData?.errors || 0) + (recentData?.errors || 0);

  // Current req/sec (last 60 seconds)
  const lastMinute = d
    .prepare(
      "SELECT COUNT(*) as cnt FROM request_log WHERE network = ? AND service = ? AND timestamp >= ?"
    )
    .get(network, service, now - 60);

  // Peak req/sec from hourly data - use stored peak_rps (per-minute granularity)
  const peakHour = d
    .prepare(
      `SELECT MAX(peak_rps) as peak FROM hourly_stats WHERE network = ? AND service = ? AND hour_ts >= ?`
    )
    .get(network, service, since);

  // Peak req/sec from recent raw data (per-minute granularity, covers data not yet aggregated)
  const peakMinute = d
    .prepare(
      `SELECT MAX(cnt) as peak FROM (
        SELECT COUNT(*) as cnt FROM request_log
        WHERE network = ? AND service = ? AND timestamp >= ?
        GROUP BY timestamp / 60
      )`
    )
    .get(network, service, since);

  // Use enough decimal places so low-traffic values don't round to 0
  const formatRate = (val) => {
    if (val === 0) return 0;
    if (val < 0.01) return parseFloat(val.toFixed(4));
    return parseFloat(val.toFixed(2));
  };

  const currentReqPerSec = formatRate((lastMinute?.cnt || 0) / 60);
  const hourlyPeak = peakHour?.peak || 0; // Already in req/sec from stored peak_rps
  const minutePeak = peakMinute?.peak ? peakMinute.peak / 60 : 0;
  // Peak is the max of: hourly historical peak, per-minute recent peak, and current rate
  const peakReqPerSec = formatRate(Math.max(hourlyPeak, minutePeak, currentReqPerSec));

  const availability = calculateAvailability(d, network, service, since, now);

  return {
    totalRequests,
    totalErrors,
    // Share of responses that were 5xx, as a percentage.
    errorRate: totalRequests > 0 ? parseFloat(((totalErrors / totalRequests) * 100).toFixed(3)) : 0,
    // Averaged over the window we actually have data for, not over the
    // nominal period length.
    avgReqPerSec: formatRate(totalRequests / spanSeconds),
    currentReqPerSec,
    peakReqPerSec,
    uptime: availability.uptime,
    // Why the availability number is what it is.
    observedHours: availability.observedHours,
    activeHours: availability.activeHours,
    gapHours: availability.gapHours,
    // Window the numbers above describe, so the dashboard can label it.
    rangeStart: since,
    rangeEnd: now,
    dataStart,
  };
}

// Get chart data points. Buckets start at the first hour we hold data for and
// run to now, so no leading run of empty buckets is ever rendered.
function getChartData(network, service, periodSeconds, points) {
  const d = getDb();
  const { now, endAligned, since, dataStart } = resolveWindow(network, service, periodSeconds);

  const startAligned = since;
  const spanSeconds = Math.max(3600, endAligned - startAligned);
  const spanHours = Math.ceil(spanSeconds / 3600);

  // Whole hours per bucket, sized so we never emit more than `points` buckets.
  const bucketHours = Math.max(1, Math.ceil(spanHours / points));
  const bucketSeconds = bucketHours * 3600;
  const bucketCount = Math.max(1, Math.ceil(spanHours / bucketHours));

  const hourlyStmt = d.prepare(
    `SELECT COALESCE(SUM(request_count), 0) as total
     FROM hourly_stats WHERE network = ? AND service = ? AND hour_ts >= ? AND hour_ts < ?`
  );
  const rawStmt = d.prepare(
    `SELECT COUNT(*) as cnt FROM request_log
     WHERE network = ? AND service = ? AND timestamp >= ? AND timestamp < ?`
  );

  const data = [];
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = startAligned + i * bucketSeconds;
    const bucketEnd = bucketStart + bucketSeconds;

    const hourly = hourlyStmt.get(network, service, bucketStart, bucketEnd);
    // hourly_stats and request_log never hold the same request, so these add up.
    const raw = rawStmt.get(network, service, bucketStart, bucketEnd);

    data.push({
      time: formatBucketTime(bucketStart, bucketSeconds, spanSeconds),
      timestamp: bucketStart,
      totalRequests: (hourly?.total || 0) + (raw?.cnt || 0),
    });
  }

  return {
    data,
    rangeStart: startAligned,
    rangeEnd: now,
    bucketSeconds,
    dataStart,
  };
}

/**
 * Availability for the window: the share of requests we answered without a
 * 5xx.
 *
 * An earlier version scored each elapsed hour and counted an hour with no
 * requests at all as a zero, on the theory that a live endpoint should always
 * be receiving traffic. That is not true of a testnet endpoint, and it is not
 * something an access log can tell us: a quiet hour and a dead hour look
 * identical from here, because both produce no lines. Counting them as
 * downtime charged real outage against hours where nobody asked us anything -
 * on the Huginn testnet RPC it read 96.08% against a 0.061% error rate.
 *
 * So the percentage now only claims what the log can actually support, and
 * the hours we had no visibility into are reported separately rather than
 * folded in. The honest limitation: if nginx itself is down nothing is
 * logged, so that outage lands in `gapHours` and does not move the
 * percentage. That is why callers should show both.
 */
function calculateAvailability(d, network, service, since, now) {
  // `since` is hour-aligned, so this is an exact count of hour slots that have
  // fully elapsed. The hour in progress is excluded: a service that has not
  // been hit in the last few minutes is not dark.
  const currentHourStart = Math.floor(now / 3600) * 3600;
  const elapsedHours = Math.max(0, (currentHourStart - since) / 3600);

  // Merge both stores per hour. hourly_stats holds aggregated hours,
  // request_log the ones not yet aggregated, and an hour part-way through
  // aggregation lives in both - grouping by hour adds those halves up instead
  // of counting the hour twice.
  const hours = d
    .prepare(
      `SELECT h, SUM(rc) AS request_count, SUM(ec) AS error_count FROM (
         SELECT hour_ts AS h, request_count AS rc, error_count AS ec
         FROM hourly_stats
         WHERE network = ? AND service = ? AND hour_ts >= ?
         UNION ALL
         SELECT (timestamp / 3600) * 3600 AS h, 1 AS rc,
                CASE WHEN status >= 500 THEN 1 ELSE 0 END AS ec
         FROM request_log
         WHERE network = ? AND service = ? AND timestamp >= ?
       )
       GROUP BY h`
    )
    .all(network, service, since, network, service, since);

  let activeHours = 0;
  let activeCompletedHours = 0;
  let requests = 0;
  let errors = 0;
  for (const hour of hours) {
    if (!hour.request_count) continue;
    activeHours++;
    requests += hour.request_count;
    errors += hour.error_count || 0;
    if (hour.h < currentHourStart) activeCompletedHours++;
  }

  // Nothing recorded at all - say so rather than claiming a misleading 100%.
  if (activeHours === 0) {
    return { uptime: "N/A", observedHours: 0, activeHours: 0, gapHours: elapsedHours };
  }

  // Elapsed hours we have no reading for. Not counted as downtime, but
  // surfaced so the gap in coverage stays visible.
  const gapHours = Math.max(0, elapsedHours - activeCompletedHours);

  return {
    uptime: (((requests - errors) / requests) * 100).toFixed(2) + "%",
    observedHours: activeHours,
    activeHours,
    gapHours,
  };
}

// Label a bucket by how wide it is, not by the period it came from: an
// all-time view can hold hour-wide buckets on day one and week-wide ones later.
function formatBucketTime(ts, bucketSeconds, spanSeconds) {
  const date = new Date(ts * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  const day = () =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  if (bucketSeconds < 86400) {
    // Use UTC so bucket labels match hour boundaries regardless of server TZ
    const hm = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
    return spanSeconds <= 172800 ? hm : `${day()} ${hm}`;
  }
  if (bucketSeconds < 2419200) {
    return day();
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

// Get total request count for a service (all time)
function getTotalRequests(network, service) {
  const d = getDb();
  const hourly = d
    .prepare("SELECT COALESCE(SUM(request_count), 0) as total FROM hourly_stats WHERE network = ? AND service = ?")
    .get(network, service);
  const recent = d
    .prepare("SELECT COUNT(*) as total FROM request_log WHERE network = ? AND service = ?")
    .get(network, service);
  return (hourly?.total || 0) + (recent?.total || 0);
}

module.exports = {
  getDb,
  getDataStart,
  resolveWindow,
  insertRequest,
  insertRequests,
  aggregateHourly,
  getStats,
  getChartData,
  getTotalRequests,
};
