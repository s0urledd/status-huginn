"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { Network, ServiceType, TimePeriod } from "@/lib/dashboard-data"
import { ENDPOINTS, formatFullNumber, formatNumber } from "@/lib/dashboard-data"
import { useMetricsStats, useMetricsChart } from "@/lib/use-metrics"
import { StatCard } from "@/components/stat-card"
import { RequestChart } from "@/components/request-chart"
import { EndpointCard } from "@/components/endpoint-card"
import { PeriodSelector } from "@/components/period-selector"
import { Activity, Server, Zap, BarChart3, TrendingUp, Gauge, ArrowUpRight, Clock, Loader2 } from "lucide-react"

const endpointTabs: { value: ServiceType; label: string; icon: React.ReactNode }[] = [
  { value: "rpc", label: "RPC", icon: <Server className="size-3.5" /> },
  { value: "wss", label: "WSS", icon: <Zap className="size-3.5" /> },
  { value: "validator_api", label: "Staking API", icon: <Activity className="size-3.5" /> },
]

const periodLabels: Record<TimePeriod, string> = {
  daily: "Last 24 Hours",
  weekly: "Last 7 Days",
  monthly: "Last 30 Days",
  total: "All Time",
}

interface NetworkSectionProps {
  title: string
  subtitle: string
  network: Network
}

export function NetworkSection({ title, subtitle, network }: NetworkSectionProps) {
  const [activeEndpoint, setActiveEndpoint] = useState<ServiceType>("rpc")
  const [period, setPeriod] = useState<TimePeriod>("daily")

  const { stats, isLoading: statsLoading, error: statsError } = useMetricsStats(network, activeEndpoint, period)
  const { chartData, isLoading: chartLoading, error: chartError } = useMetricsChart(network, activeEndpoint, period)

  const endpoint = ENDPOINTS[network][activeEndpoint]
  const isError = statsError || chartError
  const isLoading = statsLoading || chartLoading

  return (
    <section className="flex flex-col gap-5">
      {/* Section Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "size-2 rounded-full",
                network === "mainnet" ? "bg-green-400 shadow-sm shadow-green-400/50" : "bg-green-400 shadow-sm shadow-green-400/50"
              )}
            />
            <h2 className="text-xl font-bold text-foreground lg:text-2xl">{title}</h2>
          </div>
          <p className="text-xs text-muted-foreground pl-[18px]">{subtitle}</p>
        </div>
        <PeriodSelector selected={period} onSelect={setPeriod} />
      </div>

      {/* Endpoint Tabs */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-secondary/50 p-0.5 w-fit">
        {endpointTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveEndpoint(tab.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-medium transition-all",
              activeEndpoint === tab.value
                ? "bg-card text-foreground border border-border/50 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Endpoint URL */}
      <EndpointCard
        label={
          activeEndpoint === "rpc"
            ? "RPC Endpoint"
            : activeEndpoint === "wss"
            ? "WebSocket Endpoint"
            : "Staking API Endpoint"
        }
        endpoint={endpoint}
        type={activeEndpoint === "wss" ? "wss" : activeEndpoint === "rpc" ? "rpc" : "api"}
      />

      {/* Error State */}
      {isError && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-400">
          Metrics sunucusuna baglanilamiyor. Veriler yukleniyor...
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5 lg:gap-3">
        <StatCard
          label="Total Requests"
          value={statsLoading ? "..." : formatFullNumber(stats?.totalRequests ?? 0)}
          icon={statsLoading ? <Loader2 className="size-3 animate-spin" /> : <BarChart3 className="size-3" />}
        />
        <StatCard
          label="Avg Req/Sec"
          value={statsLoading ? "..." : formatNumber(stats?.avgReqPerSec ?? 0)}
          icon={<TrendingUp className="size-3" />}
        />
        <StatCard
          label="Current Req/Sec"
          value={statsLoading ? "..." : formatNumber(stats?.currentReqPerSec ?? 0)}
          icon={<Gauge className="size-3" />}
        />
        <StatCard
          label="Peak Req/Sec"
          value={statsLoading ? "..." : formatNumber(stats?.peakReqPerSec ?? 0)}
          icon={<ArrowUpRight className="size-3" />}
        />
        <StatCard
          label="Uptime"
          value={statsLoading ? "..." : (stats?.uptime ?? "—")}
          icon={<Clock className="size-3" />}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Chart */}
      <RequestChart
        data={chartData ?? []}
        periodLabel={periodLabels[period]}
        isLoading={chartLoading}
      />
    </section>
  )
}
