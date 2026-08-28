export type TimePeriod = "daily" | "weekly" | "monthly" | "total"
export type ServiceType = "rpc" | "wss" | "validator_api"
export type Network = "mainnet" | "testnet"

export interface EndpointStats {
  totalRequests: number
  totalErrors?: number
  /** Share of responses that were 5xx, as a percentage. */
  errorRate?: number
  avgReqPerSec: number
  currentReqPerSec: number
  peakReqPerSec: number
  uptime: string
  /** Hours scored by `uptime`, and how many of them recorded no traffic. */
  observedHours?: number
  activeHours?: number
  gapHours?: number
  /**
   * Window the metrics server actually measured, in unix seconds. It is
   * clamped to the first recorded request, so "All" covers the life of the
   * endpoint rather than a fixed lookback. Absent on older server builds.
   */
  rangeStart?: number
  rangeEnd?: number
  dataStart?: number | null
}

export interface ChartDataPoint {
  time: string
  timestamp?: number
  totalRequests: number
}

export interface ChartResponse {
  data: ChartDataPoint[]
  rangeStart?: number
  rangeEnd?: number
  bucketSeconds?: number
  dataStart?: number | null
}

export const ENDPOINTS: Record<Network, Record<ServiceType, string>> = {
  mainnet: {
    rpc: "https://monad-rpc.huginn.tech",
    wss: "wss://wss.monad-rpc.huginn.tech",
    validator_api: "https://validator-api.huginn.tech",
  },
  testnet: {
    rpc: "https://monad-testnet-rpc.huginn.tech",
    wss: "wss://wss.monad-testnet-rpc.huginn.tech",
    validator_api: "https://validator-api-testnet.huginn.tech",
  },
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
  return num.toLocaleString()
}

export function formatFullNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Coarse, single-unit duration: "45m", "24h", "12d". Rounded to whole hour or
 * day slots, which is the granularity the window is actually built from - a
 * 24h window measured 40 minutes into the current hour should read "24h", not
 * "23h".
 */
export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`
  const hours = Math.ceil(seconds / 3600)
  if (hours < 48) return `${hours}h`
  return `${Math.round(seconds / 86400)}d`
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Describe the window the numbers on screen cover. Everything is rendered in
 * UTC so the labels line up with the server's hourly buckets no matter where
 * the visitor is.
 */
export function describeRange(
  rangeStart?: number,
  rangeEnd?: number
): { span: string; since: string } | null {
  if (!rangeStart || !rangeEnd || rangeEnd <= rangeStart) return null

  const span = rangeEnd - rangeStart
  const start = new Date(rangeStart * 1000)

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }
  if (start.getUTCFullYear() !== new Date().getUTCFullYear()) options.year = "numeric"

  let since = start.toLocaleDateString("en-US", options)
  // Only worth the clock time on short windows.
  if (span < 3 * 86400) since += `, ${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}`

  return { span: formatDuration(span), since: `${since} UTC` }
}

/** Width of one chart bucket, e.g. "1h", "6h", "1d". */
export function formatBucketSize(seconds?: number): string | null {
  if (!seconds) return null
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}
