"use client"

import { useState } from "react"
import { Copy, Check, Globe, Wifi, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

interface EndpointCardProps {
  label: string
  endpoint: string
  type: "rpc" | "wss" | "api"
}

const typeConfig = {
  rpc: { icon: Globe, badge: "HTTPS", badgeColor: "text-green-400 bg-green-500/10 border-green-500/20" },
  wss: { icon: Wifi, badge: "WSS", badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  api: { icon: Shield, badge: "API", badgeColor: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
}

export function EndpointCard({ label, endpoint, type }: EndpointCardProps) {
  const [copied, setCopied] = useState(false)
  const config = typeConfig[type]
  const Icon = config.icon

  const handleCopy = async () => {
    await navigator.clipboard.writeText(endpoint)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-primary/20 lg:flex-row lg:items-center lg:justify-between lg:p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg border border-border/50 bg-secondary">
          <Icon className="size-4 text-primary" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", config.badgeColor)}>
              {config.badge}
            </span>
          </div>
          <code className="text-xs font-mono text-muted-foreground break-all">{endpoint}</code>
        </div>
      </div>
      <button
        onClick={handleCopy}
        className={cn(
          "flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all shrink-0",
          copied
            ? "bg-green-500/10 border border-green-500/20 text-green-400"
            : "bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
        )}
      >
        {copied ? (
          <>
            <Check className="size-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-3.5" />
            Copy URL
          </>
        )}
      </button>
    </div>
  )
}
