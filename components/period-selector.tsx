"use client"

import { cn } from "@/lib/utils"
import type { TimePeriod } from "@/lib/dashboard-data"

interface PeriodSelectorProps {
  selected: TimePeriod
  onSelect: (period: TimePeriod) => void
}

const periods: { value: TimePeriod; label: string }[] = [
  { value: "daily", label: "24h" },
  { value: "weekly", label: "7d" },
  { value: "monthly", label: "30d" },
  { value: "total", label: "All" },
]

export function PeriodSelector({ selected, onSelect }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-secondary/50 p-0.5">
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => onSelect(period.value)}
          className={cn(
            "relative rounded-md px-3 py-1.5 text-xs font-medium transition-all",
            selected === period.value
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}
