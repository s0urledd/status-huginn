"use client"

import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface StatCardProps {
  label: string
  value: string
  icon?: ReactNode
  className?: string
}

export function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border border-border/50 bg-secondary/50 p-4 transition-colors hover:border-primary/20 hover:bg-secondary",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
      </div>
      <span className="text-2xl font-bold text-foreground tracking-tight font-mono lg:text-[1.65rem]">
        {value}
      </span>
    </div>
  )
}
