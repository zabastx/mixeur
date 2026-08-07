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
	type UvLayout,
	type UvSelection,
	type UvTransform
} from '@/shared/lib/uv-layout'
import { createUvGridTexture } from '@/shared/three/modules/mesh/uv-grid'
import { useSelectionStore } from './selection'
import { useShadingStore } from './shading'

/**
 * Why the selected mesh has no editable UVs, when it doesn't.
 * `ready` is the only state in which the editor draws anything.
 */
export type UvStatus = 'ready' | 'no-selection' | 'not-a-mesh' | 'no-uvs'

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

	const selectionStore = useSelectionStore()

	watch(
		() => selectionStore.selectedObject,
		(object) => {
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
		const cached = shadingStore.getMaterialCache(target)?.original
		const material = (Array.isArray(cached) ? cached[0] : (cached ?? target.material)) as
			| THREE.MeshStandardMaterial
			| undefined
		if (!material) return

		if (replacedMaps.has(target.uuid)) {
			material.map = replacedMaps.get(target.uuid) ?? null
			replacedMaps.delete(target.uuid)
			lastAction.value = 'Removed the UV grid'
		} else {
			gridTexture ??= createUvGridTexture()
			replacedMaps.set(target.uuid, material.map)
			material.map = gridTexture
			// Flat shading modes ignore maps, so the grid would appear to do
			// nothing at all.
			if (shadingStore.shadingMode === 'solid' || shadingStore.shadingMode === 'wireframe') {
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
