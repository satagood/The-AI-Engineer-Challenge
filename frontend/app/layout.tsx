import React from 'react'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Engineer Challenge - Premium Chat Interface',
  description: 'A premium high-end chat interface powered by OpenAI',
  keywords: ['AI', 'Chat', 'OpenAI', 'Premium', 'Interface'],
  authors: [{ name: 'AI Engineer Challenge' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-ui antialiased">
        {children}
      </body>
    </html>
  )
} 