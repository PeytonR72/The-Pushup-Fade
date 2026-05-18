'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { StoredStats } from '@/types'

const STATS_KEY = 'pushup-fade-stats'

export default function HomePage() {
  const [allTime, setAllTime] = useState<StoredStats['allTime'] | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STATS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as StoredStats
      if (parsed && parsed.allTime) {
        setAllTime(parsed.allTime)
      }
    } catch (err) {
      console.error('failed to read stored stats', err)
    }
  }, [])

  const totalSessions = allTime ? allTime.totalSessions.toString() : '-'
  const bestReps = allTime ? allTime.bestReps.toString() : '-'
  const totalReps = allTime ? allTime.totalReps.toString() : '-'

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16">
      <section className="flex-1 w-full flex flex-col items-center justify-center gap-10 text-center">
        <h1 className="font-display text-7xl md:text-9xl leading-none tracking-wider">
          THE PUSHUP FADE
        </h1>
        <p className="font-mono text-xs md:text-sm uppercase tracking-[0.3em]">
          REPS DON&apos;T COUNT IF THE CAMERA DIDN&apos;T SEE THEM.
        </p>
        <Link
          href="/solo"
          className="font-display text-3xl md:text-4xl tracking-[0.25em] border border-bone/15 px-12 py-4 mt-4 hover:bg-bone hover:text-ink transition-colors"
        >
          START FADE
        </Link>
      </section>

      <section className="w-full max-w-3xl border-t border-bone/15 pt-8 mt-16">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60 mb-6">
          All Time
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Sessions" value={totalSessions} />
          <Stat label="Best Reps" value={bestReps} />
          <Stat label="Total Reps" value={totalReps} />
        </div>
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-mono text-3xl md:text-5xl tabular-nums">{value}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">
        {label}
      </span>
    </div>
  )
}
