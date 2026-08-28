import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  hint?: string
  /** Hover text, for a figure whose basis is worth stating but not showing. */
  title?: string
  icon?: ReactNode
  isLoading?: boolean
  className?: string
}

export function StatCard({ label, value, hint, title, icon, isLoading, className }: StatCardProps) {
  return (
    <div
      title={title}
      className={cn(
        "rounded-xl border border-border bg-card p-3.5 backdrop-blur-xl",
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      {isLoading ? (
        <div className="mt-2.5 h-5 w-20 animate-pulse rounded bg-white/10" />
      ) : (
        <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>
      )}
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}
