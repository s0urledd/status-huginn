import useSWR from "swr"
import type { Network, ServiceType, TimePeriod, EndpointStats, ChartDataPoint } from "./dashboard-data"

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
})

export function useMetricsStats(
  network: Network,
  service: ServiceType,
  period: TimePeriod
) {
  const { data, error, isLoading } = useSWR<EndpointStats>(
    `/api/metrics?network=${network}&service=${service}&period=${period}&type=stats`,
    fetcher,
    { refreshInterval: 1_800_000, dedupingInterval: 60_000 }
  )

  return { stats: data, error, isLoading }
}

export function useMetricsChart(
  network: Network,
  service: ServiceType,
  period: TimePeriod
) {
  const { data, error, isLoading } = useSWR<{ data: ChartDataPoint[] }>(
    `/api/metrics?network=${network}&service=${service}&period=${period}&type=chart`,
    fetcher,
    { refreshInterval: 1_800_000, dedupingInterval: 60_000 }
  )

  return { chartData: data?.data, error, isLoading }
}
