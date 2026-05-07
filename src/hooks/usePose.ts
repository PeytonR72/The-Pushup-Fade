'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  calculateAngle,
  loadMediaPipeScripts,
  MEDIAPIPE_CDN,
  POSE_LANDMARKS,
  type CameraInstance,
  type Landmark,
  type PoseInstance,
  type PoseResults,
} from '@/lib/mediapipe'

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
  retry: () => void
}

const VISIBILITY_THRESHOLD = 0.5
const LOW_VISIBILITY_FRAME_LIMIT = 10

export function usePose(): UsePoseReturn {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const poseRef = useRef<PoseInstance | null>(null)
  const cameraRef = useRef<CameraInstance | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const activeSideRef = useRef<ActiveSide | null>(null)
  const lowVisibilityFramesRef = useRef(0)

  const [retryToken, setRetryToken] = useState(0)
  const [elbowAngle, setElbowAngle] = useState<number | null>(null)
  const [poseDetected, setPoseDetected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visibilityWarning, setVisibilityWarning] = useState(false)
  const [activeSide, setActiveSide] = useState<ActiveSide | null>(null)

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    const videoElementAtMount = videoRef.current

    setIsLoading(true)
    setError(null)
    setElbowAngle(null)
    setPoseDetected(false)
    setVisibilityWarning(false)
    setActiveSide(null)
    activeSideRef.current = null
    lowVisibilityFramesRef.current = 0

    const drawOverlay = (
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
      ctx.font = '600 18px "IBM Plex Mono", ui-monospace, monospace'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#0a0a0a'
      ctx.fillText(label, ex + 13, ey - 23)
      ctx.fillStyle = '#f0ede8'
      ctx.fillText(label, ex + 12, ey - 24)
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
      if (!landmarks || landmarks.length < 17) {
        setPoseDetected(false)
        return
      }

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
        lowVisibilityFramesRef.current += 1
        if (lowVisibilityFramesRef.current > LOW_VISIBILITY_FRAME_LIMIT) {
          setVisibilityWarning(true)
        }
      } else {
        lowVisibilityFramesRef.current = 0
        setVisibilityWarning(false)
      }

      const angle = calculateAngle(shoulder, elbow, wrist)
      setElbowAngle(angle)
      setPoseDetected(true)

      drawOverlay(ctx, canvas, shoulder, elbow, wrist, angle)
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
    elbowAngle,
    poseDetected,
    isLoading,
    error,
    visibilityWarning,
    activeSide,
    retry,
  }
}
