export type TimePeriod = "daily" | "weekly" | "monthly" | "total"
export type ServiceType = "rpc" | "wss" | "validator_api"
export type Network = "mainnet" | "testnet"

export interface EndpointStats {
  totalRequests: number
  avgReqPerSec: number
  currentReqPerSec: number
  peakReqPerSec: number
  uptime: string
}

export interface ChartDataPoint {
  time: string
  totalRequests: number
}

export const ENDPOINTS: Record<Network, Record<ServiceType, string>> = {
  mainnet: {
    rpc: "https://monad-rpc.huginn.tech",
    wss: "wss://monad-wss.huginn.tech",
    validator_api: "https://validator-api.huginn.tech/monad-api",
  },
  testnet: {
    rpc: "https://monad-testnet-rpc.huginn.tech",
    wss: "wss://monad-testnet-wss.huginn.tech",
    validator_api: "https://validator-api-testnet.huginn.tech/monad-api",
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
