#!/usr/bin/env node
/**
 * Check the voiceover clips against the cue times in content/copy.ts.
 *
 * Each clip that arrives shifts the ones after it, and patching timings by hand
 * one upload at a time is how lines end up talking over each other. This reads
 * the real durations and reports every collision at once.
 *
 *   node scripts/check-vo.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const AUDIO = 'public/audio'

/* ---- clip duration ---- */
function duration(file) {
  // afinfo is macOS and exact; fall back to a CBR estimate elsewhere.
  try {
    const out = execFileSync('afinfo', [file], { encoding: 'utf8' })
    const m = out.match(/estimated duration:\s*([\d.]+)/)
    if (m) return { secs: Number(m[1]), exact: true }
  } catch {
    /* not macOS, or afinfo missing */
  }
  const bytes = readFileSync(file).length
  const br = readFileSync(file).toString('binary').match(/\xFF[\xE0-\xFF]/) ? 32000 : 32000
  return { secs: (bytes * 8) / br, exact: false }
}

/* ---- cue times, read straight out of the copy file ---- */
const copy = readFileSync('content/copy.ts', 'utf8')

const lines = []
const re = /id:\s*'([^']+)'[\s\S]{0,400}?in:\s*([\d.]+),\s*\n?\s*(?:\/\*[\s\S]*?\*\/\s*)?out:\s*([\d.]+)/g
for (const m of copy.matchAll(/\{\s*id:\s*'(l\d)'[\s\S]*?in:\s*([\d.]+)[\s\S]*?out:\s*([\d.]+)/g)) {
  lines.push({ id: m[1], in: Number(m[2]), out: Number(m[3]) })
}
// All three mechanism steps are one recording, cued from the timeline.
lines.push({ id: 'steps', in: 19.1, out: null })
lines.sort((a, b) => a.in - b.in)

/* ---- report ---- */
const present = existsSync(AUDIO) ? readdirSync(AUDIO).filter((f) => f.endsWith('.mp3')) : []
console.log(`\n${present.length} clip(s) installed in ${AUDIO}\n`)

const rows = []
let problems = 0

lines.forEach((l, i) => {
  const file = `${AUDIO}/${l.id}.mp3`
  const next = lines[i + 1]
  const gap = next ? next.in - l.in : Infinity

  if (!existsSync(file)) {
    rows.push([l.id, '—', l.in.toFixed(2), '—', gap === Infinity ? '—' : gap.toFixed(2), 'not recorded'])
    return
  }

  const { secs } = duration(file)
  const ends = l.in + secs
  const clear = next ? next.in - ends : Infinity

  const notes = []
  if (clear < 0) {
    notes.push(`OVERLAPS ${next.id} by ${Math.abs(clear).toFixed(2)}s`)
    problems++
  } else if (clear < 0.15 && next) {
    notes.push(`only ${clear.toFixed(2)}s clear`)
  }
  if (l.out !== null && l.out < ends) {
    notes.push(`text leaves ${(ends - l.out).toFixed(2)}s early`)
    problems++
  }

  rows.push([
    l.id,
    secs.toFixed(2),
    l.in.toFixed(2),
    ends.toFixed(2),
    clear === Infinity ? '—' : clear.toFixed(2),
    notes.join('; ') || 'ok',
  ])
})

const head = ['clip', 'dur', 'cue', 'ends', 'clear', 'status']
const w = head.map((h, c) => Math.max(h.length, ...rows.map((r) => String(r[c]).length)))
const fmt = (r) => r.map((v, c) => String(v).padEnd(w[c])).join('  ')
console.log(fmt(head))
console.log(w.map((n) => '-'.repeat(n)).join('  '))
rows.forEach((r) => console.log(fmt(r)))

console.log(
  problems === 0
    ? '\nNo collisions.\n'
    : `\n${problems} problem(s) above need the cue times adjusting.\n`
)
