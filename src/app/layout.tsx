import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'The Pushup Fade',
  description: 'A competitive push-up battle. Voice mediator. Pose verified. No excuses.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
