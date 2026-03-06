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

// Get stats for a specific period
function getStats(network, service, periodSeconds) {
  const d = getDb();
  const now = Math.floor(Date.now() / 1000);
  const since = now - periodSeconds;

  // Hourly aggregated data
  const hourlyData = d
    .prepare(
      `SELECT SUM(request_count) as total, SUM(error_count) as errors, AVG(avg_response_time) as avg_rt
       FROM hourly_stats WHERE network = ? AND service = ? AND hour_ts >= ?`
    )
    .get(network, service, since);

  // Recent raw data (last hour, not yet aggregated)
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
  const recentSince = Math.max(since, now - 3600);
  const peakMinute = d
    .prepare(
      `SELECT MAX(cnt) as peak FROM (
        SELECT COUNT(*) as cnt FROM request_log
        WHERE network = ? AND service = ? AND timestamp >= ?
        GROUP BY timestamp / 60
      )`
    )
    .get(network, service, recentSince);

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

  return {
    totalRequests,
    totalErrors,
    avgReqPerSec: periodSeconds > 0 ? formatRate(totalRequests / periodSeconds) : 0,
    currentReqPerSec,
    peakReqPerSec,
    uptime: calculateUptime(d, network, service, since, now),
  };
}

// Get chart data points
function getChartData(network, service, periodSeconds, points) {
  const d = getDb();
  const now = Math.floor(Date.now() / 1000);
  // Align to hour boundary so buckets match hourly_stats hour_ts values
  const nowAligned = Math.floor(now / 3600) * 3600 + 3600;
  const bucketSize = Math.floor(periodSeconds / points);
  // Align bucket size to hour multiples for daily view
  const alignedBucketSize = periodSeconds <= 86400
    ? 3600
    : Math.max(3600, Math.floor(bucketSize / 3600) * 3600);
  const since = nowAligned - alignedBucketSize * points;

  const result = [];
  for (let i = 0; i < points; i++) {
    const bucketStart = since + i * alignedBucketSize;
    const bucketEnd = bucketStart + alignedBucketSize;

    const data = d
      .prepare(
        `SELECT COALESCE(SUM(request_count), 0) as total
         FROM hourly_stats WHERE network = ? AND service = ? AND hour_ts >= ? AND hour_ts < ?`
      )
      .get(network, service, bucketStart, bucketEnd);

    // Also include recent raw data if bucket overlaps with the last hour
    let recentTotal = 0;
    if (bucketEnd > now - 3600) {
      const recent = d
        .prepare(
          `SELECT COUNT(*) as cnt FROM request_log WHERE network = ? AND service = ? AND timestamp >= ? AND timestamp < ?`
        )
        .get(network, service, Math.max(bucketStart, now - 3600), Math.min(bucketEnd, now + 1));
      recentTotal = recent?.cnt || 0;
    }

    result.push({
      time: formatBucketTime(bucketStart, periodSeconds),
      totalRequests: (data?.total || 0) + recentTotal,
    });
  }

  return result;
}

function calculateUptime(d, network, service, since, now) {
  const totalHours = Math.max(1, Math.floor((now - since) / 3600));

  // Count hours that have records (both up and down)
  const recorded = d
    .prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN request_count > 0 THEN 1 ELSE 0 END) as up
       FROM hourly_stats
       WHERE network = ? AND service = ? AND hour_ts >= ?`
    )
    .get(network, service, since);

  // Also check if there are any recent raw logs (last hour, not yet aggregated)
  const recentActivity = d
    .prepare(
      `SELECT COUNT(*) as cnt FROM request_log
       WHERE network = ? AND service = ? AND timestamp >= ?`
    )
    .get(network, service, now - 3600);

  const recordedHours = recorded?.total || 0;
  const upHours = (recorded?.up || 0) + (recentActivity?.cnt > 0 ? 1 : 0);

  // If no data at all, show N/A instead of misleading 100%
  if (recordedHours === 0 && (!recentActivity || recentActivity.cnt === 0)) {
    return "N/A";
  }

  // Use recorded hours + current hour as denominator
  const denominator = Math.min(totalHours, recordedHours + 1);
  return ((upHours / denominator) * 100).toFixed(2) + "%";
}

function formatBucketTime(ts, periodSeconds) {
  const date = new Date(ts * 1000);
  if (periodSeconds <= 86400) {
    // Use UTC so bucket labels match hour boundaries regardless of server TZ
    const h = String(date.getUTCHours()).padStart(2, "0");
    const m = String(date.getUTCMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  if (periodSeconds <= 604800) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  if (periodSeconds <= 2592000) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
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
  insertRequest,
  insertRequests,
  aggregateHourly,
  getStats,
  getChartData,
  getTotalRequests,
};
