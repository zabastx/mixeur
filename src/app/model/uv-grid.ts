import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import type THREE from '@/shared/three'
import { createUvGridTexture } from '@/shared/three/modules/mesh'
import { useShadingStore } from './shading'
import type { ShadingMode } from './types/shading'

/**
 * Putting a checker grid on a mesh so its UV layout is legible in the viewport.
 *
 * Separate from `useUvStore` because it changes for entirely different reasons:
 * that store is about a layout — islands, selection, transforms — and this one
 * about which meshes wear the grid. Nothing here reads a UV coordinate, and the
 * only thing the UV editor wants from it is a checkbox and the grid's image.
 *
 * The grid goes on the mesh, never into its Material: the shading store shows it
 * on a stand-in, so the Material tab, a save and a Render see the Material as
 * authored. What is borrowed is the shading mode, if one had to be changed to
 * make the grid visible at all, and it is put back when the grid comes off.
 */
export const useUvGridStore = defineStore('uv-grid', () => {
	/**
	 * The meshes currently wearing the grid.
	 *
	 * A ref rather than a plain Set so that views re-read when it changes —
	 * swapping the material a mesh displays is invisible to Vue, and this is the
	 * only signal that it happened.
	 */
	const appliedTo = ref<ReadonlySet<string>>(new Set())

	let texture: THREE.Texture | null = null
	/** The shading mode the grid displaced, so taking it off can put it back. */
	let shadingBefore: ShadingMode | null = null

	const isApplied = (uuid: string) => appliedTo.value.has(uuid)

	/** The checker texture every mesh wearing the grid shares. */
	function gridTexture() {
		return (texture ??= createUvGridTexture())
	}

	function toggle(mesh: THREE.Mesh | null) {
		if (!mesh) return

		const shadingStore = useShadingStore()
		const material = shadingStore.materialOf(mesh)
		if (!material || Array.isArray(material)) return

		const next = new Set(appliedTo.value)
		if (next.delete(mesh.uuid)) {
			shadingStore.setUvGrid(mesh, null)
			// Only if nothing has changed the mode since — the user switching
			// shading deliberately outranks anything this borrowed.
			if (shadingBefore && shadingStore.shadingMode === 'preview') {
				shadingStore.setMode(shadingBefore)
			}
			shadingBefore = null
		} else {
			shadingStore.setUvGrid(mesh, gridTexture())
			next.add(mesh.uuid)
			// Flat shading modes ignore maps, so the grid would appear to do
			// nothing at all.
			if (shadingStore.shadingMode === 'solid' || shadingStore.shadingMode === 'wireframe') {
				shadingBefore = shadingStore.shadingMode
				shadingStore.setMode('preview')
			}
		}

		appliedTo.value = next
	}

	/** Drop a removed mesh so this doesn't grow forever. */
	function forget(uuid: string) {
		if (!appliedTo.value.has(uuid)) return
		const next = new Set(appliedTo.value)
		next.delete(uuid)
		appliedTo.value = next
		// The mesh that borrowed the shading mode may have been the one deleted,
		// and no grid is left to hand it back.
		if (!next.size) shadingBefore = null
	}

	return { appliedTo, isApplied, gridTexture, toggle, forget }
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useUvGridStore, import.meta.hot))
}
