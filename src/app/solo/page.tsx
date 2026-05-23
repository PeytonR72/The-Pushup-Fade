'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  usePose,
  type MissingPart,
  type SetupMetrics,
  type SetupStatus,
} from '@/hooks/usePose'
import { useMediator, type MediatorSubState } from '@/hooks/useMediator'
import { AudioMediator } from '@/lib/audio'
import { appendSession, gradeFor } from '@/lib/storage'
import type { Grade } from '@/types'

export type GameState = 'SETUP' | 'COUNTDOWN' | 'ACTIVE' | 'PAUSED' | 'RESULTS'

interface SessionResult {
  repsCompleted: number
  repsMissed: number
  duration: number
  grade: Grade
}

export default function SoloPage() {
  const [gameState, setGameState] = useState<GameState>('SETUP')
  const [result, setResult] = useState<SessionResult | null>(null)

  const handleFinish = useCallback((r: SessionResult) => {
    setResult(r)
    setGameState('RESULTS')
  }, [])

  const replay = useCallback(() => {
    setResult(null)
    setGameState('SETUP')
  }, [])

  return (
    <main className="min-h-screen w-full bg-ink text-bone">
      {gameState === 'RESULTS' && result ? (
        <ResultsView result={result} onReplay={replay} />
      ) : (
        <GameStage
          gameState={gameState}
          setGameState={setGameState}
          onFinish={handleFinish}
        />
      )}
    </main>
  )
}

function GameStage({
  gameState,
  setGameState,
  onFinish,
}: {
  gameState: GameState
  setGameState: (s: GameState) => void
  onFinish: (r: SessionResult) => void
}) {
  const pose = usePose()
  const audioRef = useRef<AudioMediator | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const setupHoldStartRef = useRef<number | null>(null)
  const setupStatusRef = useRef(pose.setupStatus)
  const [countdownNum, setCountdownNum] = useState(3)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [flashKey, setFlashKey] = useState(0)
  const [holdRemaining, setHoldRemaining] = useState<number | null>(null)

  useEffect(() => {
    setupStatusRef.current = pose.setupStatus
  }, [pose.setupStatus])

  // Init audio on mount so the auto-start (which is not a click event) can still play
  // sounds. The navigation from "/" to "/solo" counts as the user gesture; creating the
  // AudioContext here keeps it alive for the rest of the session.
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new AudioMediator()
      audioRef.current.preload().catch((err) => {
        console.error('audio preload failed', err)
      })
    }
    return () => {
      audioRef.current?.dispose()
      audioRef.current = null
    }
  }, [])

  const playDown = useCallback(() => audioRef.current?.play('down'), [])
  const playUp = useCallback(() => audioRef.current?.play('up'), [])

  const mediatorActive = gameState === 'ACTIVE' || gameState === 'PAUSED'
  const mediatorPaused =
    gameState === 'PAUSED' ||
    (gameState === 'ACTIVE' && (pose.visibilityWarning || pose.postureWarning))

  const mediator = useMediator({
    active: mediatorActive,
    paused: mediatorPaused,
    leftElbowAngle: pose.leftElbowAngle,
    rightElbowAngle: pose.rightElbowAngle,
    midShoulderY: pose.midShoulderY,
    onPlayDown: playDown,
    onPlayUp: playUp,
  })

  const prevRepsRef = useRef(0)
  useEffect(() => {
    if (mediator.repsCompleted > prevRepsRef.current) {
      setFlashKey((k) => k + 1)
    }
    prevRepsRef.current = mediator.repsCompleted
  }, [mediator.repsCompleted])

  useEffect(() => {
    if (gameState !== 'COUNTDOWN') return
    setCountdownNum(3)
    let n = 3
    const id = window.setInterval(() => {
      n -= 1
      if (n <= 0) {
        window.clearInterval(id)
        startTimeRef.current = Date.now()
        setElapsedSec(0)
        setGameState('ACTIVE')
      } else {
        setCountdownNum(n)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [gameState, setGameState])

  // 3-second hold-to-start. While in SETUP, if setupStatus stays 'ready' for 3s, auto-advance
  // to COUNTDOWN. Any drop out of 'ready' resets the hold. We read status via a ref so the
  // interval doesn't tear down on every status change.
  useEffect(() => {
    if (gameState !== 'SETUP') {
      setupHoldStartRef.current = null
      setHoldRemaining(null)
      return
    }
    const id = window.setInterval(() => {
      if (setupStatusRef.current !== 'ready') {
        setupHoldStartRef.current = null
        setHoldRemaining(null)
        return
      }
      if (setupHoldStartRef.current === null) {
        setupHoldStartRef.current = Date.now()
      }
      const elapsed = Date.now() - setupHoldStartRef.current
      if (elapsed >= 3000) {
        setupHoldStartRef.current = null
        setHoldRemaining(null)
        setGameState('COUNTDOWN')
        return
      }
      setHoldRemaining(Math.max(1, Math.ceil((3000 - elapsed) / 1000)))
    }, 100)
    return () => window.clearInterval(id)
  }, [gameState, setGameState])

  // If the user breaks position mid-countdown, abort back to SETUP so they re-confirm.
  useEffect(() => {
    if (gameState === 'COUNTDOWN' && pose.setupStatus !== 'ready') {
      setGameState('SETUP')
    }
  }, [gameState, pose.setupStatus, setGameState])

  useEffect(() => {
    if (gameState !== 'ACTIVE') return
    const id = window.setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [gameState])

  const handleQuit = () => {
    const duration = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : 0
    onFinish({
      repsCompleted: mediator.repsCompleted,
      repsMissed: mediator.repsMissed,
      duration,
      grade: gradeFor(mediator.repsCompleted, mediator.repsMissed),
    })
  }

  if (pose.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">
          Error
        </span>
        <p className="font-display text-3xl md:text-5xl tracking-[0.15em] text-blood text-center">
          {pose.error}
        </p>
        <button
          type="button"
          onClick={pose.retry}
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

  const commandLabel = activeCommandLabel(gameState, mediator.subState)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-0 md:px-6 py-0 md:py-12">
      <div className="relative w-full max-w-[720px] aspect-[4/3] md:border md:border-bone/15 overflow-hidden">
        <video
          ref={pose.videoRef}
          className="absolute inset-0 w-full h-full object-cover bg-ink"
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={pose.canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {pose.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink">
            <span className="font-mono text-xs md:text-sm uppercase tracking-[0.3em]">
              Requesting camera...
            </span>
          </div>
        )}

        {gameState === 'SETUP' && !pose.isLoading && (
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <span
              className={`font-mono text-[11px] md:text-xs uppercase tracking-[0.3em] ${
                pose.setupStatus === 'ready' ? 'text-bone' : 'text-blood'
              }`}
            >
              {setupStatusMessage(pose.setupStatus, pose.missingParts, holdRemaining)}
            </span>
          </div>
        )}

        {gameState === 'SETUP' && !pose.isLoading && (
          <DebugHud metrics={pose.setupMetrics} />
        )}

        {gameState === 'COUNTDOWN' && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/40 pointer-events-none">
            <span className="font-display text-[160px] md:text-[240px] leading-none tracking-wider">
              {countdownNum}
            </span>
          </div>
        )}

        {gameState === 'ACTIVE' && (
          <div className="absolute top-4 left-4 right-4 flex justify-between font-mono text-xl md:text-3xl tabular-nums pointer-events-none">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-60">
                Reps
              </span>
              <span>{String(mediator.repsCompleted).padStart(2, '0')}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-60">
                Time
              </span>
              <span>{formatDuration(elapsedSec)}</span>
            </div>
          </div>
        )}

        {gameState === 'ACTIVE' && commandLabel && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-display text-[120px] md:text-[200px] leading-none tracking-[0.05em]">
              {commandLabel}
            </span>
          </div>
        )}

        {gameState === 'ACTIVE' && mediator.repsMissed > 0 && (
          <div className="absolute bottom-4 left-4 font-mono text-xs uppercase tracking-[0.3em] text-blood pointer-events-none">
            Missed {mediator.repsMissed}
          </div>
        )}

        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/80 pointer-events-none">
            <span className="font-display text-6xl md:text-8xl tracking-[0.2em]">
              PAUSED
            </span>
          </div>
        )}

        {gameState === 'ACTIVE' && pose.visibilityWarning && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/70 pointer-events-none px-6">
            <span className="font-display text-3xl md:text-5xl tracking-[0.15em] text-blood text-center leading-tight">
              MOVE TO BETTER LIGHT OR REPOSITION
            </span>
          </div>
        )}

        {gameState === 'ACTIVE' && !pose.visibilityWarning && pose.postureWarning && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/70 pointer-events-none px-6">
            <span className="font-display text-3xl md:text-5xl tracking-[0.15em] text-blood text-center leading-tight">
              GET IN PUSHUP POSITION
            </span>
          </div>
        )}

        {flashKey > 0 && (
          <div
            key={flashKey}
            className="absolute inset-0 bg-white pointer-events-none animate-rep-flash"
          />
        )}
      </div>

      <div className="flex flex-col items-center gap-6 px-6">
        {gameState === 'SETUP' && (
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-[0.3em] opacity-60 hover:opacity-100"
          >
            Home
          </Link>
        )}

        {gameState === 'ACTIVE' && (
          <button
            type="button"
            onClick={() => setGameState('PAUSED')}
            className="font-display text-2xl md:text-3xl tracking-[0.25em] border border-bone/15 px-10 py-3 transition-colors hover:bg-bone hover:text-ink"
          >
            PAUSE
          </button>
        )}

        {gameState === 'PAUSED' && (
          <div className="flex gap-6">
            <button
              type="button"
              onClick={() => setGameState('ACTIVE')}
              className="font-display text-2xl md:text-3xl tracking-[0.25em] border border-bone/15 px-10 py-3 transition-colors hover:bg-bone hover:text-ink"
            >
              RESUME
            </button>
            <button
              type="button"
              onClick={handleQuit}
              className="font-display text-2xl md:text-3xl tracking-[0.25em] border border-blood/40 text-blood px-10 py-3 transition-colors hover:bg-blood hover:text-bone"
            >
              QUIT
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ResultsView({
  result,
  onReplay,
}: {
  result: SessionResult
  onReplay: () => void
}) {
  const savedRef = useRef(false)
  useEffect(() => {
    if (savedRef.current) return
    savedRef.current = true
    try {
      appendSession({
        id: makeId(),
        date: new Date().toISOString(),
        repsCompleted: result.repsCompleted,
        repsMissed: result.repsMissed,
        duration: result.duration,
        grade: result.grade,
      })
    } catch (err) {
      console.error('failed to save session', err)
    }
  }, [result])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12 px-6 py-12">
      <span className="font-display text-9xl md:text-[200px] leading-none tracking-wider">
        {result.grade}
      </span>
      <div className="grid grid-cols-3 gap-8 md:gap-16">
        <ResultStat label="Reps" value={String(result.repsCompleted)} />
        <ResultStat label="Missed" value={String(result.repsMissed)} />
        <ResultStat label="Time" value={formatDuration(result.duration)} />
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <button
          type="button"
          onClick={onReplay}
          className="font-display text-2xl md:text-3xl tracking-[0.25em] border border-bone/15 px-10 py-3 transition-colors hover:bg-bone hover:text-ink"
        >
          RUN IT BACK
        </button>
        <Link
          href="/"
          className="font-display text-2xl md:text-3xl tracking-[0.25em] border border-bone/15 px-10 py-3 text-center transition-colors hover:bg-bone hover:text-ink"
        >
          HOME
        </Link>
      </div>
    </div>
  )
}

// Debug HUD shown in the top-left of the camera feed during SETUP. Color-codes each value
// pass/fail so the user can see exactly which check is failing and report it back.
// Thresholds duplicated locally rather than re-imported, to keep the page lib-agnostic.
const HUD_KNEE_MIN_DEG = 140
const HUD_HIP_DEV_MAX = 0.08
const HUD_WRIST_DEV_MAX = 1.0
const HUD_VIS_MIN = 0.3

function DebugHud({ metrics }: { metrics: SetupMetrics }) {
  const fmt = (n: number | null, digits = 0, suffix = '') =>
    n === null ? '--' : `${n.toFixed(digits)}${suffix}`
  const ok = (cond: boolean) => (cond ? 'text-bone' : 'text-blood')
  const vis = metrics.visibility

  return (
    <div className="absolute top-2 left-2 font-mono text-[9px] leading-tight bg-ink/60 px-2 py-1 space-y-0.5 pointer-events-none">
      <div>
        KNEE{' '}
        <span
          className={ok(metrics.leftKneeAngle !== null && metrics.leftKneeAngle >= HUD_KNEE_MIN_DEG)}
        >
          L:{fmt(metrics.leftKneeAngle, 0, 'd')}
        </span>{' '}
        <span
          className={ok(
            metrics.rightKneeAngle !== null && metrics.rightKneeAngle >= HUD_KNEE_MIN_DEG,
          )}
        >
          R:{fmt(metrics.rightKneeAngle, 0, 'd')}
        </span>
      </div>
      <div>
        HIP{' '}
        <span
          className={ok(metrics.hipDeviation !== null && metrics.hipDeviation <= HUD_HIP_DEV_MAX)}
        >
          {fmt(metrics.hipDeviation, 2)}
        </span>
      </div>
      <div>
        WRIST{' '}
        <span
          className={ok(
            metrics.leftWristDeviation !== null && metrics.leftWristDeviation <= HUD_WRIST_DEV_MAX,
          )}
        >
          L:{fmt(metrics.leftWristDeviation, 1)}
        </span>{' '}
        <span
          className={ok(
            metrics.rightWristDeviation !== null &&
              metrics.rightWristDeviation <= HUD_WRIST_DEV_MAX,
          )}
        >
          R:{fmt(metrics.rightWristDeviation, 1)}
        </span>
      </div>
      <div>
        VIS SH{' '}
        <span className={ok(vis.shoulders.left >= HUD_VIS_MIN)}>{vis.shoulders.left.toFixed(1)}</span>/
        <span className={ok(vis.shoulders.right >= HUD_VIS_MIN)}>{vis.shoulders.right.toFixed(1)}</span>{' '}
        EL{' '}
        <span className={ok(vis.elbows.left >= HUD_VIS_MIN)}>{vis.elbows.left.toFixed(1)}</span>/
        <span className={ok(vis.elbows.right >= HUD_VIS_MIN)}>{vis.elbows.right.toFixed(1)}</span>
      </div>
      <div>
        VIS HI{' '}
        <span className={ok(vis.hips.left >= HUD_VIS_MIN)}>{vis.hips.left.toFixed(1)}</span>/
        <span className={ok(vis.hips.right >= HUD_VIS_MIN)}>{vis.hips.right.toFixed(1)}</span>{' '}
        KN{' '}
        <span className={ok(vis.knees.left >= HUD_VIS_MIN)}>{vis.knees.left.toFixed(1)}</span>/
        <span className={ok(vis.knees.right >= HUD_VIS_MIN)}>{vis.knees.right.toFixed(1)}</span>{' '}
        AN{' '}
        <span className={ok(vis.ankles.left >= HUD_VIS_MIN)}>{vis.ankles.left.toFixed(1)}</span>/
        <span className={ok(vis.ankles.right >= HUD_VIS_MIN)}>{vis.ankles.right.toFixed(1)}</span>
      </div>
    </div>
  )
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-mono text-4xl md:text-6xl tabular-nums">{value}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">
        {label}
      </span>
    </div>
  )
}

function activeCommandLabel(
  gameState: GameState,
  subState: MediatorSubState,
): string | null {
  if (gameState !== 'ACTIVE') return null
  if (subState === 'WAITING_FOR_DOWN') return 'DOWN'
  if (subState === 'HOLDING_BOTTOM') return 'HOLD'
  if (subState === 'WAITING_FOR_UP') return 'UP'
  return null
}

function setupStatusMessage(
  status: SetupStatus,
  missing: MissingPart[],
  holdRemaining: number | null,
): string {
  switch (status) {
    case 'camera-loading':
      return 'Requesting camera...'
    case 'no-pose':
      return 'Step into frame'
    case 'frame-incomplete': {
      const list = missing.length > 0 ? missing.join(', ') : 'body'
      return `Angle ~20 degrees so whole body fits in frame. Missing: ${list}`
    }
    case 'not-in-plank':
      return 'Get in pushup position'
    case 'ready':
      if (holdRemaining !== null) return `Hold position: ${holdRemaining}`
      return 'Position locked'
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
