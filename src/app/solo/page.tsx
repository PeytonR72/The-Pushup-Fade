'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePose } from '@/hooks/usePose'

export type GameState = 'SETUP' | 'COUNTDOWN' | 'ACTIVE' | 'PAUSED' | 'RESULTS'

export default function SoloPage() {
  const [gameState, setGameState] = useState<GameState>('SETUP')

  return (
    <main className="min-h-screen w-full bg-ink text-bone">
      {gameState === 'SETUP' && <SetupView onReady={() => setGameState('COUNTDOWN')} />}
      {gameState === 'COUNTDOWN' && <PlaceholderView label="COUNTDOWN" />}
      {gameState === 'ACTIVE' && <PlaceholderView label="ACTIVE" />}
      {gameState === 'PAUSED' && <PlaceholderView label="PAUSED" />}
      {gameState === 'RESULTS' && <PlaceholderView label="RESULTS" />}
    </main>
  )
}

function PlaceholderView({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <span className="font-display text-5xl md:text-7xl tracking-[0.2em] opacity-30">{label}</span>
      <Link
        href="/"
        className="font-mono text-xs uppercase tracking-[0.3em] opacity-60 hover:opacity-100"
      >
        Home
      </Link>
    </div>
  )
}

function SetupView({ onReady }: { onReady: () => void }) {
  const { videoRef, canvasRef, poseDetected, isLoading, error, visibilityWarning, retry } = usePose()

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">Error</span>
        <p className="font-display text-3xl md:text-5xl tracking-[0.15em] text-blood text-center">
          {error}
        </p>
        <button
          type="button"
          onClick={retry}
          className="font-display text-2xl md:text-3xl tracking-[0.25em] border border-bone/15 px-10 py-3 mt-4 transition-colors hover:bg-bone hover:text-ink"
        >
          RETRY
        </button>
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.3em] opacity-60 hover:opacity-100"
        >
          Home
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-0 md:px-6 py-0 md:py-12">
      <div className="relative w-full md:w-auto md:max-w-[720px] aspect-[4/3] md:border md:border-bone/15 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover bg-ink"
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink">
            <span className="font-mono text-xs md:text-sm uppercase tracking-[0.3em]">
              Requesting camera...
            </span>
          </div>
        )}

        {!isLoading && !poseDetected && (
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">
              Detecting pose
            </span>
          </div>
        )}

        {visibilityWarning && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/70 pointer-events-none px-6">
            <span className="font-display text-3xl md:text-5xl tracking-[0.15em] text-blood text-center leading-tight">
              MOVE TO BETTER LIGHT OR REPOSITION
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-6 px-6">
        <button
          type="button"
          onClick={onReady}
          disabled={!poseDetected}
          aria-disabled={!poseDetected}
          className="font-display text-3xl md:text-4xl tracking-[0.25em] border border-bone/15 px-12 py-4 transition-colors hover:bg-bone hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
        >
          READY
        </button>
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.3em] opacity-60 hover:opacity-100"
        >
          Home
        </Link>
      </div>
    </div>
  )
}
