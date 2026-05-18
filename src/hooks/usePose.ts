'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
<<<<<<< HEAD
  bodyAxisAngleFromHorizontal,
  calculateAngle,
  hipDeviationFromAxis,
  loadMediaPipeScripts,
  MEDIAPIPE_CDN,
  midpoint,
  PLANK_AXIS_ANGLE_MAX_DEG,
  PLANK_HIP_DEVIATION_MAX,
=======
  calculateAngle,
  loadMediaPipeScripts,
  MEDIAPIPE_CDN,
>>>>>>> origin/main
  POSE_LANDMARKS,
  type CameraInstance,
  type Landmark,
  type PoseInstance,
  type PoseResults,
} from '@/lib/mediapipe'

<<<<<<< HEAD
export interface UsePoseReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  leftElbowAngle: number | null
  rightElbowAngle: number | null
  midShoulderY: number | null
  poseDetected: boolean
  plankValid: boolean
  isLoading: boolean
  error: string | null
  visibilityWarning: boolean
  postureWarning: boolean
=======
export type ActiveSide = 'left' | 'right'

export interface UsePoseReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  elbowAngle: number | null
  poseDetected: boolean
  isLoading: boolean
  error: string | null
  visibilityWarning: boolean
  activeSide: ActiveSide | null
>>>>>>> origin/main
  retry: () => void
}

const VISIBILITY_THRESHOLD = 0.5
const LOW_VISIBILITY_FRAME_LIMIT = 10
<<<<<<< HEAD
const INVALID_PLANK_FRAME_LIMIT = 10
=======
>>>>>>> origin/main

export function usePose(): UsePoseReturn {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const poseRef = useRef<PoseInstance | null>(null)
  const cameraRef = useRef<CameraInstance | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
<<<<<<< HEAD
  const lowVisibilityFramesRef = useRef(0)
  const invalidPlankFramesRef = useRef(0)

  const [retryToken, setRetryToken] = useState(0)
  const [leftElbowAngle, setLeftElbowAngle] = useState<number | null>(null)
  const [rightElbowAngle, setRightElbowAngle] = useState<number | null>(null)
  const [midShoulderY, setMidShoulderY] = useState<number | null>(null)
  const [poseDetected, setPoseDetected] = useState(false)
  const [plankValid, setPlankValid] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visibilityWarning, setVisibilityWarning] = useState(false)
  const [postureWarning, setPostureWarning] = useState(false)
=======
  const activeSideRef = useRef<ActiveSide | null>(null)
  const lowVisibilityFramesRef = useRef(0)

  const [retryToken, setRetryToken] = useState(0)
  const [elbowAngle, setElbowAngle] = useState<number | null>(null)
  const [poseDetected, setPoseDetected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visibilityWarning, setVisibilityWarning] = useState(false)
  const [activeSide, setActiveSide] = useState<ActiveSide | null>(null)
>>>>>>> origin/main

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    const videoElementAtMount = videoRef.current

    setIsLoading(true)
    setError(null)
<<<<<<< HEAD
    setLeftElbowAngle(null)
    setRightElbowAngle(null)
    setMidShoulderY(null)
    setPoseDetected(false)
    setPlankValid(false)
    setVisibilityWarning(false)
    setPostureWarning(false)
    lowVisibilityFramesRef.current = 0
    invalidPlankFramesRef.current = 0

    const drawArm = (
=======
    setElbowAngle(null)
    setPoseDetected(false)
    setVisibilityWarning(false)
    setActiveSide(null)
    activeSideRef.current = null
    lowVisibilityFramesRef.current = 0

    const drawOverlay = (
>>>>>>> origin/main
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
<<<<<<< HEAD
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
=======
      ctx.font = '600 18px "IBM Plex Mono", ui-monospace, monospace'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#0a0a0a'
      ctx.fillText(label, ex + 13, ey - 23)
      ctx.fillStyle = '#f0ede8'
      ctx.fillText(label, ex + 12, ey - 24)
>>>>>>> origin/main
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
<<<<<<< HEAD
      if (!landmarks || landmarks.length < 29) {
=======
      if (!landmarks || landmarks.length < 17) {
>>>>>>> origin/main
        setPoseDetected(false)
        return
      }

<<<<<<< HEAD
      const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER]
      const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
      const le = landmarks[POSE_LANDMARKS.LEFT_ELBOW]
      const re = landmarks[POSE_LANDMARKS.RIGHT_ELBOW]
      const lw = landmarks[POSE_LANDMARKS.LEFT_WRIST]
      const rw = landmarks[POSE_LANDMARKS.RIGHT_WRIST]
      const lh = landmarks[POSE_LANDMARKS.LEFT_HIP]
      const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP]
      const la = landmarks[POSE_LANDMARKS.LEFT_ANKLE]
      const ra = landmarks[POSE_LANDMARKS.RIGHT_ANKLE]

      const leftElbowVis = le?.visibility ?? 0
      const rightElbowVis = re?.visibility ?? 0
      const elbowsVisible =
        leftElbowVis >= VISIBILITY_THRESHOLD && rightElbowVis >= VISIBILITY_THRESHOLD

      const fullBodyVisible =
        elbowsVisible &&
        (ls?.visibility ?? 0) >= VISIBILITY_THRESHOLD &&
        (rs?.visibility ?? 0) >= VISIBILITY_THRESHOLD &&
        (lh?.visibility ?? 0) >= VISIBILITY_THRESHOLD &&
        (rh?.visibility ?? 0) >= VISIBILITY_THRESHOLD &&
        (la?.visibility ?? 0) >= VISIBILITY_THRESHOLD &&
        (ra?.visibility ?? 0) >= VISIBILITY_THRESHOLD

      if (fullBodyVisible) {
        lowVisibilityFramesRef.current = 0
        setVisibilityWarning(false)
      } else {
=======
      if (!activeSideRef.current) {
        const leftElbowVis = landmarks[POSE_LANDMARKS.LEFT_ELBOW]?.visibility ?? 0
        const rightElbowVis = landmarks[POSE_LANDMARKS.RIGHT_ELBOW]?.visibility ?? 0
        if (leftElbowVis < VISIBILITY_THRESHOLD && rightElbowVis < VISIBILITY_THRESHOLD) {
          setPoseDetected(false)
          return
        }
        const side: ActiveSide = leftElbowVis >= rightElbowVis ? 'left' : 'right'
        activeSideRef.current = side
        setActiveSide(side)
      }

      const side = activeSideRef.current
      const shoulderIdx =
        side === 'left' ? POSE_LANDMARKS.LEFT_SHOULDER : POSE_LANDMARKS.RIGHT_SHOULDER
      const elbowIdx = side === 'left' ? POSE_LANDMARKS.LEFT_ELBOW : POSE_LANDMARKS.RIGHT_ELBOW
      const wristIdx = side === 'left' ? POSE_LANDMARKS.LEFT_WRIST : POSE_LANDMARKS.RIGHT_WRIST

      const shoulder = landmarks[shoulderIdx]
      const elbow = landmarks[elbowIdx]
      const wrist = landmarks[wristIdx]

      const elbowVisibility = elbow.visibility ?? 0
      if (elbowVisibility < VISIBILITY_THRESHOLD) {
>>>>>>> origin/main
        lowVisibilityFramesRef.current += 1
        if (lowVisibilityFramesRef.current > LOW_VISIBILITY_FRAME_LIMIT) {
          setVisibilityWarning(true)
        }
<<<<<<< HEAD
      }

      if (!elbowsVisible) {
        setPoseDetected(false)
        setPlankValid(false)
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
        return
      }

      const midShoulder = midpoint(ls, rs)
      const midHip = midpoint(lh, rh)
      const midAnkle = midpoint(la, ra)

      drawBodyAxis(ctx, canvas, midShoulder, midAnkle)

      const axisAngle = bodyAxisAngleFromHorizontal(midShoulder, midAnkle)
      const hipDev = hipDeviationFromAxis(midShoulder, midHip, midAnkle)
      const plank =
        axisAngle <= PLANK_AXIS_ANGLE_MAX_DEG && hipDev <= PLANK_HIP_DEVIATION_MAX

      setMidShoulderY(midShoulder.y)
      setPlankValid(plank)

      if (plank) {
        invalidPlankFramesRef.current = 0
        setPostureWarning(false)
      } else {
        invalidPlankFramesRef.current += 1
        if (invalidPlankFramesRef.current > INVALID_PLANK_FRAME_LIMIT) {
          setPostureWarning(true)
        }
      }
=======
      } else {
        lowVisibilityFramesRef.current = 0
        setVisibilityWarning(false)
      }

      const angle = calculateAngle(shoulder, elbow, wrist)
      setElbowAngle(angle)
      setPoseDetected(true)

      drawOverlay(ctx, canvas, shoulder, elbow, wrist, angle)
>>>>>>> origin/main
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
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
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
<<<<<<< HEAD
    leftElbowAngle,
    rightElbowAngle,
    midShoulderY,
    poseDetected,
    plankValid,
    isLoading,
    error,
    visibilityWarning,
    postureWarning,
=======
    elbowAngle,
    poseDetected,
    isLoading,
    error,
    visibilityWarning,
    activeSide,
>>>>>>> origin/main
    retry,
  }
}
