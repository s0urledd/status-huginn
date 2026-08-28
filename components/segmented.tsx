"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: "sm" | "md"
  className?: string
}

/**
 * The one control this page uses for switching anything: network, service,
 * time range. Same shape everywhere so the page reads as a single instrument
 * panel rather than three different widgets.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex w-fit items-center gap-0.5 rounded-lg border border-border bg-secondary p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-1.5 text-[13px]",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
