import useSWR from "swr"
import type {
  ChartResponse,
  EndpointStats,
  Network,
  ServiceType,
  TimePeriod,
} from "./dashboard-data"

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
})

const swrOptions = { refreshInterval: 30_000, dedupingInterval: 5_000 }

export function useMetricsStats(
  network: Network,
  service: ServiceType,
  period: TimePeriod
) {
  const { data, error, isLoading } = useSWR<EndpointStats>(
    `/api/metrics?network=${network}&service=${service}&period=${period}&type=stats`,
    fetcher,
    swrOptions
  )

  return { stats: data, error, isLoading }
}

export function useMetricsChart(
  network: Network,
  service: ServiceType,
  period: TimePeriod
) {
  const { data, error, isLoading } = useSWR<ChartResponse>(
    `/api/metrics?network=${network}&service=${service}&period=${period}&type=chart`,
    fetcher,
    swrOptions
  )

  return { chart: data, chartData: data?.data, error, isLoading }
}
