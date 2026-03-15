import type { Metadata, Viewport } from "next"
import { ClientProviders } from "./client-providers"
import "./globals.css"

export const metadata: Metadata = {
  description: "AI Gateway Dashboard",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
