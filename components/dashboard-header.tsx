"use client"

import { Activity, Github } from "lucide-react"

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="relative flex size-9 items-center justify-center rounded-lg bg-primary">
            <Activity className="size-4 text-primary-foreground" />
            <div className="absolute -inset-0.5 rounded-lg bg-primary/30 blur-sm -z-10" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-foreground tracking-tight">
              Huginn
            </span>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Node Status
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/5 px-3 py-1.5">
            <div className="relative size-1.5 rounded-full bg-green-400">
              <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
            </div>
            <span className="text-xs font-medium text-green-400">Operational</span>
          </div>
          <a
            href="https://github.com/huginn"
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Github className="size-4" />
            <span className="sr-only">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  )
}
