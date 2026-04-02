import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Perry Hub',
  description: 'By Kuro — May our journey end when we isekai\'d by truck-kun',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
