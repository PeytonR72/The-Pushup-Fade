<<<<<<< HEAD
import type { Grade, Session, StoredStats } from '@/types'

export const STORAGE_KEY = 'pushup-fade-stats'
const MAX_SESSIONS = 20

function emptyStats(): StoredStats {
  return {
    sessions: [],
    allTime: { totalSessions: 0, bestReps: 0, totalReps: 0 },
  }
}

export function loadStats(): StoredStats {
  if (typeof window === 'undefined') return emptyStats()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStats()
    const parsed = JSON.parse(raw) as StoredStats
    if (!parsed || !Array.isArray(parsed.sessions) || !parsed.allTime) {
      return emptyStats()
    }
    return parsed
  } catch (err) {
    console.error('failed to read stored stats', err)
    return emptyStats()
  }
}

export function appendSession(session: Session): StoredStats {
  const current = loadStats()
  const sessions = [...current.sessions, session].slice(-MAX_SESSIONS)
  const allTime = {
    totalSessions: sessions.length,
    bestReps: sessions.reduce((max, s) => Math.max(max, s.repsCompleted), 0),
    totalReps: sessions.reduce((sum, s) => sum + s.repsCompleted, 0),
  }
  const next: StoredStats = { sessions, allTime }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch (err) {
      console.error('failed to save stats', err)
    }
  }
  return next
}

export function gradeFor(completed: number, missed: number): Grade {
  const total = completed + missed
  if (total === 0) return 'F'
  const rate = completed / total
  if (rate >= 0.95) return 'S'
  if (rate >= 0.8) return 'A'
  if (rate >= 0.65) return 'B'
  if (rate >= 0.5) return 'C'
  return 'F'
}
=======
// localStorage read/write helpers.
// Implementation lands alongside session save/results flow; this file is an intentional shell.

export const STORAGE_KEY = 'pushup-fade-stats'
>>>>>>> origin/main
