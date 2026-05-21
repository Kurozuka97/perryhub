import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'Perry Hub',
  description: 'By Kuro — May our journey end when we isekai\'d by truck-kun',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          defer
          src="https://umami-chi-murex.vercel.app/script.js"
          data-website-id="d4b9fa9c-ff93-435b-b42c-89e2b48f39a0"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
