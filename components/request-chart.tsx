"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ChartDataPoint } from "@/lib/dashboard-data"
import { formatNumber } from "@/lib/dashboard-data"
import { Loader2 } from "lucide-react"

interface RequestChartProps {
  data: ChartDataPoint[]
  periodLabel: string
  isLoading?: boolean
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card/95 px-3.5 py-2.5 shadow-xl backdrop-blur-sm">
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="size-1.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[11px] text-muted-foreground">Requests</span>
            <span className="text-[11px] font-bold text-foreground font-mono ml-auto">
              {formatNumber(entry.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function RequestChart({ data, periodLabel, isLoading }: RequestChartProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 lg:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-[#836EF9]" />
            <span className="text-[11px] text-muted-foreground">Total Requests</span>
          </div>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">{periodLabel}</span>
      </div>
      <div className="h-[240px] w-full lg:h-[300px]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Henuz veri yok
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#836EF9" stopOpacity={0.35} />
                  <stop offset="50%" stopColor="#836EF9" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#836EF9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1c2e" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: "#9793ad", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                dy={8}
              />
              <YAxis
                tick={{ fill: "#9793ad", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#836EF9', strokeWidth: 1, strokeOpacity: 0.3 }} />
              <Area
                type="monotone"
                dataKey="totalRequests"
                stroke="#836EF9"
                strokeWidth={1.5}
                fill="url(#totalGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
