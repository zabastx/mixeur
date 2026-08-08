import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import THREE from '@/shared/three'
import { createUvGridTexture } from '@/shared/three/modules/mesh/uv-grid'
import { useSelectionStore } from './selection'
import { useShadingStore } from './shading'
import type { ShadingMode } from './types/shading'

/**
 * Putting a checker grid on a mesh so its UV layout is legible in the viewport.
 *
 * Separate from `useUvStore` because it changes for entirely different reasons:
 * that store is about a layout — islands, selection, transforms — and this one
 * texturing a mesh. Nothing here reads a UV coordinate, and the only thing the
 * UV editor wants from it is a checkbox.
 *
 * What is borrowed is put back. The mesh's previous map returns when the grid
 * comes off, and so does the shading mode, if one had to be changed to make the
 * grid visible at all.
 */
export const useUvGridStore = defineStore('uv-grid', () => {
	/**
	 * The meshes currently wearing the grid.
	 *
	 * A ref rather than a plain Set so that views re-read when it changes —
	 * swapping a material's map is invisible to Vue, and this is the only signal
	 * that it happened.
	 */
	const appliedTo = ref<ReadonlySet<string>>(new Set())

	/** What each mesh's map was before the grid replaced it. */
	const replaced = new Map<string, THREE.Texture | null>()

	let gridTexture: THREE.Texture | null = null
	/** The shading mode the grid displaced, so taking it off can put it back. */
	let shadingBefore: ShadingMode | null = null

	const isApplied = (uuid: string) => appliedTo.value.has(uuid)

	function toggle(mesh: THREE.Mesh | null) {
		if (!mesh || Array.isArray(mesh.material)) return

		const shadingStore = useShadingStore()
		const material = shadingStore.shadedMaterial(mesh) as THREE.MeshStandardMaterial | undefined
		if (!material) return

		const next = new Set(appliedTo.value)
		if (next.delete(mesh.uuid)) {
			material.map = replaced.get(mesh.uuid) ?? null
			replaced.delete(mesh.uuid)
			// Only if nothing has changed the mode since — the user switching
			// shading deliberately outranks anything this borrowed.
			if (shadingBefore && shadingStore.shadingMode === 'preview') {
				shadingStore.setMode(shadingBefore)
			}
			shadingBefore = null
		} else {
			gridTexture ??= createUvGridTexture()
			replaced.set(mesh.uuid, material.map)
			material.map = gridTexture
			next.add(mesh.uuid)
			// Flat shading modes ignore maps, so the grid would appear to do
			// nothing at all.
			if (shadingStore.shadingMode === 'solid' || shadingStore.shadingMode === 'wireframe') {
				shadingBefore = shadingStore.shadingMode
				shadingStore.setMode('preview')
			}
		}

		material.needsUpdate = true
		appliedTo.value = next
		useSelectionStore().refresh()
	}

	/** Drop a removed mesh's remembered map so this doesn't grow forever. */
	function forget(uuid: string) {
		replaced.delete(uuid)
		if (!appliedTo.value.has(uuid)) return
		const next = new Set(appliedTo.value)
		next.delete(uuid)
		appliedTo.value = next
		// The mesh that borrowed the shading mode may have been the one deleted,
		// and no grid is left to hand it back.
		if (!next.size) shadingBefore = null
	}

	return { appliedTo, isApplied, toggle, forget }
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useUvGridStore, import.meta.hot))
}
