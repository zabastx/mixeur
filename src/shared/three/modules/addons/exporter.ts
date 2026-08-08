import { useToast } from '@/shared/lib/toast'
import THREE from '@/shared/three'
import { getUserData } from '@/shared/three/utils'
import { downloadFile } from '@/shared/lib/files'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

const toast = useToast()

const isLightExportable = (light: THREE.Light) =>
	light instanceof THREE.PointLight ||
	light instanceof THREE.DirectionalLight ||
	light instanceof THREE.SpotLight

export async function exportModel(scene: THREE.Scene) {
	try {
		const exportScene = new THREE.Scene()
		scene.children.forEach((child) => {
			if (!getUserData(child).isHelper) {
				if (child instanceof THREE.Light && !isLightExportable(child)) return
				exportScene.add(child.clone(true))
			}
		})

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
