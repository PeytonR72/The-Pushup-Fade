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
} as const

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
