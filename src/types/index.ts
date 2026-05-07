export type Grade = 'S' | 'A' | 'B' | 'C' | 'F'

export interface Session {
  id: string
  date: string
  repsCompleted: number
  repsMissed: number
  duration: number
  grade: Grade
}

export interface StoredStats {
  sessions: Session[]
  allTime: {
    totalSessions: number
    bestReps: number
    totalReps: number
  }
}
