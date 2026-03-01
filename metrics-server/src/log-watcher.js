const fs = require("fs");
const readline = require("readline");
const { insertRequests } = require("./db");

// Maps nginx server_name / domain to service type
const SERVICE_MAP = {
  // Mainnet
  "monad-rpc.huginn.tech": "rpc",
  "wss.monad-rpc.huginn.tech": "wss",
  "validator-api.huginn.tech": "validator_api",
  "validators-api.huginn.tech": "validator_api",
  // Testnet
  "monad-testnet-rpc.huginn.tech": "rpc",
  "wss.monad-testnet-rpc.huginn.tech": "wss",
  "validator-api-testnet.huginn.tech": "validator_api",
};

// Parse nginx log line with custom format:
// $host $remote_addr [$time_local] "$request" $status $body_bytes_sent $request_time
const LOG_REGEX =
  /^(\S+)\s+\S+\s+\[([^\]]+)\]\s+"[^"]*"\s+(\d+)\s+\d+\s+([\d.]+)/;

function parseLogLine(line) {
  const match = line.match(LOG_REGEX);
  if (!match) return null;

  const [, host, timeStr, statusStr, rtStr] = match;
  const service = SERVICE_MAP[host];
  if (!service) return null;

  const timestamp = parseNginxTime(timeStr);
  return {
    service,
    timestamp,
    status: parseInt(statusStr, 10),
    responseTime: parseFloat(rtStr),
  };
}

// Parse nginx time format: "28/Feb/2026:09:41:00 +0300"
function parseNginxTime(timeStr) {
  const months = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const parts = timeStr.match(
    /(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+)\s+([+-])(\d{2})(\d{2})/
  );
  if (!parts) return Math.floor(Date.now() / 1000);

  const [, day, mon, year, hour, min, sec, tzSign, tzHours, tzMinutes] = parts;
  // Build UTC date string and parse properly with timezone offset
  const monthNum = String(months[mon] + 1).padStart(2, "0");
  const isoStr = `${year}-${monthNum}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${min.padStart(2, "0")}:${sec.padStart(2, "0")}${tzSign}${tzHours}:${tzMinutes}`;
  const date = new Date(isoStr);
  return Math.floor(date.getTime() / 1000);
}

class LogWatcher {
  constructor(logPath) {
    this.logPath = logPath;
    this.buffer = [];
    this.flushInterval = null;
    this.watcher = null;
    this.fileHandle = null;
    this.position = 0;
  }

  async start() {
    // Start from end of file (only watch new lines)
    try {
      const stat = fs.statSync(this.logPath);
      this.position = stat.size;
    } catch {
      this.position = 0;
    }

    // Flush buffer every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);

    // Watch for file changes
    this.watch();

    console.log(`[LogWatcher] Watching: ${this.logPath}`);
  }

  watch() {
    // Use polling to handle log rotation
    const checkInterval = setInterval(() => {
      try {
        const stat = fs.statSync(this.logPath);

        // File was rotated (size smaller than position)
        if (stat.size < this.position) {
          console.log("[LogWatcher] Log rotation detected, resetting position");
          this.position = 0;
        }

        // New data available
        if (stat.size > this.position) {
          this.readNewLines();
        }
      } catch (err) {
        // File temporarily unavailable during rotation
      }
    }, 1000);

    this.watcher = { close: () => clearInterval(checkInterval) };
  }

  readNewLines() {
    const stream = fs.createReadStream(this.logPath, {
      start: this.position,
      encoding: "utf8",
    });

    let leftover = "";
    stream.on("data", (chunk) => {
      const lines = (leftover + chunk).split("\n");
      leftover = lines.pop(); // save incomplete last line

      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = parseLogLine(line);
        if (parsed) {
          this.buffer.push(parsed);
        }
      }
    });

    stream.on("end", () => {
      const stat = fs.statSync(this.logPath);
      this.position = stat.size;
    });

    stream.on("error", (err) => {
      console.error("[LogWatcher] Read error:", err.message);
    });
  }

  flush() {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0);
    try {
      insertRequests(batch);
      if (batch.length > 100) {
        console.log(`[LogWatcher] Flushed ${batch.length} records`);
      }
    } catch (err) {
      console.error("[LogWatcher] DB insert error:", err.message);
      // Put back failed records
      this.buffer.unshift(...batch);
    }
  }

  stop() {
    if (this.flushInterval) clearInterval(this.flushInterval);
    if (this.watcher) this.watcher.close();
    this.flush(); // final flush
  }
}

// Parse existing log file for initial data import
async function importLogFile(logPath) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(logPath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream });
    const batch = [];
    let count = 0;

    rl.on("line", (line) => {
      const parsed = parseLogLine(line);
      if (parsed) {
        batch.push(parsed);
        count++;

        // Flush in batches of 10000
        if (batch.length >= 10000) {
          insertRequests(batch.splice(0));
        }
      }
    });

    rl.on("close", () => {
      if (batch.length > 0) {
        insertRequests(batch);
      }
      console.log(`[Import] Imported ${count} records from ${logPath}`);
      resolve(count);
    });

    rl.on("error", reject);
  });
}

module.exports = { LogWatcher, importLogFile, parseLogLine };
