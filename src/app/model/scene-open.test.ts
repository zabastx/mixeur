import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'
import { useToast } from '@/shared/lib/toast'
import { useSceneStore } from './scene'

const downloads = vi.hoisted(() => [] as (Blob | ArrayBuffer)[])
vi.mock('@/shared/lib/files', () => ({
	downloadFile: (data: Blob | ArrayBuffer) => downloads.push(data)
}))

vi.mock('@/shared/three/modules/loaders/studio-light', () => ({
	loadStudioLight: () => Promise.resolve({ ok: false, error: new Error('not loaded in tests') })
}))

/**
 * Stands in for the user answering the browser's file picker once its click()
 * has returned: picking `files`, or dismissing it when `files` is null.
 */
function answerPickerWith(files: File[] | null) {
	vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
		this: HTMLInputElement
	) {
		setTimeout(() => {
			if (files === null) {
				this.dispatchEvent(new Event('cancel'))
				return
			}
			Object.defineProperty(this, 'files', { value: files, configurable: true })
			this.dispatchEvent(new Event('change'))
		})
	})
}

describe('opening a project file', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		downloads.length = 0
		useToast().clear()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('loads the project the user picks', async () => {
		const scene = useSceneStore()
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
		mesh.name = 'Saved Box'
		scene.addObjectToScene(mesh)
		scene.saveProjectFile()
		scene.clearScene()

		answerPickerWith([new File([downloads[0]!], 'project.mixeur')])

		expect(await scene.openProjectFile()).toBe(true)
		expect(scene.scene.getObjectByName('Saved Box')).toBeInstanceOf(THREE.Mesh)
	})

	it('settles with nothing loaded when the picker is dismissed', async () => {
		const scene = useSceneStore()
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
		mesh.name = 'Open Box'
		scene.addObjectToScene(mesh)

		answerPickerWith(null)

		expect(await scene.openProjectFile()).toBe(false)
		expect(scene.scene.getObjectByName('Open Box')).toBe(mesh)
	})
})
