"use client"

import { useState } from "react"
import { Activity, Gauge, Radio, Server, Timer, Zap } from "lucide-react"
import type { Network, ServiceType, TimePeriod } from "@/lib/dashboard-data"
import {
  ENDPOINTS,
  describeRange,
  formatBucketSize,
  formatFullNumber,
  formatNumber,
} from "@/lib/dashboard-data"
import { useMetricsChart, useMetricsStats } from "@/lib/use-metrics"
import { Segmented, type SegmentedOption } from "@/components/segmented"
import { StatCard } from "@/components/stat-card"
import { RequestChart } from "@/components/request-chart"
import { EndpointCard } from "@/components/endpoint-card"

const services: SegmentedOption<ServiceType>[] = [
  { value: "rpc", label: "RPC", icon: <Server className="size-3.5" /> },
  { value: "wss", label: "WebSocket", icon: <Zap className="size-3.5" /> },
  { value: "validator_api", label: "Staking API", icon: <Activity className="size-3.5" /> },
]

const periods: SegmentedOption<TimePeriod>[] = [
  { value: "daily", label: "24h" },
  { value: "weekly", label: "7d" },
  { value: "monthly", label: "30d" },
  { value: "total", label: "All" },
]

const protocols: Record<ServiceType, string> = {
  rpc: "https",
  wss: "wss",
  validator_api: "https",
}

interface NetworkSectionProps {
  network: Network
}

export function NetworkSection({ network }: NetworkSectionProps) {
  const [service, setService] = useState<ServiceType>("rpc")
  const [period, setPeriod] = useState<TimePeriod>("daily")

  const { stats, isLoading: statsLoading, error: statsError } = useMetricsStats(
    network,
    service,
    period
  )
  const { chart, chartData, isLoading: chartLoading, error: chartError } = useMetricsChart(
    network,
    service,
    period
  )

  // The server clamps every window to the first request it ever recorded, so
  // this is the real measured range - not the nominal one the button implies.
  const range = describeRange(stats?.rangeStart, stats?.rangeEnd)
  const error = statsError || chartError

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented options={services} value={service} onChange={setService} />
        <Segmented options={periods} value={period} onChange={setPeriod} size="sm" />
      </div>

      <EndpointCard endpoint={ENDPOINTS[network][service]} protocol={protocols[service]} />

      {error && (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
          Can&apos;t reach the metrics server right now. Retrying automatically.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <StatCard
          label="Requests"
          value={formatFullNumber(stats?.totalRequests ?? 0)}
          hint={range ? `over ${range.span}` : undefined}
          icon={<Radio className="size-3" />}
          isLoading={statsLoading}
        />
        <StatCard
          label="Avg req/s"
          value={formatNumber(stats?.avgReqPerSec ?? 0)}
          hint={range ? `over ${range.span}` : undefined}
          icon={<Activity className="size-3" />}
          isLoading={statsLoading}
        />
        <StatCard
          label="Now req/s"
          value={formatNumber(stats?.currentReqPerSec ?? 0)}
          hint="last 60s"
          icon={<Gauge className="size-3" />}
          isLoading={statsLoading}
        />
        <StatCard
          label="Peak req/s"
          value={formatNumber(stats?.peakReqPerSec ?? 0)}
          hint="per minute"
          icon={<Timer className="size-3" />}
          isLoading={statsLoading}
        />
        <StatCard
          label="Uptime"
          value={stats?.uptime ?? "—"}
          title="Share of requests answered without a 5xx"
          icon={<Server className="size-3" />}
          isLoading={statsLoading}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <RequestChart
        data={chartData ?? []}
        bucketLabel={formatBucketSize(chart?.bucketSeconds)}
        isLoading={chartLoading}
      />

    </section>
  )
}
