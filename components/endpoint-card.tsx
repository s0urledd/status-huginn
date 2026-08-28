"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

interface EndpointCardProps {
  endpoint: string
  protocol: string
}

export function EndpointCard({ endpoint, protocol }: EndpointCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(endpoint)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 backdrop-blur-xl">
      <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground">
        {protocol}
      </span>
      <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground">
        {endpoint}
      </code>
      <button
        onClick={handleCopy}
        aria-label={`Copy ${endpoint}`}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
          copied
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-border text-muted-foreground hover:bg-white/5 hover:text-foreground"
        )}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}
