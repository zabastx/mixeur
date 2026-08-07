import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import THREE from '@/shared/three'
import {
	allIds,
	createUvLayout,
	createUvSelection,
	packIslands,
	transformUvs,
	uvStats,
	weldUvs,
	type SelectMode,
	type TransformKind,
	type UvLayout,
	type UvSelection,
	type UvTransform
} from '@/shared/lib/uv-layout'
import { createUvGridTexture } from '@/shared/three/modules/mesh/uv-grid'
import { useSelectionStore } from './selection'
import { useShadingStore } from './shading'
import { useWorkspaceStore } from './workspace'
import type { ShadingMode } from './types/shading'

/**
 * Why the selected mesh has no editable UVs, when it doesn't.
 * `ready` is the only state in which the editor draws anything.
 */
export type UvStatus = 'ready' | 'no-selection' | 'not-a-mesh' | 'no-uvs'

/** Whether a texture's `image` is something `drawImage` will accept. */
function isDrawable(image: unknown): image is CanvasImageSource {
	return (
		image instanceof HTMLImageElement ||
		image instanceof HTMLCanvasElement ||
		image instanceof ImageBitmap
	)
}

/**
 * UV editing for the object selected in the scene.
 *
 * Scope, deliberately: this edits the whole selected mesh. Blender shows only
 * the UVs of faces selected in edit mode, and Mixeur has no edit mode and no
 * sub-object selection — so a UV editor here stays comfortable on low-poly
 * meshes and gets busy on dense imported ones. Narrowing it is what face
 * selection would buy.
 *
 * Edits write straight into `geometry.attributes.uv` and flag it for re-upload.
 * There is no undo, in line with the rest of the app; `reset` restores the UVs
 * the geometry was loaded with.
 */
export const useUvStore = defineStore('uv', () => {
	const layout = shallowRef<UvLayout | null>(null)
	const mesh = shallowRef<THREE.Mesh | null>(null)
	const selection = ref<UvSelection>(createUvSelection())
	const lastAction = ref('')

	/**
	 * Bumped whenever the UV buffer or the selection changes. Three.js
	 * mutations are invisible to Vue, so this is what views watch to redraw.
	 */
	const revision = ref(0)

	/** The UVs each mesh was loaded with, so `reset` has something to restore. */
	const originalUvs = new Map<string, Float32Array>()
	/** Materials whose map we replaced with the grid, and what was there before. */
	const replacedMaps = new Map<string, THREE.Texture | null>()

	let gridTexture: THREE.Texture | null = null
	/** The shading mode the grid displaced, so taking the grid off can put it back. */
	let shadingBeforeGrid: ShadingMode | null = null

	/**
	 * Whether the pointer is over the UV view, and which modal transform it is
	 * running. Both belong to the canvas, but the status bar's key hints are
	 * outside the UV editor entirely and have to read them from somewhere.
	 */
	const pointerOnCanvas = ref(false)
	const modalKind = ref<TransformKind | null>(null)

	const selectionStore = useSelectionStore()
	const workspaceStore = useWorkspaceStore()

	watch(
		[() => selectionStore.selectedObject, () => workspaceStore.current],
		([object, workspace]) => {
			// Building a layout for a dense mesh costs a fifth of a second, so it
			// only happens while the UV workspace is the one on screen. Arriving at
			// that workspace is the other trigger, so nothing is ever stale on
			// screen — only while it is not being looked at.
			if (workspace !== 'uv') return
			const next = object instanceof THREE.Mesh ? object : null
			mesh.value = next
			selection.value = createUvSelection()
			lastAction.value = ''

			const geometry = next?.geometry
			if (!geometry?.attributes.uv) {
				layout.value = null
				revision.value++
				return
			}
			if (next && !originalUvs.has(next.uuid)) {
				originalUvs.set(next.uuid, Float32Array.from(geometry.attributes.uv.array))
			}
			layout.value = createUvLayout({
				position: geometry.attributes.position.array,
				uv: geometry.attributes.uv.array,
				index: geometry.index?.array ?? null
			})
			revision.value++
		},
		{ immediate: true }
	)

	const status = computed<UvStatus>(() => {
		if (!selectionStore.selectedObject) return 'no-selection'
		if (!(selectionStore.selectedObject instanceof THREE.Mesh)) return 'not-a-mesh'
		if (!layout.value) return 'no-uvs'
		return 'ready'
	})

	/**
	 * The live UV buffer. Callers read it freely; writing goes through `commit`
	 * so nothing can change UVs without the viewport being told.
	 */
	function uvBuffer(): Float32Array | null {
		const attribute = mesh.value?.geometry.attributes.uv
		if (!(attribute instanceof THREE.BufferAttribute)) return null
		return attribute.array instanceof Float32Array ? attribute.array : null
	}

	function commit(next: Float32Array, action: string) {
		const attribute = mesh.value?.geometry.attributes.uv
		if (!(attribute instanceof THREE.BufferAttribute)) return
		;(attribute.array as Float32Array).set(next)
		attribute.needsUpdate = true
		lastAction.value = action
		revision.value++
	}

	/** Republish after mutating the selection in place. */
	function touch(action?: string) {
		if (action !== undefined) lastAction.value = action
		revision.value++
	}

	const stats = computed(() => {
		void revision.value
		const uv = uvBuffer()
		if (!layout.value || !uv) return null
		return uvStats(layout.value, uv, selection.value)
	})

	function apply(operation: UvTransform, label: string) {
		const uv = uvBuffer()
		if (!layout.value || !uv) return
		const result = transformUvs(layout.value, uv, selection.value, operation)
		if (!result.moved) return touch('Nothing selected')
		commit(result.uv, `${label} — ${result.moved} UV vertices`)
	}

	function pack() {
		const uv = uvBuffer()
		if (!layout.value || !uv) return
		commit(packIslands(layout.value, uv), 'Packed islands into a grid')
	}

	function weld() {
		const uv = uvBuffer()
		if (!layout.value || !uv) return
		const result = weldUvs(layout.value, uv, selection.value)
		commit(result.uv, `Welded ${result.welded} UV vertices`)
	}

	function reset() {
		const original = mesh.value && originalUvs.get(mesh.value.uuid)
		if (!original) return
		commit(Float32Array.from(original), 'Reset UVs')
	}

	function setMode(mode: SelectMode) {
		selection.value.mode = mode
		selection.value.ids.clear()
		touch('')
	}

	function selectAll() {
		if (!layout.value) return
		selection.value.ids = allIds(layout.value, selection.value.mode)
		touch(`Selected all ${selection.value.ids.size} ${selection.value.mode}(s)`)
	}

	function clearSelection() {
		selection.value.ids.clear()
		touch('Deselected')
	}

	/**
	 * The material the mesh is really shaded with.
	 *
	 * The shading store's cached original, not `mesh.material` — solid and
	 * wireframe modes substitute a flat material, and reading or writing that
	 * one would be undone the moment the shading mode changed.
	 */
	function shadedMaterial(target: THREE.Mesh) {
		const cached = useShadingStore().getMaterialCache(target)?.original
		const material = Array.isArray(cached) ? cached[0] : (cached ?? target.material)
		return Array.isArray(material) ? material[0] : material
	}

	/**
	 * The image the mesh is textured with, for the UV view to draw the layout
	 * over. Editing against the real texture rather than a stand-in is the whole
	 * point of a UV editor — a grid only helps when there is nothing else.
	 *
	 * Null when the material has no map, or when the map is something a canvas
	 * cannot draw (a compressed KTX2 texture holds no decodable image).
	 */
	const mapImage = computed<CanvasImageSource | null>(() => {
		void revision.value
		const target = mesh.value
		if (!target) return null
		const image = (shadedMaterial(target) as THREE.MeshStandardMaterial | undefined)?.map?.image
		return isDrawable(image) ? image : null
	})

	const hasGrid = computed(() => {
		void revision.value
		return mesh.value ? replacedMaps.has(mesh.value.uuid) : false
	})

	/**
	 * Put a UV grid on the mesh so the layout is legible, or take it off again.
	 *
	 * The map goes onto the shading store's cached original material rather than
	 * the live one — solid mode substitutes a flat material, and writing to that
	 * would be undone the moment the shading mode changed.
	 */
	function toggleGrid() {
		const target = mesh.value
		if (!target || Array.isArray(target.material)) return

		const shadingStore = useShadingStore()
		const material = shadedMaterial(target) as THREE.MeshStandardMaterial | undefined
		if (!material) return

		if (replacedMaps.has(target.uuid)) {
			material.map = replacedMaps.get(target.uuid) ?? null
			replacedMaps.delete(target.uuid)
			// Only if nothing has changed the mode since — the user switching
			// shading deliberately outranks anything this borrowed.
			if (shadingBeforeGrid && shadingStore.shadingMode === 'preview') {
				shadingStore.setMode(shadingBeforeGrid)
			}
			shadingBeforeGrid = null
			lastAction.value = 'Removed the UV grid'
		} else {
			gridTexture ??= createUvGridTexture()
			replacedMaps.set(target.uuid, material.map)
			material.map = gridTexture
			// Flat shading modes ignore maps, so the grid would appear to do
			// nothing at all. Borrowed, not taken: removing the grid hands the
			// viewport back the mode it was in.
			if (shadingStore.shadingMode === 'solid' || shadingStore.shadingMode === 'wireframe') {
				shadingBeforeGrid = shadingStore.shadingMode
				shadingStore.setMode('preview')
			}
			lastAction.value = 'Applied a UV grid'
		}
		material.needsUpdate = true
		selectionStore.refresh()
		revision.value++
	}

	/** Drop a removed mesh's remembered UVs so the maps don't grow forever. */
	function forget(uuid: string) {
		originalUvs.delete(uuid)
		replacedMaps.delete(uuid)
		// The mesh that borrowed the shading mode may have been the one deleted,
		// and no grid is left to hand it back.
		if (!replacedMaps.size) shadingBeforeGrid = null
	}

	return {
		layout,
		mesh,
		selection,
		status,
		stats,
		revision,
		lastAction,
		hasGrid,
		mapImage,
		pointerOnCanvas,
		modalKind,
		uvBuffer,
		commit,
		touch,
		apply,
		pack,
		weld,
		reset,
		setMode,
		selectAll,
		clearSelection,
		toggleGrid,
		forget
	}
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useUvStore, import.meta.hot))
}
