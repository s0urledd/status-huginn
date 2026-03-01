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
      service TEXT NOT NULL,        -- 'rpc', 'wss', 'validator_api'
      timestamp INTEGER NOT NULL,   -- unix timestamp
      status INTEGER,
      response_time REAL
    );

    CREATE TABLE IF NOT EXISTS hourly_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service TEXT NOT NULL,
      hour_ts INTEGER NOT NULL,     -- unix timestamp rounded to hour
      request_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      avg_response_time REAL DEFAULT 0,
      UNIQUE(service, hour_ts)
    );

    CREATE INDEX IF NOT EXISTS idx_request_log_ts ON request_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_request_log_service ON request_log(service);
    CREATE INDEX IF NOT EXISTS idx_hourly_stats_service_ts ON hourly_stats(service, hour_ts);
  `);
}

// Insert a single request record
function insertRequest(service, timestamp, status, responseTime) {
  const stmt = getDb().prepare(
    "INSERT INTO request_log (service, timestamp, status, response_time) VALUES (?, ?, ?, ?)"
  );
  stmt.run(service, timestamp, status, responseTime);
}

// Batch insert requests (for log parsing)
function insertRequests(requests) {
  const stmt = getDb().prepare(
    "INSERT INTO request_log (service, timestamp, status, response_time) VALUES (?, ?, ?, ?)"
  );
  const insertMany = getDb().transaction((rows) => {
    for (const row of rows) {
      stmt.run(row.service, row.timestamp, row.status, row.responseTime);
    }
  });
  insertMany(requests);
}

// Aggregate raw logs into hourly stats and clean old raw logs
function aggregateHourly() {
  const d = getDb();
  const now = Math.floor(Date.now() / 1000);
  const oneHourAgo = now - 3600;

  // Aggregate completed hours - ADD to existing counts, don't replace
  d.exec(`
    INSERT INTO hourly_stats (service, hour_ts, request_count, error_count, avg_response_time)
    SELECT
      service,
      (timestamp / 3600) * 3600 AS hour_ts,
      COUNT(*) AS request_count,
      SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS error_count,
      AVG(response_time) AS avg_response_time
    FROM request_log
    WHERE timestamp < ${oneHourAgo}
    GROUP BY service, hour_ts
    ON CONFLICT(service, hour_ts) DO UPDATE SET
      request_count = hourly_stats.request_count + excluded.request_count,
      error_count = hourly_stats.error_count + excluded.error_count,
      avg_response_time = (hourly_stats.avg_response_time * hourly_stats.request_count + excluded.avg_response_time * excluded.request_count)
        / (hourly_stats.request_count + excluded.request_count);
  `);

  // Delete aggregated raw logs (keep last hour for current stats)
  d.prepare("DELETE FROM request_log WHERE timestamp < ?").run(oneHourAgo);
}

// Get stats for a specific period
function getStats(service, periodSeconds) {
  const d = getDb();
  const now = Math.floor(Date.now() / 1000);
  const since = now - periodSeconds;

  // Hourly aggregated data
  const hourlyData = d
    .prepare(
      `SELECT SUM(request_count) as total, SUM(error_count) as errors, AVG(avg_response_time) as avg_rt
       FROM hourly_stats WHERE service = ? AND hour_ts >= ?`
    )
    .get(service, since);

  // Recent raw data (last hour, not yet aggregated)
  const recentData = d
    .prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) as errors, AVG(response_time) as avg_rt
       FROM request_log WHERE service = ? AND timestamp >= ?`
    )
    .get(service, since);

  const totalRequests =
    (hourlyData?.total || 0) + (recentData?.total || 0);
  const totalErrors =
    (hourlyData?.errors || 0) + (recentData?.errors || 0);

  // Current req/sec (last 60 seconds)
  const lastMinute = d
    .prepare(
      "SELECT COUNT(*) as cnt FROM request_log WHERE service = ? AND timestamp >= ?"
    )
    .get(service, now - 60);

  // Peak req/sec from hourly data
  const peakHour = d
    .prepare(
      `SELECT MAX(request_count) as peak FROM hourly_stats WHERE service = ? AND hour_ts >= ?`
    )
    .get(service, since);

  // Use enough decimal places so low-traffic values don't round to 0
  const formatRate = (val) => {
    if (val === 0) return 0;
    if (val < 0.01) return parseFloat(val.toFixed(4));
    return parseFloat(val.toFixed(2));
  };

  return {
    totalRequests,
    totalErrors,
    avgReqPerSec: periodSeconds > 0 ? formatRate(totalRequests / periodSeconds) : 0,
    currentReqPerSec: formatRate((lastMinute?.cnt || 0) / 60),
    peakReqPerSec: peakHour?.peak ? formatRate(peakHour.peak / 3600) : 0,
    uptime: calculateUptime(d, service, since, now),
  };
}

// Get chart data points
function getChartData(service, periodSeconds, points) {
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
         FROM hourly_stats WHERE service = ? AND hour_ts >= ? AND hour_ts < ?`
      )
      .get(service, bucketStart, bucketEnd);

    // Also include recent raw data if bucket overlaps with the last hour
    let recentTotal = 0;
    if (bucketEnd > now - 3600) {
      const recent = d
        .prepare(
          `SELECT COUNT(*) as cnt FROM request_log WHERE service = ? AND timestamp >= ? AND timestamp < ?`
        )
        .get(service, Math.max(bucketStart, now - 3600), Math.min(bucketEnd, now + 1));
      recentTotal = recent?.cnt || 0;
    }

    result.push({
      time: formatBucketTime(bucketStart, periodSeconds),
      totalRequests: (data?.total || 0) + recentTotal,
    });
  }

  return result;
}

function calculateUptime(d, service, since, now) {
  const totalHours = Math.max(1, Math.floor((now - since) / 3600));
  const downHours = d
    .prepare(
      `SELECT COUNT(*) as cnt FROM hourly_stats
       WHERE service = ? AND hour_ts >= ? AND request_count = 0`
    )
    .get(service, since);
  const up = totalHours - (downHours?.cnt || 0);
  return ((up / totalHours) * 100).toFixed(2) + "%";
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
function getTotalRequests(service) {
  const d = getDb();
  const hourly = d
    .prepare("SELECT COALESCE(SUM(request_count), 0) as total FROM hourly_stats WHERE service = ?")
    .get(service);
  const recent = d
    .prepare("SELECT COUNT(*) as total FROM request_log WHERE service = ?")
    .get(service);
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
