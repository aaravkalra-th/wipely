#!/usr/bin/env node
/**
 * Print everything that matters about a .glb before integrating it.
 *
 * Integrating the character asset cost several wrong assumptions that all could
 * have been answered up front: whether it was skinned, what its real height was,
 * what the loader would rename its bones to. This prints those facts directly
 * from the file so the next asset does not repeat that.
 *
 *   npm run inspect:model -- public/models/hand.glb
 */

import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('usage: npm run inspect:model -- <path-to.glb>')
  process.exit(1)
}

const buf = readFileSync(file)
if (buf.toString('utf8', 0, 4) !== 'glTF') {
  console.error(`${file} is not a binary glTF (magic bytes are not "glTF").`)
  console.error('If this is a .gltf + .bin pair or an .obj, convert it to .glb first.')
  process.exit(1)
}

const json = JSON.parse(buf.slice(20, 20 + buf.readUInt32LE(12)).toString('utf8'))
const n = (a) => (a ?? []).length

/** three's GLTFLoader strips characters illegal in property-binding paths. */
const sanitize = (s) => (s ?? '').replace(/[\s.:/[\]]/g, '')

console.log(`\n=== ${file} — ${(buf.length / 1024).toFixed(0)} KB ===`)
console.log(`generator : ${json.asset?.generator ?? 'unknown'}`)
console.log(
  `counts    : ${n(json.meshes)} meshes, ${n(json.nodes)} nodes, ${n(json.skins)} skins, ` +
    `${n(json.materials)} materials, ${n(json.textures)} textures, ${n(json.images)} images`
)

/* ---- is it rigged? this is the question that decides the integration ---- */
if (n(json.skins) > 0) {
  const joints = json.skins[0].joints ?? []
  console.log(`\nRIGGED: yes — ${joints.length} joints`)
  const names = joints.map((i) => json.nodes[i]?.name).filter(Boolean)
  console.log('joints    :', names.join(', ') || '(unnamed)')
  const renamed = names.filter((x) => sanitize(x) !== x)
  if (renamed.length) {
    console.log('\n!! these names are RENAMED on import by three:')
    for (const r of renamed) console.log(`     "${r}"  ->  "${sanitize(r)}"`)
    console.log('   look them up by the sanitised name, or they resolve to undefined.')
  }
} else {
  console.log('\nRIGGED: NO — static mesh, no skeleton.')
  console.log('   Fingers cannot curl. Either segment the mesh into rigid')
  console.log('   phalanges (visible seams at the knuckles) or use it only for')
  console.log('   shots where the hand does not articulate.')
}

/* ---- animations ---- */
if (n(json.animations)) {
  console.log('\nclips     :')
  for (const a of json.animations) {
    const t = json.accessors[a.samplers?.[0]?.input]
    console.log(`  - ${a.name ?? '(unnamed)'}  ${t?.max?.[0]?.toFixed(2) ?? '?'}s`)
  }
} else {
  console.log('\nclips     : none')
}

/* ---- real-world size, with the skinned-mesh caveat ---- */
console.log('\nbounds (from POSITION accessors, mesh-local):')
let any = false
for (const m of json.meshes ?? []) {
  for (const p of m.primitives ?? []) {
    const acc = json.accessors[p.attributes?.POSITION]
    if (!acc?.min) continue
    any = true
    const size = acc.max.map((v, i) => v - acc.min[i])
    console.log(
      `  ${(m.name ?? 'mesh').padEnd(18)} ${size.map((v) => v.toFixed(3)).join(' x ')}`
    )
  }
}
if (!any) console.log('  (none)')
if (n(json.skins) > 0) {
  console.log(
    '  NOTE: on a skinned mesh these are BIND-POSE bounds and may bear no\n' +
      '  relation to what is drawn. Measure bone world positions at runtime.'
  )
}

/* ---- materials, so lighting expectations are set ---- */
if (n(json.materials)) {
  console.log('\nmaterials :')
  for (const m of json.materials) {
    const p = m.pbrMetallicRoughness ?? {}
    const col = p.baseColorFactor
      ? `rgba(${p.baseColorFactor.map((v) => v.toFixed(2)).join(', ')})`
      : 'texture'
    console.log(`  - ${(m.name ?? '(unnamed)').padEnd(18)} ${col}`)
  }
}

console.log('\nStill to determine by eye once loaded: which way it faces, and')
console.log('whether the palm normal points +Z or -Z.\n')
