export interface Point2D {
  x: number
  y: number
}

export interface Landmark extends Point2D {
  z?: number
  visibility?: number
}

export interface PoseResults {
  poseLandmarks?: Landmark[]
  image?: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
}

export interface PoseOptions {
  modelComplexity?: 0 | 1 | 2
  smoothLandmarks?: boolean
  enableSegmentation?: boolean
  smoothSegmentation?: boolean
  minDetectionConfidence?: number
  minTrackingConfidence?: number
}

export interface PoseInstance {
  setOptions(options: PoseOptions): void
  onResults(callback: (results: PoseResults) => void): void
  send(input: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }): Promise<void>
  close(): void
}

export interface PoseConstructorConfig {
  locateFile: (file: string) => string
}

export interface CameraConfig {
  onFrame: () => Promise<void>
  width?: number
  height?: number
}

export interface CameraInstance {
  start(): Promise<void>
  stop(): void
}

type PoseConstructor = new (config: PoseConstructorConfig) => PoseInstance
type CameraConstructor = new (videoElement: HTMLVideoElement, config: CameraConfig) => CameraInstance

declare global {
  interface Window {
    Pose?: PoseConstructor
    Camera?: CameraConstructor
  }
}

export const POSE_LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const

// Rotation-invariant plank thresholds. hipDeviation is perpendicular distance from
// the shoulder->ankle line in normalized image coords. KNEE_STRAIGHT_MIN_DEG is the
// minimum acceptable hip-knee-ankle angle (straight leg = ~180°, knee pushup ~90°).
export const PLANK_HIP_DEVIATION_MAX = 0.08
export const KNEE_STRAIGHT_MIN_DEG = 140
export const WRIST_ALIGN_MAX_RATIO = 1.0

export const MEDIAPIPE_CDN = {
  POSE: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
  DRAWING_UTILS: 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  CAMERA_UTILS: 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  POSE_BASE: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
} as const

export function calculateAngle(a: Point2D, b: Point2D, c: Point2D): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let angle = Math.abs((radians * 180.0) / Math.PI)
  if (angle > 180.0) angle = 360 - angle
  return angle
}

export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// Perpendicular distance from a point to the infinite line through (lineStart, lineEnd),
// in the same units as the input coords. Rotation-invariant.
export function perpendicularDistanceToLine(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D,
): number {
  const ax = lineEnd.x - lineStart.x
  const ay = lineEnd.y - lineStart.y
  const len = Math.sqrt(ax * ax + ay * ay)
  if (len < 1e-6) return 0
  const hx = point.x - lineStart.x
  const hy = point.y - lineStart.y
  return Math.abs(hx * ay - hy * ax) / len
}

// Unit vector along the body axis (shoulder -> ankle, or shoulder -> knee if ankles missing).
// Returns null if the two endpoints coincide.
export function bodyAxisDirection(
  start: Point2D,
  end: Point2D,
): { x: number; y: number } | null {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1e-6) return null
  return { x: dx / len, y: dy / len }
}

// How far the wrist sits ALONG the body axis from the shoulder, as a multiple of shoulder
// width. In a real pushup the wrist drops perpendicular to the body axis, so this number
// stays small. Hands placed far forward or back of the shoulders produce a large value.
export function wristAlignmentRatio(
  shoulder: Point2D,
  wrist: Point2D,
  shoulderWidth: number,
  bodyAxis: { x: number; y: number } | null,
): number {
  if (shoulderWidth < 1e-6) return Infinity
  const dx = wrist.x - shoulder.x
  const dy = wrist.y - shoulder.y
  if (!bodyAxis) {
    // No body axis available: fall back to absolute x-distance, like the old check.
    return Math.abs(dx) / shoulderWidth
  }
  // Component of shoulder->wrist projected onto the body axis.
  const parallel = dx * bodyAxis.x + dy * bodyAxis.y
  return Math.abs(parallel) / shoulderWidth
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-mp="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`failed to load ${src}`)), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.crossOrigin = 'anonymous'
    script.dataset.mp = src
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    })
    script.addEventListener('error', () => reject(new Error(`failed to load ${src}`)))
    document.head.appendChild(script)
  })
}

export async function loadMediaPipeScripts(): Promise<void> {
  await Promise.all([
    loadScript(MEDIAPIPE_CDN.POSE),
    loadScript(MEDIAPIPE_CDN.CAMERA_UTILS),
  ])
}
