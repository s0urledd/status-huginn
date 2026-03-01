import { NextRequest, NextResponse } from "next/server"

// Metrics server URLs - set these in your .env.local
const METRICS_SERVERS: Record<string, string> = {
  mainnet: process.env.MAINNET_METRICS_URL || "http://localhost:3100",
  testnet: process.env.TESTNET_METRICS_URL || "http://localhost:3100",
}

const API_KEY = process.env.METRICS_API_KEY || ""

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const network = searchParams.get("network") || "mainnet"
  const service = searchParams.get("service") || "rpc"
  const period = searchParams.get("period") || "daily"
  const type = searchParams.get("type") || "stats" // stats | chart | overview

  const metricsUrl = METRICS_SERVERS[network]
  if (!metricsUrl) {
    return NextResponse.json({ error: "Invalid network" }, { status: 400 })
  }

  try {
    const headers: Record<string, string> = {}
    if (API_KEY) headers["x-api-key"] = API_KEY

    let url: string
    if (type === "overview") {
      url = `${metricsUrl}/api/overview?period=${period}`
    } else if (type === "chart") {
      url = `${metricsUrl}/api/chart?service=${service}&period=${period}`
    } else {
      url = `${metricsUrl}/api/stats?service=${service}&period=${period}`
    }

    const response = await fetch(url, {
      headers,
      cache: "no-store", // always fetch fresh data, SWR handles client-side polling
    })

    if (!response.ok) {
      throw new Error(`Metrics server responded with ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error(`[Metrics API] Error fetching from ${network}:`, error)
    return NextResponse.json(
      { error: "Failed to fetch metrics", network },
      { status: 502 }
    )
  }
}
