const express = require("express");
const cors = require("cors");
const { getStats, getChartData, aggregateHourly, getTotalRequests } = require("./db");
const { LogWatcher, importLogFile } = require("./log-watcher");

const PORT = parseInt(process.env.PORT || "3100", 10);
const LOG_PATH = process.env.NGINX_LOG_PATH || "/var/log/nginx/access.log";
const API_KEY = process.env.API_KEY || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",");

const app = express();

// CORS - only allow dashboard domains
app.use(
  cors({
    origin: ALLOWED_ORIGINS[0] === "*" ? "*" : ALLOWED_ORIGINS,
    methods: ["GET"],
  })
);

// Simple API key auth (optional)
if (API_KEY) {
  app.use((req, res, next) => {
    const key = req.headers["x-api-key"] || req.query.key;
    if (key !== API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  });
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Period to seconds mapping
const PERIOD_MAP = {
  daily: 86400,        // 24 hours
  weekly: 604800,      // 7 days
  monthly: 2592000,    // 30 days
  total: 31536000,     // 365 days
};

const CHART_POINTS = {
  daily: 24,
  weekly: 7,
  monthly: 30,
  total: 12,
};

const VALID_SERVICES = ["rpc", "wss", "validator_api"];

// GET /api/stats?service=rpc&period=daily
app.get("/api/stats", (req, res) => {
  const { service, period = "daily" } = req.query;

  if (!service || !VALID_SERVICES.includes(service)) {
    return res.status(400).json({
      error: "Invalid service. Must be one of: " + VALID_SERVICES.join(", "),
    });
  }

  if (!PERIOD_MAP[period]) {
    return res.status(400).json({
      error: "Invalid period. Must be one of: " + Object.keys(PERIOD_MAP).join(", "),
    });
  }

  try {
    const stats = getStats(service, PERIOD_MAP[period]);
    res.json({ service, period, ...stats });
  } catch (err) {
    console.error("[API] Stats error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/chart?service=rpc&period=daily
app.get("/api/chart", (req, res) => {
  const { service, period = "daily" } = req.query;

  if (!service || !VALID_SERVICES.includes(service)) {
    return res.status(400).json({
      error: "Invalid service. Must be one of: " + VALID_SERVICES.join(", "),
    });
  }

  if (!PERIOD_MAP[period]) {
    return res.status(400).json({
      error: "Invalid period. Must be one of: " + Object.keys(PERIOD_MAP).join(", "),
    });
  }

  try {
    const data = getChartData(service, PERIOD_MAP[period], CHART_POINTS[period]);
    res.json({ service, period, data });
  } catch (err) {
    console.error("[API] Chart error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/overview - all services summary
app.get("/api/overview", (req, res) => {
  const { period = "daily" } = req.query;

  if (!PERIOD_MAP[period]) {
    return res.status(400).json({ error: "Invalid period" });
  }

  try {
    const overview = {};
    for (const service of VALID_SERVICES) {
      overview[service] = {
        stats: getStats(service, PERIOD_MAP[period]),
        totalAllTime: getTotalRequests(service),
      };
    }
    res.json({ period, services: overview });
  } catch (err) {
    console.error("[API] Overview error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start
async function main() {
  // If import flag is set, import existing log file first
  if (process.argv.includes("--import")) {
    console.log(`[Startup] Importing existing log: ${LOG_PATH}`);
    await importLogFile(LOG_PATH);
    aggregateHourly();
    console.log("[Startup] Import complete, hourly stats aggregated");
  }

  // Start log watcher
  const watcher = new LogWatcher(LOG_PATH);
  await watcher.start();

  // Aggregate hourly stats every 5 minutes
  setInterval(() => {
    try {
      aggregateHourly();
    } catch (err) {
      console.error("[Aggregation] Error:", err.message);
    }
  }, 5 * 60 * 1000);

  // Start API server
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Metrics API] Running on port ${PORT}`);
    console.log(`[Metrics API] Watching log: ${LOG_PATH}`);
    if (API_KEY) console.log("[Metrics API] API key authentication enabled");
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[Shutdown] Stopping...");
    watcher.stop();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("[Shutdown] Stopping...");
    watcher.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[Fatal]", err);
  process.exit(1);
});
