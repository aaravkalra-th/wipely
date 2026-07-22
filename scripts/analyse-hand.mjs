#!/usr/bin/env node
/**
 * Work out the structure of the static hand mesh so it can be deformed.
 *
 * The model has no skeleton, so the finger geometry has to be discovered from
 * the vertices themselves: which axis runs along the hand, which end is the
 * fingertips, and which vertices belong to which finger. Doing this offline
 * first means the runtime code is written against measured facts rather than
 * assumptions — the character asset burned a lot of time on exactly that.
 *
 *   node scripts/analyse-hand.mjs public/models/hand.glb
 */

import { readFileSync } from 'node:fs'

const file = process.argv[2] ?? 'public/models/hand.glb'
const buf = readFileSync(file)

/* ---- parse GLB chunks ---- */
const jsonLen = buf.readUInt32LE(12)
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'))
let off = 20 + jsonLen
off += (4 - (off % 4)) % 4
const binLen = buf.readUInt32LE(off)
const bin = buf.slice(off + 8, off + 8 + binLen)

function readVec3(accessorIndex) {
  const acc = json.accessors[accessorIndex]
  const bv = json.bufferViews[acc.bufferView]
  const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const stride = bv.byteStride ?? 12
  const out = []
  for (let i = 0; i < acc.count; i++) {
    const o = base + i * stride
    out.push([bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8)])
  }
  return out
}

const pts = readVec3(json.meshes[0].primitives[0].attributes.POSITION)
console.log(`vertices: ${pts.length}`)

/* ---- bounds and the dominant axis ---- */
const min = [Infinity, Infinity, Infinity]
const max = [-Infinity, -Infinity, -Infinity]
for (const p of pts)
  for (let i = 0; i < 3; i++) {
    if (p[i] < min[i]) min[i] = p[i]
    if (p[i] > max[i]) max[i] = p[i]
  }
const size = max.map((v, i) => v - min[i])
console.log('bounds  :', size.map((v) => v.toFixed(1)).join(' x '))

const axis = size.indexOf(Math.max(...size))
const AX = ['X', 'Y', 'Z'][axis]
console.log(`long axis: ${AX} (${size[axis].toFixed(1)})`)

/* ---- which end is the fingers? count separated lumps in a slice ---- */
const other = [0, 1, 2].filter((i) => i !== axis)

function clustersInSlice(lo, hi) {
  const slice = pts.filter((p) => {
    const t = (p[axis] - min[axis]) / size[axis]
    return t >= lo && t <= hi
  })
  if (slice.length < 4) return { n: 0, count: slice.length }
  // single-link clustering in the plane perpendicular to the long axis
  const thresh = Math.max(size[other[0]], size[other[1]]) * 0.14
  const seen = new Array(slice.length).fill(-1)
  let n = 0
  for (let i = 0; i < slice.length; i++) {
    if (seen[i] !== -1) continue
    const queue = [i]
    seen[i] = n
    while (queue.length) {
      const a = queue.pop()
      for (let b = 0; b < slice.length; b++) {
        if (seen[b] !== -1) continue
        const d = Math.hypot(
          slice[a][other[0]] - slice[b][other[0]],
          slice[a][other[1]] - slice[b][other[1]]
        )
        if (d < thresh) {
          seen[b] = n
          queue.push(b)
        }
      }
    }
    n++
  }
  return { n, count: slice.length }
}

console.log('\nlumps per slice along the long axis (5 = fingers, 1 = forearm):')
for (let i = 0; i < 10; i++) {
  const lo = i / 10
  const hi = (i + 1) / 10
  const r = clustersInSlice(lo, hi)
  console.log(
    `  ${lo.toFixed(1)}-${hi.toFixed(1)}  lumps=${String(r.n).padStart(2)}  verts=${r.count}`
  )
}

/* ---- if one end has ~5 lumps, report their centroids ---- */
function report(lo, hi, label) {
  const slice = pts.filter((p) => {
    const t = (p[axis] - min[axis]) / size[axis]
    return t >= lo && t <= hi
  })
  const thresh = Math.max(size[other[0]], size[other[1]]) * 0.14
  const seen = new Array(slice.length).fill(-1)
  const groups = []
  for (let i = 0; i < slice.length; i++) {
    if (seen[i] !== -1) continue
    const g = []
    const queue = [i]
    seen[i] = groups.length
    while (queue.length) {
      const a = queue.pop()
      g.push(slice[a])
      for (let b = 0; b < slice.length; b++) {
        if (seen[b] !== -1) continue
        const d = Math.hypot(
          slice[a][other[0]] - slice[b][other[0]],
          slice[a][other[1]] - slice[b][other[1]]
        )
        if (d < thresh) {
          seen[b] = groups.length
          queue.push(b)
        }
      }
    }
    groups.push(g)
  }
  console.log(`\n${label} (slice ${lo}-${hi}): ${groups.length} groups`)
  groups
    .sort((a, b) => b.length - a.length)
    .forEach((g, i) => {
      const c = [0, 1, 2].map((k) => g.reduce((s, p) => s + p[k], 0) / g.length)
      console.log(
        `  group ${i}: ${String(g.length).padStart(3)} verts  centroid=[${c
          .map((v) => v.toFixed(1))
          .join(', ')}]`
      )
    })
}

report(0.0, 0.18, 'LOW end')
report(0.82, 1.0, 'HIGH end')
