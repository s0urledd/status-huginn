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
import { formatFullNumber, formatNumber } from "@/lib/dashboard-data"

interface RequestChartProps {
  data: ChartDataPoint[]
  /** Width of one bar of the series, e.g. "1h". */
  bucketLabel?: string | null
  isLoading?: boolean
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      <p className="font-mono text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
        {formatFullNumber(payload[0].value)}
      </p>
      <p className="text-[11px] text-muted-foreground">requests</p>
    </div>
  )
}

export function RequestChart({ data, bucketLabel, isLoading }: RequestChartProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-medium text-foreground">Requests over time</h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {bucketLabel ? `${bucketLabel} buckets · UTC` : "UTC"}
        </span>
      </div>

      <div className="h-[220px] w-full lg:h-[280px]">
        {isLoading ? (
          <div className="h-full w-full animate-pulse rounded-lg bg-white/5" />
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data recorded yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="requestFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#836ef9" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#6e54ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#ffffff0f" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: "#a89fc8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
                dy={6}
              />
              <YAxis
                tick={{ fill: "#a89fc8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={formatNumber}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: "#836ef9", strokeWidth: 1, strokeOpacity: 0.4 }}
              />
              <Area
                type="monotone"
                dataKey="totalRequests"
                stroke="#836ef9"
                strokeWidth={1.75}
                fill="url(#requestFill)"
                activeDot={{ r: 3, fill: "#836ef9", stroke: "#0e091c", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
