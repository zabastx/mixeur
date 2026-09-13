import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'
import { useSceneStore } from './scene'
import { useShadingStore } from './shading'
import { useSelectionStore } from './selection'
import { getUserData } from '@/shared/three/utils'
import { createLight } from '@/shared/three/modules/light'
import { useUvGridStore } from './uv-grid'
import { decodeProject } from '@/shared/lib/project-file'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import fontData from '../../../public/fonts/helvetiker_regular.typeface.json'
import { MxObjectLoader } from '@/shared/three/modules/loaders/object-loader/MxObjectLoader'
import { useToast } from '@/shared/lib/toast'

const downloads = vi.hoisted(() => [] as (Blob | ArrayBuffer)[])
vi.mock('@/shared/lib/files', () => ({
	downloadFile: (data: Blob | ArrayBuffer) => downloads.push(data)
}))

function meshNamed(root: THREE.Object3D, name: string): THREE.Mesh {
	const object = root.getObjectByName(name)
	if (!(object instanceof THREE.Mesh)) throw new Error(`Missing mesh: ${name}`)
	return object
}

function duplicate(source: THREE.Object3D) {
	useSelectionStore().select(source)
	useSceneStore().duplicateObject(source.uuid)
	const result = useSelectionStore().selectedObject
	if (!result || result === source) throw new Error('No Duplicate was created')
	return result
}

describe('scene copying', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		downloads.length = 0
		useToast().clear()
	})

	it('keeps the original geometry untouched when GLB rejects a vertex attribute', async () => {
		const scene = useSceneStore()
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial())
		scene.addObjectToScene(mesh)
		const normal = mesh.geometry.attributes.normal
		normal.setXYZ(0, 0, 0, 2)
		mesh.geometry.setAttribute('unsupported', new THREE.BufferAttribute(new Float64Array(4), 1))
		await scene.exportScene()
		expect(downloads).toHaveLength(0)
		expect(mesh.geometry.attributes.normal).toBe(normal)
		expect(normal.getZ(0)).toBe(2)
		expect(useShadingStore().shadingMode).toBe('solid')
	})

	it('saves editable text without writing serialization metadata into the original geometry', async () => {
		const scene = useSceneStore()
		const geometry = new TextGeometry('A', {
			font: new FontLoader().parse(fontData),
			bevelEnabled: false
		})
		geometry.userData = { authored: { value: 7 } }
		const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
		getUserData(mesh).text = { textValue: 'A', parameters: geometry.parameters }
		scene.addObjectToScene(mesh)
		scene.saveProjectFile()
		const project = decodeProject(downloads[0] as ArrayBuffer)
		const loaded = await new MxObjectLoader().parseAsync(project.data.scene)
		const saved = loaded.children[0] as THREE.Mesh
		expect(saved.geometry).toBeInstanceOf(TextGeometry)
		expect(saved.geometry.attributes.position.count).toBe(geometry.attributes.position.count)
		expect(geometry.userData).toEqual({ authored: { value: 7 } })
		const copy = duplicate(mesh) as THREE.Mesh
		getUserData(copy).text!.textValue = 'B'
		expect(getUserData(mesh).text!.textValue).toBe('A')
	})

	it('keeps one independent rig inside a Duplicate and preserves its placement and name', () => {
		const scene = useSceneStore()
		const parent = scene.addGroup()
		const root = new THREE.Group()
		root.name = 'Character'
		root.position.set(3, 4, 5)
		root.rotation.y = 0.6
		root.scale.setScalar(2)
		const bone = new THREE.Bone()
		const geometry = new THREE.PlaneGeometry()
		geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(16).fill(0), 4))
		geometry.setAttribute(
			'skinWeight',
			new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4)
		)
		const skeleton = new THREE.Skeleton([bone])
		root.add(bone)
		for (const name of ['Body', 'Eyes']) {
			const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial())
			mesh.name = name
			mesh.bind(skeleton)
			root.add(mesh)
		}
		scene.addObjectToScene(root, parent)
		const copy = duplicate(root)
		const body = meshNamed(copy, 'Body') as THREE.SkinnedMesh
		const eyes = meshNamed(copy, 'Eyes') as THREE.SkinnedMesh
		body.skeleton.bones[0].position.y = 2
		body.skeleton.boneInverses[0].elements[12] = 9
		expect(eyes.skeleton).toBe(body.skeleton)
		expect(body.skeleton.bones[0].parent).toBe(copy)
		expect(bone.position.y).toBe(0)
		expect(skeleton.boneInverses[0].elements[12]).toBe(0)
		expect(copy.parent).toBe(parent)
		expect(copy.name).toBe(root.name)
		expect(copy.position.toArray()).toEqual([3, 4, 5])
		expect(copy.rotation.y).toBeCloseTo(0.6)
		expect(copy.scale.toArray()).toEqual([2, 2, 2])
		const material = useShadingStore().shadedMaterial(body) as THREE.MeshStandardMaterial
		material.color.setHex(0xff0000)
		expect(
			(
				useShadingStore().shadedMaterial(meshNamed(root, 'Body')) as THREE.MeshStandardMaterial
			).color.getHex()
		).toBe(0xffffff)
	})

	it('connects LOD levels to the prepared descendants of a Duplicate', () => {
		const scene = useSceneStore()
		const lod = new THREE.LOD()
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial())
		mesh.name = 'Near'
		lod.addLevel(mesh, 0)
		scene.addObjectToScene(lod)
		const copy = duplicate(lod) as THREE.LOD
		expect(copy.levels[0].object).toBe(copy.children[0])
		expect(copy.levels[0].object).not.toBe(mesh)
	})

	it('exports object JSON without UV Grid, including nested meshes', async () => {
		const scene = useSceneStore()
		const group = new THREE.Group()
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial())
		mesh.name = 'Body'
		group.add(mesh)
		scene.addObjectToScene(group)
		useUvGridStore().toggle(mesh)
		scene.objectToJSON(group.uuid)
		const json = JSON.parse(await (downloads[0] as Blob).text())
		const loaded = new THREE.ObjectLoader().parse(json)
		expect((meshNamed(loaded, 'Body').material as THREE.MeshStandardMaterial).map).toBeNull()
		expect(useUvGridStore().isApplied(mesh.uuid)).toBe(true)
	})

	it('exports GLB with authored materials and lights without changing viewport mode', async () => {
		const scene = useSceneStore()
		const mesh = new THREE.Mesh(
			new THREE.PlaneGeometry(),
			new THREE.MeshStandardMaterial({ color: 0xff0000 })
		)
		scene.addObjectToScene(mesh)
		useUvGridStore().toggle(mesh)
		const light = createLight({ type: 'point' })
		scene.addObjectToScene(light)
		const shading = useShadingStore()
		const modes: string[] = []
		const stop = shading.$onAction(({ name }) => {
			if (name === 'setMode') modes.push(name)
		})
		await scene.exportScene()
		stop()
		const buffer = downloads[0] as ArrayBuffer
		const jsonLength = new DataView(buffer).getUint32(12, true)
		const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)))
		expect(json.materials[0].pbrMetallicRoughness.baseColorFactor).toEqual([1, 0, 0, 1])
		expect(json.textures).toBeUndefined()
		expect(json.extensions.KHR_lights_punctual.lights).toHaveLength(1)
		expect(modes).toEqual([])
		expect(shading.shadingMode).toBe('preview')
		expect(light.visible).toBe(false)
		expect(useUvGridStore().isApplied(mesh.uuid)).toBe(true)
	})

	it('saves the underlying material while UV Grid stays visible in the open scene', () => {
		const scene = useSceneStore()
		const shading = useShadingStore()
		const grid = useUvGridStore()
		const mesh = new THREE.Mesh(
			new THREE.PlaneGeometry(),
			new THREE.MeshStandardMaterial({ color: 0x123456 })
		)
		mesh.name = 'Body'
		scene.addObjectToScene(mesh)
		grid.toggle(mesh)
		const displayed = shading.shadedMaterial(mesh) as THREE.MeshStandardMaterial
		const gridMap = displayed.map
		scene.saveProjectFile()
		const project = decodeProject(downloads[0] as ArrayBuffer)
		const loaded = new THREE.ObjectLoader().parse(project.data.scene)
		const material = meshNamed(loaded, 'Body').material as THREE.MeshStandardMaterial

		expect(material.map).toBeNull()
		expect(material.color.getHex()).toBe(0x123456)
		expect(displayed.map).toBe(gridMap)
		expect(grid.isApplied(mesh.uuid)).toBe(true)
		expect(shading.shadingMode).toBe('preview')
	})

	it.each(['original', 'duplicate'])(
		"deleting the %s does not dispose the other object's texture",
		(remove) => {
			const scene = useSceneStore()
			const shading = useShadingStore()
			const image = document.createElement('canvas')
			const original = new THREE.Mesh(
				new THREE.PlaneGeometry(),
				new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(image) })
			)
			scene.addObjectToScene(original)
			const copy = duplicate(original) as THREE.Mesh
			shading.setMode('rendered')
			const survivor = remove === 'original' ? copy : original
			const victim = remove === 'original' ? original : copy
			const map = (survivor.material as THREE.MeshStandardMaterial).map!
			let disposed = false
			map.addEventListener('dispose', () => {
				disposed = true
			})

			scene.deleteFromScene(victim.uuid)

			expect(disposed).toBe(false)
			expect(map.image).toBe(image)
			expect(survivor.parent).toBe(scene.scene)
		}
	)

	it('duplicates the texture underneath UV Grid and leaves the original grid enabled', () => {
		const scene = useSceneStore()
		const shading = useShadingStore()
		const grid = useUvGridStore()
		const image = document.createElement('canvas')
		const texture = new THREE.CanvasTexture(image)
		const mesh = new THREE.Mesh(
			new THREE.PlaneGeometry(),
			new THREE.MeshStandardMaterial({ map: texture })
		)
		scene.addObjectToScene(mesh)
		grid.toggle(mesh)
		const shown = (shading.shadedMaterial(mesh) as THREE.MeshStandardMaterial).map
		const copy = duplicate(mesh) as THREE.Mesh
		const material = shading.shadedMaterial(copy) as THREE.MeshStandardMaterial

		expect(material.map?.image).toBe(image)
		expect(grid.isApplied(mesh.uuid)).toBe(true)
		expect(grid.isApplied(copy.uuid)).toBe(false)
		expect((shading.shadedMaterial(mesh) as THREE.MeshStandardMaterial).map).toBe(shown)
		grid.toggle(mesh)
		expect((shading.shadedMaterial(mesh) as THREE.MeshStandardMaterial).map).toBe(texture)
	})

	it('rebuilds camera and light helpers and reconnects a copied light to its target', () => {
		const scene = useSceneStore()
		const group = scene.addGroup()
		const camera = new THREE.PerspectiveCamera()
		camera.name = 'Lens'
		const light = createLight({ type: 'sun' })
		// A helper nested below a light also exercises Three.js copy methods
		// which ignore the recursive flag.
		scene.addObjectToScene(light, group)
		scene.addObjectToScene(camera, light)
		const copy = duplicate(group)
		const newLight = copy.getObjectByName(light.name) as THREE.DirectionalLight
		const newCamera = copy.getObjectByName('Lens') as THREE.Camera
		const helpers: THREE.Object3D[] = []
		scene.scene.traverse((object) => {
			if (getUserData(object).isHelper) helpers.push(object)
		})

		expect(helpers.filter((helper) => helper instanceof THREE.CameraHelper)).toHaveLength(2)
		expect(getUserData(newCamera).helperUUID).not.toBe(getUserData(camera).helperUUID)
		expect(newLight.target).toBe(
			newLight.children.find((child) => getUserData(child).isLightTarget)
		)
		expect(newLight.target).not.toBe(light.target)
		const copiedHelperUUIDs = [getUserData(newCamera).helperUUID, getUserData(newLight).helperUUID]
		scene.deleteFromScene(copy.uuid)
		for (const uuid of copiedHelperUUIDs) {
			expect(scene.scene.getObjectByProperty('uuid', uuid)).toBeUndefined()
		}
		expect(scene.scene.getObjectByProperty('uuid', getUserData(camera).helperUUID)).toBeDefined()
	})

	it('refuses a partial rig alone but warns and continues for scene files', async () => {
		const scene = useSceneStore()
		const bone = new THREE.Bone()
		const geometry = new THREE.BoxGeometry()
		const count = geometry.attributes.position.count
		geometry.setAttribute(
			'skinIndex',
			new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4)
		)
		const weights = new Float32Array(count * 4)
		for (let index = 0; index < count; index++) weights[index * 4] = 1
		geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4))
		const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial())
		mesh.name = 'Body'
		mesh.bind(new THREE.Skeleton([bone]))
		scene.addObjectToScene(bone)
		scene.addObjectToScene(mesh)
		const children = [...scene.scene.children]

		scene.duplicateObject(mesh.uuid)
		expect(scene.scene.children).toEqual(children)
		expect(useSelectionStore().selectedObject).toBe(mesh)
		scene.objectToJSON(mesh.uuid)
		expect(downloads).toHaveLength(0)
		expect(useToast().toasts.value.filter((toast) => toast.type === 'error')).toHaveLength(2)

		bone.removeFromParent()
		scene.saveProjectFile()
		await scene.exportScene()
		expect(downloads).toHaveLength(2)
		expect(useToast().toasts.value.filter((toast) => toast.type === 'warning')).toHaveLength(2)
	})

	it('duplicates nested meshes with their real material in Solid mode', () => {
		const scene = useSceneStore()
		const group = new THREE.Group()
		const mesh = new THREE.Mesh(
			new THREE.BoxGeometry(),
			new THREE.MeshStandardMaterial({ color: 0xff0000 })
		)
		mesh.name = 'Body'
		group.add(mesh)
		scene.addObjectToScene(group)
		const copy = duplicate(group)
		useShadingStore().setMode('rendered')

		const material = meshNamed(copy, 'Body').material as THREE.MeshStandardMaterial
		expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
		expect(material.color.getHex()).toBe(0xff0000)
	})

	it('keeps shared geometry inside a Duplicate without sharing edits with the original', () => {
		const scene = useSceneStore()
		const group = new THREE.Group()
		const geometry = new THREE.PlaneGeometry()
		for (const name of ['Left', 'Right']) {
			const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
			mesh.name = name
			group.add(mesh)
		}
		scene.addObjectToScene(group)
		const copy = duplicate(group)
		const left = meshNamed(copy, 'Left')
		const right = meshNamed(copy, 'Right')
		left.geometry.attributes.uv.setXY(0, 0.25, 0.75)
		left.geometry.attributes.position.setX(0, 10)

		expect(right.geometry).toBe(left.geometry)
		expect(geometry.attributes.uv.getX(0)).toBe(0)
		expect(geometry.attributes.uv.getY(0)).toBe(1)
		expect(geometry.attributes.position.getX(0)).toBe(-0.5)
	})
})
