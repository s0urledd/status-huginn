"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { DashboardHeader } from "@/components/dashboard-header"
import { NetworkSection } from "@/components/network-section"

type ActiveNetwork = "mainnet" | "testnet"

export default function DashboardPage() {
  const [activeNetwork, setActiveNetwork] = useState<ActiveNetwork>("mainnet")

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-12">
        {/* Hero */}
        <div className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold text-foreground lg:text-[2.5rem] lg:leading-tight text-balance tracking-tight">
              Monad Node Infrastructure
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground lg:text-[15px]">
              High-performance RPC, WebSocket, and Staking API endpoints for the Monad network.
              Powered by Huginn infrastructure with 99.9%+ uptime.
            </p>
          </div>

          {/* Network Toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-secondary/50 p-0.5 w-fit">
            <button
              onClick={() => setActiveNetwork("mainnet")}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
                activeNetwork === "mainnet"
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "size-1.5 rounded-full",
                  activeNetwork === "mainnet" ? "bg-primary-foreground" : "bg-green-400"
                )}
              />
              Mainnet Status
            </button>
            <button
              onClick={() => setActiveNetwork("testnet")}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
                activeNetwork === "testnet"
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "size-1.5 rounded-full",
                  activeNetwork === "testnet" ? "bg-primary-foreground" : "bg-green-400"
                )}
              />
              Testnet Status
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="mb-10 h-px bg-border/50" />

        {/* Network Sections */}
        <div className="flex flex-col gap-16">
          {activeNetwork === "mainnet" ? (
            <NetworkSection
              title="Mainnet RPC & WSS"
              subtitle="Mainnet JSON-RPC, WebSocket, and Staking endpoints"
              network="mainnet"
            />
          ) : (
            <NetworkSection
              title="Testnet RPC & WSS"
              subtitle="Testnet JSON-RPC, WebSocket, and Staking endpoints"
              network="testnet"
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-border/50">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-5 lg:px-8">
          <span className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-foreground">Huginn Tech</span>
          </span>
        </div>
      </footer>
    </div>
  )
}
