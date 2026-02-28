export type TimePeriod = "daily" | "weekly" | "monthly" | "total"

export interface EndpointStats {
  totalRequests: number
  avgReqPerSec: number
  currentReqPerSec: number
  uptime: string
  peakReqPerSec: number
}

export interface ChartDataPoint {
  time: string
  totalRequests: number
  cachedRequests: number
}

function generateChartData(period: TimePeriod): ChartDataPoint[] {
  const points: ChartDataPoint[] = []
  let count: number
  let labelFn: (i: number) => string

  switch (period) {
    case "daily":
      count = 24
      labelFn = (i) => `${String(i).padStart(2, "0")}:00`
      break
    case "weekly":
      count = 7
      labelFn = (i) => {
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        return days[i]
      }
      break
    case "monthly":
      count = 30
      labelFn = (i) => `Day ${i + 1}`
      break
    case "total":
      count = 12
      labelFn = (i) => {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return months[i]
      }
      break
  }

  const baseMultiplier = period === "daily" ? 1 : period === "weekly" ? 7 : period === "monthly" ? 30 : 365

  for (let i = 0; i < count; i++) {
    const base = 1_200_000 * baseMultiplier + Math.floor(Math.random() * 400_000 * baseMultiplier)
    const cached = Math.floor(base * (0.55 + Math.random() * 0.15))
    points.push({
      time: labelFn(i),
      totalRequests: base,
      cachedRequests: cached,
    })
  }

  return points
}

export interface NetworkData {
  rpc: {
    stats: Record<TimePeriod, EndpointStats>
    chart: Record<TimePeriod, ChartDataPoint[]>
    endpoint: string
  }
  wss: {
    stats: Record<TimePeriod, EndpointStats>
    chart: Record<TimePeriod, ChartDataPoint[]>
    endpoint: string
  }
  stakingApi: {
    stats: Record<TimePeriod, EndpointStats>
    chart: Record<TimePeriod, ChartDataPoint[]>
    endpoint: string
  }
}

function createEndpointData(
  endpoint: string,
  baseReqs: number
): {
  stats: Record<TimePeriod, EndpointStats>
  chart: Record<TimePeriod, ChartDataPoint[]>
  endpoint: string
} {
  return {
    endpoint,
    stats: {
      daily: {
        totalRequests: baseReqs,
        avgReqPerSec: Math.floor(baseReqs / 86400),
        currentReqPerSec: Math.floor(baseReqs / 86400 + Math.random() * 5000),
        uptime: "99.98%",
        peakReqPerSec: Math.floor(baseReqs / 86400 * 1.4),
      },
      weekly: {
        totalRequests: baseReqs * 7,
        avgReqPerSec: Math.floor(baseReqs / 86400),
        currentReqPerSec: Math.floor(baseReqs / 86400 + Math.random() * 5000),
        uptime: "99.97%",
        peakReqPerSec: Math.floor(baseReqs / 86400 * 1.6),
      },
      monthly: {
        totalRequests: baseReqs * 30,
        avgReqPerSec: Math.floor(baseReqs / 86400),
        currentReqPerSec: Math.floor(baseReqs / 86400 + Math.random() * 5000),
        uptime: "99.95%",
        peakReqPerSec: Math.floor(baseReqs / 86400 * 1.8),
      },
      total: {
        totalRequests: baseReqs * 365,
        avgReqPerSec: Math.floor(baseReqs / 86400),
        currentReqPerSec: Math.floor(baseReqs / 86400 + Math.random() * 5000),
        uptime: "99.94%",
        peakReqPerSec: Math.floor(baseReqs / 86400 * 2),
      },
    },
    chart: {
      daily: generateChartData("daily"),
      weekly: generateChartData("weekly"),
      monthly: generateChartData("monthly"),
      total: generateChartData("total"),
    },
  }
}

export const mainnetEndpoints = {
  rpc: "https://monad-rpc.huginn.tech",
  wss: "wss://monad-wss.huginn.tech",
  stakingApi: "https://validator-api.huginn.tech/monad-api",
}

export const testnetEndpoints = {
  rpc: "https://monad-testnet-rpc.huginn.tech",
  wss: "wss://monad-testnet-wss.huginn.tech",
  stakingApi: "https://validator-api-testnet.huginn.tech/monad-api",
}

export const mainnetData: NetworkData = {
  rpc: createEndpointData(mainnetEndpoints.rpc, 2_501_566_457),
  wss: createEndpointData(mainnetEndpoints.wss, 890_234_112),
  stakingApi: createEndpointData(mainnetEndpoints.stakingApi, 456_789_321),
}

export const testnetData: NetworkData = {
  rpc: createEndpointData(testnetEndpoints.rpc, 1_234_567_890),
  wss: createEndpointData(testnetEndpoints.wss, 567_890_123),
  stakingApi: createEndpointData(testnetEndpoints.stakingApi, 345_678_901),
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`
  }
  return num.toLocaleString()
}

export function formatFullNumber(num: number): string {
  return num.toLocaleString()
}
