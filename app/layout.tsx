import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

// One family, and only the three weights the type scale actually uses.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Wipely — Clean that sticks with you',
  description:
    'A flat pad of wipes that sticks to the back of your phone, so the thing you touch most is never far from a fresh sheet.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Deliberately no maximum-scale: pinch zoom stays available.
  themeColor: '#f4f5f7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a className="skip-link" href="#viewer">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  )
}
