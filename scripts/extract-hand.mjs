#!/usr/bin/env node
/**
 * Pull one hand out of the dense Sketchfab download and decimate it.
 *
 * The source is 15 MB: four near-duplicate hands, 288k vertices, ~560k
 * triangles, and no skinning of any kind. We need exactly one right hand, at a
 * density that (a) can be auto-rigged — the finger clustering needs enough
 * vertices to separate fingers, which the 786-triangle model did not have — and
 * (b) is small enough to ship.
 *
 * Decimation is grid vertex-clustering: quantise vertices into cells, collapse
 * each cell to its centroid, rebuild the triangles. It is not as tidy as
 * quadric-error simplification, but it needs no dependencies, it is
 * deterministic, and on an organic blob like a hand the difference is not
 * visible at our framings.
 *
 *   node scripts/extract-hand.mjs <src.glb> <out.glb> [targetVerts]
 */

import { readFileSync, writeFileSync } from 'node:fs'

const [srcPath, outPath, targetArg] = process.argv.slice(2)
if (!srcPath || !outPath) {
  console.error('usage: node scripts/extract-hand.mjs <src.glb> <out.glb> [targetVerts]')
  process.exit(1)
}
const TARGET = Number(targetArg ?? 14000)

/* ------------------------------- read GLB ------------------------------- */
const buf = readFileSync(srcPath)
const jsonLen = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'))
let off = 20 + jsonLen
off += (4 - (off % 4)) % 4
const bin = buf.slice(off + 8, off + 8 + buf.readUInt32LE(off))

const COMPONENT = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const NUMCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }

function readAccessor(i) {
  const a = gltf.accessors[i]
  const bv = gltf.bufferViews[a.bufferView]
  const comp = COMPONENT[a.componentType]
  const n = NUMCOMP[a.type]
  const stride = bv.byteStride || comp * n
  const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
  const out = []
  for (let k = 0; k < a.count; k++) {
    const o = base + k * stride
    const v = []
    for (let c = 0; c < n; c++) {
      const p = o + c * comp
      if (a.componentType === 5126) v.push(bin.readFloatLE(p))
      else if (a.componentType === 5125) v.push(bin.readUInt32LE(p))
      else if (a.componentType === 5123) v.push(bin.readUInt16LE(p))
      else if (a.componentType === 5121) v.push(bin.readUInt8(p))
      else v.push(0)
    }
    out.push(n === 1 ? v[0] : v)
  }
  return out
}

/* ---- world matrix of a node, so the extracted mesh keeps its placement ---- */
function nodeMatrix(n) {
  if (n.matrix) return n.matrix.slice()
  const t = n.translation ?? [0, 0, 0]
  const q = n.rotation ?? [0, 0, 0, 1]
  const s = n.scale ?? [1, 1, 1]
  const [x, y, z, w] = q
  const x2 = x + x, y2 = y + y, z2 = z + z
  const xx = x * x2, xy = x * y2, xz = x * z2
  const yy = y * y2, yz = y * z2, zz = z * z2
  const wx = w * x2, wy = w * y2, wz = w * z2
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ]
}
const mul = (a, b) => {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}
const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
]

/* ---- find the largest mesh under a node named like a right hand ---- */
const parentOf = new Map()
gltf.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentOf.set(c, i)))
const worldOf = (i) => {
  let m = nodeMatrix(gltf.nodes[i])
  let p = parentOf.get(i)
  while (p !== undefined) {
    m = mul(nodeMatrix(gltf.nodes[p]), m)
    p = parentOf.get(p)
  }
  return m
}

let best = null
gltf.nodes.forEach((n, i) => {
  if (n.mesh == null) return
  const count = gltf.meshes[n.mesh].primitives.reduce(
    (s, p) => s + gltf.accessors[p.attributes.POSITION].count,
    0
  )
  // the hand proper is the dense mesh; the small sibling is nails/detail
  if (!best || count > best.count) best = { node: i, mesh: n.mesh, count }
})
console.log(`picked node ${gltf.nodes[best.node].name} -> mesh ${best.mesh} (${best.count} verts)`)

const world = worldOf(best.node)
const prim = gltf.meshes[best.mesh].primitives[0]
const rawPos = readAccessor(prim.attributes.POSITION).map((p) => apply(world, p))
const rawIdx = readAccessor(prim.indices)

/* ----------------------------- decimate --------------------------------- */
const min = [Infinity, Infinity, Infinity]
const max = [-Infinity, -Infinity, -Infinity]
for (const p of rawPos)
  for (let i = 0; i < 3; i++) {
    if (p[i] < min[i]) min[i] = p[i]
    if (p[i] > max[i]) max[i] = p[i]
  }
const size = max.map((v, i) => v - min[i])
const span = Math.max(...size)

function decimate(res) {
  const cell = span / res
  const map = new Map()
  const remap = new Int32Array(rawPos.length)
  const acc = []
  for (let i = 0; i < rawPos.length; i++) {
    const p = rawPos[i]
    const key =
      Math.floor((p[0] - min[0]) / cell) * 1e8 +
      Math.floor((p[1] - min[1]) / cell) * 1e4 +
      Math.floor((p[2] - min[2]) / cell)
    let id = map.get(key)
    if (id === undefined) {
      id = acc.length
      map.set(key, id)
      acc.push([0, 0, 0, 0])
    }
    const a = acc[id]
    a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++
    remap[i] = id
  }
  const verts = acc.map((a) => [a[0] / a[3], a[1] / a[3], a[2] / a[3]])
  const tris = []
  for (let i = 0; i < rawIdx.length; i += 3) {
    const a = remap[rawIdx[i]], b = remap[rawIdx[i + 1]], c = remap[rawIdx[i + 2]]
    if (a !== b && b !== c && a !== c) tris.push(a, b, c)
  }
  return { verts, tris }
}

// binary search the grid resolution for the requested vertex budget
let lo = 20, hi = 400, result = null
for (let step = 0; step < 12; step++) {
  const mid = Math.round((lo + hi) / 2)
  const r = decimate(mid)
  if (!result || Math.abs(r.verts.length - TARGET) < Math.abs(result.verts.length - TARGET)) {
    result = r
  }
  if (r.verts.length > TARGET) hi = mid
  else lo = mid
}
const { verts, tris } = result
console.log(`decimated: ${rawPos.length} -> ${verts.length} verts, ${rawIdx.length / 3} -> ${tris.length / 3} tris`)

/* ---- recompute normals from the decimated topology ---- */
const nrm = verts.map(() => [0, 0, 0])
for (let i = 0; i < tris.length; i += 3) {
  const a = verts[tris[i]], b = verts[tris[i + 1]], c = verts[tris[i + 2]]
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  for (const k of [tris[i], tris[i + 1], tris[i + 2]]) {
    nrm[k][0] += n[0]; nrm[k][1] += n[1]; nrm[k][2] += n[2]
  }
}
for (const n of nrm) {
  const L = Math.hypot(n[0], n[1], n[2]) || 1
  n[0] /= L; n[1] /= L; n[2] /= L
}

/* ------------------------------ write GLB ------------------------------- */
const posBuf = Buffer.alloc(verts.length * 12)
const nrmBuf = Buffer.alloc(verts.length * 12)
verts.forEach((p, i) => {
  posBuf.writeFloatLE(p[0], i * 12); posBuf.writeFloatLE(p[1], i * 12 + 4); posBuf.writeFloatLE(p[2], i * 12 + 8)
  nrmBuf.writeFloatLE(nrm[i][0], i * 12); nrmBuf.writeFloatLE(nrm[i][1], i * 12 + 4); nrmBuf.writeFloatLE(nrm[i][2], i * 12 + 8)
})
const idxBuf = Buffer.alloc(tris.length * 4)
tris.forEach((v, i) => idxBuf.writeUInt32LE(v, i * 4))

/*
 * Chunk padding, per the glTF spec: the JSON chunk pads with SPACES (0x20) and
 * the BIN chunk pads with zeros. Padding JSON with zeros produces a file whose
 * declared chunk length includes trailing NULs, and every conformant parser
 * then fails on JSON.parse.
 */
const pad = (b, fill = 0) =>
  b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), fill)]) : b
const binOut = Buffer.concat([pad(posBuf), pad(nrmBuf), pad(idxBuf)])

const vmin = [0, 1, 2].map((i) => Math.min(...verts.map((p) => p[i])))
const vmax = [0, 1, 2].map((i) => Math.max(...verts.map((p) => p[i])))

const out = {
  asset: { version: '2.0', generator: 'wipely extract-hand' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'Hand' }],
  meshes: [{ name: 'Hand', primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: verts.length, type: 'VEC3', min: vmin, max: vmax },
    { bufferView: 1, componentType: 5126, count: verts.length, type: 'VEC3' },
    { bufferView: 2, componentType: 5125, count: tris.length, type: 'SCALAR' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 },
    { buffer: 0, byteOffset: pad(posBuf).length, byteLength: nrmBuf.length, target: 34962 },
    { buffer: 0, byteOffset: pad(posBuf).length + pad(nrmBuf).length, byteLength: idxBuf.length, target: 34963 },
  ],
  buffers: [{ byteLength: binOut.length }],
}

const jsonOut = pad(Buffer.from(JSON.stringify(out), 'utf8'), 0x20)
const header = Buffer.alloc(12)
header.write('glTF', 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + jsonOut.length + 8 + binOut.length, 8)
const jsonHdr = Buffer.alloc(8)
jsonHdr.writeUInt32LE(jsonOut.length, 0)
jsonHdr.writeUInt32LE(0x4e4f534a, 4)
const binHdr = Buffer.alloc(8)
binHdr.writeUInt32LE(binOut.length, 0)
binHdr.writeUInt32LE(0x004e4942, 4)

writeFileSync(outPath, Buffer.concat([header, jsonHdr, jsonOut, binHdr, binOut]))
console.log(`wrote ${outPath} — ${(Buffer.concat([header, jsonHdr, jsonOut, binHdr, binOut]).length / 1024).toFixed(0)} KB`)
