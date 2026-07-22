'use client'

import { useGLTF } from '@react-three/drei'
import type { WebGLRenderer } from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Asset pipeline.
 *
 * NOTE: this project currently ships zero .glb files. Every object in the
 * introduction is authored procedurally in code, matching how the preserved
 * section was built. This module exists so that real Draco/KTX2 assets can be
 * dropped in later without touching the timeline or the scene composition.
 *
 * See ASSETS.md for the expected node names, scale and clip names.
 *
 * Decoders are served from /public and fetched on demand, never bundled.
 */

const DRACO_PATH = '/decoders/draco/'
const KTX2_PATH = '/decoders/basis/'

let draco: DRACOLoader | null = null
let ktx2: KTX2Loader | null = null

export function configureLoaders(loader: GLTFLoader, gl: WebGLRenderer) {
  if (!draco) {
    draco = new DRACOLoader()
    draco.setDecoderPath(DRACO_PATH)
    draco.setDecoderConfig({ type: 'js' })
  }
  loader.setDRACOLoader(draco)

  if (!ktx2) {
    ktx2 = new KTX2Loader()
    ktx2.setTranscoderPath(KTX2_PATH)
  }
  // Must run against the live renderer to pick a supported transcode target.
  ktx2.detectSupport(gl)
  loader.setKTX2Loader(ktx2)
}

/** Preload an asset with the compressed pipeline already attached. */
export function preloadModel(url: string) {
  useGLTF.preload(url)
}

/** Free decoder workers once the introduction's assets are resident. */
export function disposeLoaders() {
  draco?.dispose()
  ktx2?.dispose()
  draco = null
  ktx2 = null
}
