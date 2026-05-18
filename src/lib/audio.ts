export type AudioClipKey = 'down' | 'up'

const CLIP_URLS: Record<AudioClipKey, string> = {
  down: '/audio/down.mp3',
  up: '/audio/up.mp3',
}

type AudioCtxCtor = typeof AudioContext

function resolveAudioContextCtor(): AudioCtxCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    AudioContext?: AudioCtxCtor
    webkitAudioContext?: AudioCtxCtor
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export class AudioMediator {
  private context: AudioContext | null = null
  private buffers: Partial<Record<AudioClipKey, AudioBuffer>> = {}
  private loading: Promise<void> | null = null

  async preload(): Promise<void> {
    if (this.loading) return this.loading
    this.loading = this.doPreload().catch((err) => {
      this.loading = null
      throw err
    })
    return this.loading
  }

  private async doPreload(): Promise<void> {
    const Ctor = resolveAudioContextCtor()
    if (!Ctor) return
    try {
      this.context = new Ctor()
      if (this.context.state === 'suspended') {
        try {
          await this.context.resume()
        } catch (err) {
          console.error('audio context resume failed', err)
        }
      }
      const entries = await Promise.all(
        (Object.keys(CLIP_URLS) as AudioClipKey[]).map(async (key) => {
          const buf = await this.loadClip(CLIP_URLS[key])
          return [key, buf] as const
        }),
      )
      for (const [key, buf] of entries) {
        this.buffers[key] = buf
      }
    } catch (err) {
      console.error('audio preload failed', err)
      throw err
    }
  }

  private async loadClip(url: string): Promise<AudioBuffer> {
    if (!this.context) throw new Error('audio context missing')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`audio fetch failed ${res.status} for ${url}`)
    const arr = await res.arrayBuffer()
    return await new Promise<AudioBuffer>((resolve, reject) => {
      this.context!.decodeAudioData(arr, resolve, reject)
    })
  }

  play(key: AudioClipKey): void {
    const ctx = this.context
    const buf = this.buffers[key]
    if (!ctx || !buf) return
    try {
      const source = ctx.createBufferSource()
      source.buffer = buf
      source.connect(ctx.destination)
      source.start()
    } catch (err) {
      console.error('audio play failed', err)
    }
  }

  dispose(): void {
    try {
      this.context?.close()
    } catch (err) {
      console.error('audio context close failed', err)
    }
    this.context = null
    this.buffers = {}
    this.loading = null
  }
}
