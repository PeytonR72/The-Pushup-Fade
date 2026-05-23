'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  bodyAxisDirection,
  calculateAngle,
  KNEE_STRAIGHT_MIN_DEG,
  loadMediaPipeScripts,
  MEDIAPIPE_CDN,
  midpoint,
  perpendicularDistanceToLine,
  PLANK_HIP_DEVIATION_MAX,
  POSE_LANDMARKS,
  WRIST_ALIGN_MAX_RATIO,
  wristAlignmentRatio,
  type CameraInstance,
  type Landmark,
  type PoseInstance,
  type PoseResults,
} from '@/lib/mediapipe'

export type SetupStatus =
  | 'camera-loading'
  | 'no-pose'
  | 'frame-incomplete'
  | 'not-in-plank'
  | 'ready'

export type MissingPart = 'arms' | 'shoulders' | 'hips' | 'knees' | 'feet'

export interface UsePoseReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  leftElbowAngle: number | null
  rightElbowAngle: number | null
  midShoulderY: number | null
  poseDetected: boolean
  plankValid: boolean
  setupStatus: SetupStatus
  missingParts: MissingPart[]
  isLoading: boolean
  error: string | null
  visibilityWarning: boolean
  postureWarning: boolean
  retry: () => void
}

// MediaPipe scores lower-body landmarks conservatively, especially when they're far from the
// camera or partially out of frame. 0.3 is forgiving enough that hips/knees/ankles register
// when they're actually in shot, but still rejects landmarks that MediaPipe is hallucinating.
const VISIBILITY_THRESHOLD = 0.3
const LOW_VISIBILITY_FRAME_LIMIT = 10
const INVALID_PLANK_FRAME_LIMIT = 10

export function usePose(): UsePoseReturn {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const poseRef = useRef<PoseInstance | null>(null)
  const cameraRef = useRef<CameraInstance | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lowVisibilityFramesRef = useRef(0)
  const invalidPlankFramesRef = useRef(0)

  const [retryToken, setRetryToken] = useState(0)
  const [leftElbowAngle, setLeftElbowAngle] = useState<number | null>(null)
  const [rightElbowAngle, setRightElbowAngle] = useState<number | null>(null)
  const [midShoulderY, setMidShoulderY] = useState<number | null>(null)
  const [poseDetected, setPoseDetected] = useState(false)
  const [plankValid, setPlankValid] = useState(false)
  const [setupStatus, setSetupStatus] = useState<SetupStatus>('camera-loading')
  const [missingParts, setMissingParts] = useState<MissingPart[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visibilityWarning, setVisibilityWarning] = useState(false)
  const [postureWarning, setPostureWarning] = useState(false)

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    const videoElementAtMount = videoRef.current

    setIsLoading(true)
    setError(null)
    setLeftElbowAngle(null)
    setRightElbowAngle(null)
    setMidShoulderY(null)
    setPoseDetected(false)
    setPlankValid(false)
    setSetupStatus('camera-loading')
    setMissingParts([])
    setVisibilityWarning(false)
    setPostureWarning(false)
    lowVisibilityFramesRef.current = 0
    invalidPlankFramesRef.current = 0

    const drawArm = (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      shoulder: Landmark,
      elbow: Landmark,
      wrist: Landmark,
      angle: number,
    ) => {
      const sx = shoulder.x * canvas.width
      const sy = shoulder.y * canvas.height
      const ex = elbow.x * canvas.width
      const ey = elbow.y * canvas.height
      const wx = wrist.x * canvas.width
      const wy = wrist.y * canvas.height

      ctx.lineWidth = 3
      ctx.strokeStyle = '#f0ede8'
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.lineTo(wx, wy)
      ctx.stroke()

      ctx.fillStyle = '#f0ede8'
      const points: Array<[number, number]> = [
        [sx, sy],
        [ex, ey],
        [wx, wy],
      ]
      for (const [x, y] of points) {
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fill()
      }

      const label = `${Math.round(angle)} deg`
      ctx.font = '600 16px "IBM Plex Mono", ui-monospace, monospace'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#0a0a0a'
      ctx.fillText(label, ex + 13, ey - 21)
      ctx.fillStyle = '#f0ede8'
      ctx.fillText(label, ex + 12, ey - 22)
    }

    const drawBodyAxis = (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => {
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(240, 237, 232, 0.35)'
      ctx.beginPath()
      ctx.moveTo(a.x * canvas.width, a.y * canvas.height)
      ctx.lineTo(b.x * canvas.width, b.y * canvas.height)
      ctx.stroke()
    }

    const handleResults = (results: PoseResults) => {
      const canvas = canvasRef.current
      const video = videoRef.current
      if (!canvas || !video) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const targetWidth = video.videoWidth || 640
      const targetHeight = video.videoHeight || 480
      if (canvas.width !== targetWidth) canvas.width = targetWidth
      if (canvas.height !== targetHeight) canvas.height = targetHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const landmarks = results.poseLandmarks
      if (!landmarks || landmarks.length < 29) {
        setPoseDetected(false)
        setSetupStatus('no-pose')
        setMissingParts([])
        return
      }

      const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER]
      const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
      const le = landmarks[POSE_LANDMARKS.LEFT_ELBOW]
      const re = landmarks[POSE_LANDMARKS.RIGHT_ELBOW]
      const lw = landmarks[POSE_LANDMARKS.LEFT_WRIST]
      const rw = landmarks[POSE_LANDMARKS.RIGHT_WRIST]
      const lh = landmarks[POSE_LANDMARKS.LEFT_HIP]
      const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP]
      const lk = landmarks[POSE_LANDMARKS.LEFT_KNEE]
      const rk = landmarks[POSE_LANDMARKS.RIGHT_KNEE]
      const la = landmarks[POSE_LANDMARKS.LEFT_ANKLE]
      const ra = landmarks[POSE_LANDMARKS.RIGHT_ANKLE]

      const visOk = (lm: Landmark | undefined) => (lm?.visibility ?? 0) >= VISIBILITY_THRESHOLD

      const elbowsVisible = visOk(le) && visOk(re)
      const shouldersVisible = visOk(ls) && visOk(rs)
      const hipsVisible = visOk(lh) && visOk(rh)
      const kneesVisible = visOk(lk) && visOk(rk)
      const anklesVisible = visOk(la) && visOk(ra)

      const fullBodyVisible =
        elbowsVisible && shouldersVisible && hipsVisible && kneesVisible && anklesVisible

      const missing: MissingPart[] = []
      if (!elbowsVisible) missing.push('arms')
      if (!shouldersVisible) missing.push('shoulders')
      if (!hipsVisible) missing.push('hips')
      if (!kneesVisible) missing.push('knees')
      if (!anklesVisible) missing.push('feet')
      setMissingParts(missing)

      if (fullBodyVisible) {
        lowVisibilityFramesRef.current = 0
        setVisibilityWarning(false)
      } else {
        lowVisibilityFramesRef.current += 1
        if (lowVisibilityFramesRef.current > LOW_VISIBILITY_FRAME_LIMIT) {
          setVisibilityWarning(true)
        }
      }

      if (!elbowsVisible) {
        setPoseDetected(false)
        setPlankValid(false)
        setSetupStatus('no-pose')
        return
      }

      const leftAngle = calculateAngle(ls, le, lw)
      const rightAngle = calculateAngle(rs, re, rw)
      setLeftElbowAngle(leftAngle)
      setRightElbowAngle(rightAngle)
      setPoseDetected(true)

      drawArm(ctx, canvas, ls, le, lw, leftAngle)
      drawArm(ctx, canvas, rs, re, rw, rightAngle)

      if (!fullBodyVisible) {
        setMidShoulderY(null)
        setPlankValid(false)
        setSetupStatus('frame-incomplete')
        return
      }

      const midShoulder = midpoint(ls, rs)
      const midHip = midpoint(lh, rh)
      const midAnkle = midpoint(la, ra)

      drawBodyAxis(ctx, canvas, midShoulder, midAnkle)

      // Rotation-invariant plank checks.
      const hipDev = perpendicularDistanceToLine(midHip, midShoulder, midAnkle)

      // Knees must be ~straight (~180 degrees) to reject knee pushups. A genuinely straight
      // leg measures 175-180; a knee pushup is around 90.
      const leftKneeAngle = calculateAngle(lh, lk, la)
      const rightKneeAngle = calculateAngle(rh, rk, ra)
      const kneesStraight =
        leftKneeAngle >= KNEE_STRAIGHT_MIN_DEG && rightKneeAngle >= KNEE_STRAIGHT_MIN_DEG

      const axis = bodyAxisDirection(midShoulder, midAnkle)
      const shoulderWidth = Math.abs(ls.x - rs.x)
      const leftWristDev = wristAlignmentRatio(ls, lw, shoulderWidth, axis)
      const rightWristDev = wristAlignmentRatio(rs, rw, shoulderWidth, axis)
      const wristsAligned =
        leftWristDev <= WRIST_ALIGN_MAX_RATIO && rightWristDev <= WRIST_ALIGN_MAX_RATIO

      const plank = hipDev <= PLANK_HIP_DEVIATION_MAX && kneesStraight && wristsAligned

      setMidShoulderY(midShoulder.y)
      setPlankValid(plank)
      setSetupStatus(plank ? 'ready' : 'not-in-plank')

      if (plank) {
        invalidPlankFramesRef.current = 0
        setPostureWarning(false)
      } else {
        invalidPlankFramesRef.current += 1
        if (invalidPlankFramesRef.current > INVALID_PLANK_FRAME_LIMIT) {
          setPostureWarning(true)
        }
      }
    }

    const start = async () => {
      try {
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false,
          })
        } catch (err) {
          console.error('getUserMedia failed', err)
          throw new Error('CAMERA ACCESS DENIED')
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        const video = videoRef.current
        if (!video) {
          stream.getTracks().forEach((track) => track.stop())
          throw new Error('VIDEO ELEMENT MISSING')
        }
        streamRef.current = stream
        video.srcObject = stream
        try {
          await video.play()
        } catch (err) {
          console.error('video.play() failed', err)
        }

        if (cancelled) return
        setIsLoading(false)
        setSetupStatus('no-pose')

        try {
          await loadMediaPipeScripts()
        } catch (err) {
          console.error('mediapipe script load failed', err)
          throw new Error('FAILED TO LOAD MEDIAPIPE')
        }
        if (cancelled) return

        if (!window.Pose || !window.Camera) {
          throw new Error('MEDIAPIPE GLOBALS UNAVAILABLE')
        }

        const pose = new window.Pose({
          locateFile: (file: string) => `${MEDIAPIPE_CDN.POSE_BASE}/${file}`,
        })
        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.3,
          minTrackingConfidence: 0.3,
        })
        pose.onResults(handleResults)
        poseRef.current = pose

        const camera = new window.Camera(video, {
          onFrame: async () => {
            if (!poseRef.current) return
            try {
              await poseRef.current.send({ image: video })
            } catch (err) {
              console.error('pose.send failed', err)
            }
          },
          width: 640,
          height: 480,
        })
        cameraRef.current = camera
        try {
          await camera.start()
        } catch (err) {
          console.error('camera.start failed', err)
          throw new Error('CAMERA PIPELINE FAILED')
        }
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'POSE INIT FAILED'
        setError(message)
        setIsLoading(false)
      }
    }

    void start()

    return () => {
      cancelled = true
      try {
        cameraRef.current?.stop()
      } catch (err) {
        console.error('camera stop failed', err)
      }
      try {
        poseRef.current?.close()
      } catch (err) {
        console.error('pose close failed', err)
      }
      const stream = streamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      streamRef.current = null
      cameraRef.current = null
      poseRef.current = null
      if (videoElementAtMount) videoElementAtMount.srcObject = null
    }
  }, [retryToken])

  return {
    videoRef,
    canvasRef,
    leftElbowAngle,
    rightElbowAngle,
    midShoulderY,
    poseDetected,
    plankValid,
    setupStatus,
    missingParts,
    isLoading,
    error,
    visibilityWarning,
    postureWarning,
    retry,
  }
}
