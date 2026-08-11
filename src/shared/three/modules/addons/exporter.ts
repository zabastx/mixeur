import { useToast } from '@/shared/lib/toast'
import THREE from '@/shared/three'
import { getUserData, sceneForSerialization } from '@/shared/three/utils'
import { downloadFile } from '@/shared/lib/files'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

const toast = useToast()

const isLightExportable = (light: THREE.Light) =>
	light instanceof THREE.PointLight ||
	light instanceof THREE.DirectionalLight ||
	light instanceof THREE.SpotLight

export async function exportModel(scene: THREE.Scene) {
	try {
		const { scene: exportScene, missingBones } = sceneForSerialization(
			scene,
			(child) =>
				!getUserData(child).isHelper && !(child instanceof THREE.Light && !isLightExportable(child))
		)

		// Exported anyway, for the same reason the project still saves: the rest of
		// the scene is sound. GLTFExporter writes `"joints": [null, …]` for a joint
		// it was not handed, so say which mesh will come out of this wrong.
		if (missingBones.length > 0) {
			toast.add({
				type: 'warning',
				title: 'A rig will not survive this export',
				message: `${missingBones[0].name || 'A skinned mesh'} is posed by bones this export leaves out. Move it and those bones under the same object.`
			})
		}

		const exporter = new GLTFExporter()
		const buffer = (await exporter.parseAsync(exportScene, { binary: true })) as ArrayBuffer
		downloadFile(buffer, 'model.glb', { mimeType: 'model/gltf-binary' })
	} catch (error) {
		const err = error as Error
		console.error('Export error:', err.message)
		toast.add({
			type: 'error',
			title: 'Failed to export scene',
			message: err.message
		})
	}
}
