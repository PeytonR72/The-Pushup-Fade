<<<<<<< HEAD
'use client'

import { useEffect, useRef, useState } from 'react'

export type MediatorSubState =
  | 'WAITING_FOR_DOWN'
  | 'HOLDING_BOTTOM'
  | 'WAITING_FOR_UP'
  | 'REST_AT_TOP'

export interface UseMediatorOptions {
  active: boolean
  paused: boolean
  leftElbowAngle: number | null
  rightElbowAngle: number | null
  midShoulderY: number | null
  onPlayDown: () => void
  onPlayUp: () => void
}

export interface UseMediatorReturn {
  subState: MediatorSubState
  repsCompleted: number
  repsMissed: number
}

const DOWN_THRESHOLD = 90
const UP_THRESHOLD = 150
const COMPLIANCE_WINDOW_MS = 2000
const HOLD_MIN_MS = 1000
const HOLD_MAX_MS = 3500
const REST_MIN_MS = 800
const REST_MAX_MS = 2000
const TICK_MS = 50
const SHOULDER_DESCENT_MIN = 0.08

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function useMediator(options: UseMediatorOptions): UseMediatorReturn {
  const {
    active,
    paused,
    leftElbowAngle,
    rightElbowAngle,
    midShoulderY,
    onPlayDown,
    onPlayUp,
  } = options

  const [subState, setSubState] = useState<MediatorSubState>('WAITING_FOR_DOWN')
  const [repsCompleted, setRepsCompleted] = useState(0)
  const [repsMissed, setRepsMissed] = useState(0)

  const leftElbowAngleRef = useRef<number | null>(leftElbowAngle)
  const rightElbowAngleRef = useRef<number | null>(rightElbowAngle)
  const midShoulderYRef = useRef<number | null>(midShoulderY)
  const pausedRef = useRef(paused)
  const playDownRef = useRef(onPlayDown)
  const playUpRef = useRef(onPlayUp)

  useEffect(() => {
    leftElbowAngleRef.current = leftElbowAngle
  }, [leftElbowAngle])

  useEffect(() => {
    rightElbowAngleRef.current = rightElbowAngle
  }, [rightElbowAngle])

  useEffect(() => {
    midShoulderYRef.current = midShoulderY
  }, [midShoulderY])

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    playDownRef.current = onPlayDown
  }, [onPlayDown])

  useEffect(() => {
    playUpRef.current = onPlayUp
  }, [onPlayUp])

  useEffect(() => {
    if (!active) {
      setSubState('WAITING_FOR_DOWN')
      setRepsCompleted(0)
      setRepsMissed(0)
      return
    }

    let cancelled = false
    let pendingTimer: number | undefined
    const baseline: { topShoulderY: number | null } = { topShoulderY: null }

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        pendingTimer = window.setTimeout(() => {
          pendingTimer = undefined
          resolve()
        }, ms)
      })

    const waitForCondition = async (
      predicate: () => boolean,
      limitMs: number,
    ): Promise<boolean> => {
      let elapsed = 0
      while (!cancelled) {
        if (pausedRef.current) {
          await wait(TICK_MS)
          continue
        }
        if (predicate()) return true
        if (elapsed >= limitMs) return false
        await wait(TICK_MS)
        elapsed += TICK_MS
      }
      return false
    }

    const holdPosition = async (
      stillHolding: () => boolean,
      durationMs: number,
    ): Promise<boolean> => {
      let elapsed = 0
      while (!cancelled) {
        if (pausedRef.current) {
          await wait(TICK_MS)
          continue
        }
        if (!stillHolding()) return false
        if (elapsed >= durationMs) return true
        await wait(TICK_MS)
        elapsed += TICK_MS
      }
      return false
    }

    const restWait = async (durationMs: number): Promise<void> => {
      let elapsed = 0
      while (!cancelled && elapsed < durationMs) {
        if (pausedRef.current) {
          await wait(TICK_MS)
          continue
        }
        await wait(TICK_MS)
        elapsed += TICK_MS
      }
    }

    const bothElbowsBelow = (threshold: number) => {
      const l = leftElbowAngleRef.current
      const r = rightElbowAngleRef.current
      return l !== null && r !== null && l < threshold && r < threshold
    }

    const bothElbowsAbove = (threshold: number) => {
      const l = leftElbowAngleRef.current
      const r = rightElbowAngleRef.current
      return l !== null && r !== null && l > threshold && r > threshold
    }

    const isDown = () => {
      if (!bothElbowsBelow(DOWN_THRESHOLD)) return false
      const sy = midShoulderYRef.current
      if (sy === null) return false
      if (baseline.topShoulderY === null || sy < baseline.topShoulderY) {
        baseline.topShoulderY = sy
      }
      return sy - baseline.topShoulderY >= SHOULDER_DESCENT_MIN
    }

    const isHolding = () => bothElbowsBelow(DOWN_THRESHOLD)
    const isUp = () => bothElbowsAbove(UP_THRESHOLD)

    const run = async () => {
      while (!cancelled) {
        setSubState('WAITING_FOR_DOWN')
        baseline.topShoulderY = null
        playDownRef.current()
        const downOk = await waitForCondition(isDown, COMPLIANCE_WINDOW_MS)
        if (cancelled) return
        if (!downOk) {
          setRepsMissed((m) => m + 1)
          continue
        }

        setSubState('HOLDING_BOTTOM')
        const holdMs = randomInt(HOLD_MIN_MS, HOLD_MAX_MS)
        const held = await holdPosition(isHolding, holdMs)
        if (cancelled) return
        if (!held) {
          setRepsMissed((m) => m + 1)
          continue
        }

        setSubState('WAITING_FOR_UP')
        playUpRef.current()
        const upOk = await waitForCondition(isUp, COMPLIANCE_WINDOW_MS)
        if (cancelled) return
        if (!upOk) {
          setRepsMissed((m) => m + 1)
          continue
        }

        setRepsCompleted((r) => r + 1)

        setSubState('REST_AT_TOP')
        const restMs = randomInt(REST_MIN_MS, REST_MAX_MS)
        await restWait(restMs)
      }
    }

    void run()

    return () => {
      cancelled = true
      if (pendingTimer !== undefined) {
        clearTimeout(pendingTimer)
        pendingTimer = undefined
      }
    }
  }, [active])

  return { subState, repsCompleted, repsMissed }
=======
// Mediator state machine hook.
// Implementation lands with /solo wiring; this file is an intentional shell.

export function useMediator(): null {
  return null
>>>>>>> origin/main
}
