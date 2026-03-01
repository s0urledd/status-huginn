"use client"

import { Github } from "lucide-react"

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 lg:px-8">
        <div className="flex items-center gap-3">
          <img
            src="https://huginn.tech/logos/huginn-logo.png"
            alt="Huginn"
            className="size-9 rounded-lg"
          />
          <span className="text-base font-bold text-foreground tracking-tight">
            Huginn
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/5 px-3 py-1.5">
            <div className="relative size-1.5 rounded-full bg-green-400">
              <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
            </div>
            <span className="text-xs font-medium text-green-400">Operational</span>
          </div>
          <a
            href="https://github.com/Huginn-tech"
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
