'use client'

import { asset } from './asset-path'

/**
 * Voiceover playback for the introduction.
 *
 * One clip per line of copy, cued by the master timeline at the same moment the
 * line appears. Clips are triggered, never scrubbed: seeking an HTMLAudioElement
 * every frame to chase a timeline produces audible stutter, and the intro plays
 * linearly anyway. Skipping stops everything rather than fast-forwarding.
 *
 * Sound now defaults to ON, but that is an INTENT, not a guarantee. Browsers
 * block audio playback until the user has interacted with the page, so on a
 * cold load the first cues will be refused however the preference is set.
 *
 * Rather than lose those lines, a refused cue is remembered. The first click,
 * tap or keypress arms playback and picks the narration up at the point the
 * timeline has actually reached — mid-sentence if need be — so the audio
 * rejoins in sync instead of restarting from the top.
 *
 * The choice is persisted, and browsers grant autoplay to sites the user has
 * engaged with before, so returning visitors generally do get sound from frame
 * one.
 *
 * A missing file is not an error. Whichever clips exist play; the rest are
 * skipped, so the sequence works with a partial set.
 */

const DIR = '/audio'
const PREF_KEY = 'wipely:sound'

/** volume for narration; leaves headroom if music is ever layered under it */
const VOLUME = 0.9

type Clip = {
  el: HTMLAudioElement
  /** false once the file has failed to load, so we stop retrying it */
  ok: boolean
}

class Voiceover {
  private clips = new Map<string, Clip>()
  private enabled = true
  private playing: HTMLAudioElement[] = []
  /** a cue the browser refused, kept so it can be resumed on first gesture */
  private pending: { id: string; cueAt: number } | null = null
  /** reads the master timeline's current position, for resuming mid-clip */
  private timeSource: (() => number) | null = null
  private armed = false

  /** Create the audio elements up front so cues do not lag on first play. */
  preload(ids: string[]) {
    if (typeof window === 'undefined') return
    for (const id of ids) {
      if (this.clips.has(id)) continue
      const el = new Audio(asset(`${DIR}/${id}.mp3`))
      el.preload = 'auto'
      el.volume = VOLUME
      const clip: Clip = { el, ok: true }
      // A 404 is expected while clips are still being recorded.
      el.addEventListener('error', () => {
        clip.ok = false
      })
      this.clips.set(id, clip)
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(PREF_KEY, on ? 'on' : 'off')
      } catch {
        /* private browsing; the default still applies for this session */
      }
    }
    if (!on) {
      this.pending = null
      this.stopAll()
    }
  }

  /** Restore the saved preference. Defaults to on when nothing is stored. */
  loadPreference() {
    if (typeof window === 'undefined') return this.enabled
    try {
      const v = window.localStorage.getItem(PREF_KEY)
      this.enabled = v === null ? true : v === 'on'
    } catch {
      this.enabled = true
    }
    return this.enabled
  }

  setTimeSource(fn: () => number) {
    this.timeSource = fn
  }

  /**
   * Listen once for a real user gesture and resume whatever the browser
   * refused. Offsets into the clip by however long ago its cue fired, so the
   * narration rejoins the timeline in sync rather than replaying.
   */
  armOnFirstGesture() {
    if (this.armed || typeof window === 'undefined') return
    this.armed = true

    const fire = () => {
      window.removeEventListener('pointerdown', fire)
      window.removeEventListener('keydown', fire)
      window.removeEventListener('touchstart', fire)

      const p = this.pending
      this.pending = null
      if (!p || !this.enabled) return

      const clip = this.clips.get(p.id)
      if (!clip || !clip.ok) return
      const now = this.timeSource?.() ?? p.cueAt
      const offset = now - p.cueAt
      if (!Number.isFinite(clip.el.duration) || offset >= clip.el.duration) return

      clip.el.currentTime = Math.max(0, offset)
      void clip.el.play().catch(() => {})
      this.playing.push(clip.el)
    }

    window.addEventListener('pointerdown', fire, { once: true })
    window.addEventListener('keydown', fire, { once: true })
    window.addEventListener('touchstart', fire, { once: true })
  }

  isEnabled() {
    return this.enabled
  }

  play(id: string) {
    if (!this.enabled) return
    const clip = this.clips.get(id)
    if (!clip || !clip.ok) return
    clip.el.currentTime = 0
    // A rejection here is the autoplay policy, not a fault. Remember the cue so
    // the first gesture can pick it up at the right point.
    void clip.el.play().catch(() => {
      this.pending = { id, cueAt: this.timeSource?.() ?? 0 }
    })
    this.playing.push(clip.el)
  }

  stopAll() {
    for (const el of this.playing) {
      el.pause()
      el.currentTime = 0
    }
    this.playing = []
  }

  dispose() {
    this.stopAll()
    this.clips.forEach(({ el }) => {
      el.src = ''
    })
    this.clips.clear()
  }

  /**
   * Actual clip durations, once loaded. Used to check the authored line timings
   * against the recordings — if a clip runs longer than the gap before the next
   * line, the two will talk over each other.
   */
  durations(): Record<string, number> {
    const out: Record<string, number> = {}
    this.clips.forEach(({ el, ok }, id) => {
      if (ok && Number.isFinite(el.duration) && el.duration > 0) out[id] = el.duration
    })
    return out
  }
}

export const voiceover = new Voiceover()
