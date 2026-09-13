import THREE from '@/shared/three'
import { downloadFile } from '@/shared/lib/files'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

/** Encode and download an already prepared scene. */
export async function exportModel(scene: THREE.Scene) {
	const exporter = new GLTFExporter()
	const buffer = (await exporter.parseAsync(scene, { binary: true })) as ArrayBuffer
	downloadFile(buffer, 'model.glb', { mimeType: 'model/gltf-binary' })
}
