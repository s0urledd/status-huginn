"use client"

import { useState } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { NetworkSection } from "@/components/network-section"
import { Segmented, type SegmentedOption } from "@/components/segmented"
import type { Network } from "@/lib/dashboard-data"

const networks: SegmentedOption<Network>[] = [
  { value: "mainnet", label: "Mainnet" },
  { value: "testnet", label: "Testnet" },
]

export default function DashboardPage() {
  const [network, setNetwork] = useState<Network>("mainnet")

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-6 lg:py-10">
        <div className="mb-7 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-secondary-foreground">
              Huginn infrastructure
            </p>
            <h1 className="gradient-title text-2xl font-semibold tracking-tight lg:text-[2rem]">
              Monad endpoint status
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Request volume, throughput and availability for the RPC, WebSocket and
              Staking API endpoints we run on Monad.
            </p>
          </div>

          <Segmented options={networks} value={network} onChange={setNetwork} />
        </div>

        {/* Remount per network so a switch does not briefly show the other one's numbers. */}
        <NetworkSection key={network} network={network} />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11px] text-muted-foreground lg:px-6">
          <span>Metrics refresh every 30 seconds.</span>
          <span>
            Powered by{" "}
            <a href="https://huginn.tech" className="text-foreground hover:text-secondary-foreground">
              Huginn Tech
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}
