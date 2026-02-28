import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Huginn Node Status | Monad RPC Dashboard',
  description: 'Real-time status dashboard for Huginn Monad Mainnet & Testnet RPC, WSS, and Validator API endpoints.',
}

export const viewport: Viewport = {
  themeColor: '#836EF9',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
