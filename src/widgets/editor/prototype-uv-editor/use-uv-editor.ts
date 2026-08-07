/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Binds the pure `uv-edit` model to whatever mesh is selected in the scene, so
 * the three layout variants are judged against real geometry at real density
 * rather than a mock. Module-scoped singleton: switching variants keeps your
 * work, which is the whole point of being able to flip between them.
 *
 * Edits are in-memory only. They write into `geometry.attributes.uv` and flag
 * it for re-upload — the same path the real feature would take — and "reset"
 * puts the original buffer back.
 */
import { computed, ref, shallowRef, watch } from 'vue'
import THREE from '@/shared/three'
import { useSelectionStore } from '@/app/model/selection'
import { useShadingStore } from '@/app/model/shading'
import * as uvEdit from './uv-edit'
import { createUvGridTexture } from './uv-grid-texture'

/** Bumped on every edit; components watch it to know when to redraw. */
const version = ref(0)
const model = shallowRef<uvEdit.UvModel | null>(null)
const selection = ref<uvEdit.UvSelection>(uvEdit.createSelection())
const mesh = shallowRef<THREE.Mesh | null>(null)
const lastAction = ref('—')
/** Meshes whose material we swapped, so it can be put back. */
const patchedMaterials = new Map<string, THREE.Texture | null>()

let gridTexture: THREE.Texture | null = null

function uvAttribute() {
	const attr = mesh.value?.geometry.attributes.uv
	return attr instanceof THREE.BufferAttribute ? attr : null
}

/** The live UV buffer. Reading it is cheap; writing goes through `commit`. */
function currentUv(): Float32Array | null {
	const attr = uvAttribute()
	if (!attr) return null
	return attr.array instanceof Float32Array ? attr.array : Float32Array.from(attr.array)
}

function commit(next: Float32Array, action: string) {
	const attr = uvAttribute()
	if (!attr) return
	;(attr.array as Float32Array).set(next)
	attr.needsUpdate = true
	lastAction.value = action
	version.value++
}

export function useUvEditor() {
	const selectionStore = useSelectionStore()
	const shadingStore = useShadingStore()

	// Follow the scene's selection. A mesh with no uv attribute (imported
	// geometry sometimes has none) is reported rather than silently ignored.
	watch(
		() => selectionStore.selectedObject,
		(object) => {
			const next = object instanceof THREE.Mesh ? object : null
			mesh.value = next
			selection.value = uvEdit.createSelection()
			if (!next || !next.geometry.attributes.uv) {
				model.value = null
				return
			}
			const geometry = next.geometry
			model.value = uvEdit.createUvModel({
				position: geometry.attributes.position.array,
				uv: geometry.attributes.uv.array,
				index: geometry.index?.array ?? null
			})
			version.value++
		},
		{ immediate: true }
	)

	const summary = computed(() => {
		void version.value
		const uv = currentUv()
		if (!model.value || !uv) return null
		return uvEdit.summarize(model.value, uv, selection.value)
	})

	const status = computed<'ready' | 'no-selection' | 'not-a-mesh' | 'no-uvs'>(() => {
		if (!selectionStore.selectedObject) return 'no-selection'
		if (!(selectionStore.selectedObject instanceof THREE.Mesh)) return 'not-a-mesh'
		if (!model.value) return 'no-uvs'
		return 'ready'
	})

	function apply(op: uvEdit.TransformOp, label: string) {
		const uv = currentUv()
		if (!model.value || !uv) return
		const r = uvEdit.transform(model.value, uv, selection.value, op)
		if (!r.moved) {
			lastAction.value = 'Nothing selected'
			version.value++
			return
		}
		commit(r.uv, `${label} — ${r.moved} UV vertices`)
	}

	function pack() {
		const uv = currentUv()
		if (!model.value || !uv) return
		commit(uvEdit.packIslands(model.value, uv), 'Packed islands into a grid')
	}

	function weldSelected() {
		const uv = currentUv()
		if (!model.value || !uv) return
		const r = uvEdit.weld(model.value, uv, selection.value)
		commit(r.uv, `Welded ${r.welded} UV vertices`)
	}

	function reset() {
		if (!model.value) return
		commit(Float32Array.from(model.value.originalUv), 'Reset UVs')
	}

	function selectAll() {
		const m = model.value
		if (!m) return
		const sel = selection.value
		sel.ids.clear()
		const visible = (f: number) => uvEdit.isFaceVisible(sel, f)
		if (sel.mode === 'vertex') {
			for (let v = 0; v < m.vertCount; v++) {
				if (m.facesOfVert[v].some(visible)) sel.ids.add(v)
			}
		} else if (sel.mode === 'edge') {
			m.edges.forEach((e, i) => e.faces.some(visible) && sel.ids.add(i))
		} else if (sel.mode === 'face') {
			for (let f = 0; f < m.faceCount; f++) if (visible(f)) sel.ids.add(f)
		} else {
			for (let i = 0; i < m.islandCount; i++) {
				if (m.facesOfIsland[i].some(visible)) sel.ids.add(i)
			}
		}
		lastAction.value = `Selected all ${sel.ids.size} ${sel.mode}(s)`
		version.value++
	}

	function clearSelection() {
		selection.value.ids.clear()
		lastAction.value = 'Deselected'
		version.value++
	}

	function setMode(mode: uvEdit.SelectMode) {
		selection.value.mode = mode
		selection.value.ids.clear()
		version.value++
	}

	function touch(action?: string) {
		if (action) lastAction.value = action
		version.value++
	}

	/**
	 * Swap a UV grid onto the material so the layout is legible, and switch to
	 * a shading mode that shows maps — solid mode substitutes a flat material
	 * and would hide the whole point.
	 */
	function toggleGrid() {
		const target = mesh.value
		if (!target || Array.isArray(target.material)) return
		gridTexture ??= createUvGridTexture()
		const cache = shadingStore.getMaterialCache(target)
		const material = (cache?.original ?? target.material) as THREE.MeshStandardMaterial
		if (patchedMaterials.has(target.uuid)) {
			material.map = patchedMaterials.get(target.uuid) ?? null
			patchedMaterials.delete(target.uuid)
			lastAction.value = 'Removed the UV grid'
		} else {
			patchedMaterials.set(target.uuid, material.map)
			material.map = gridTexture
			if (shadingStore.shadingMode === 'solid' || shadingStore.shadingMode === 'wireframe') {
				shadingStore.setMode('preview')
			}
			lastAction.value = 'Applied a UV grid to the material'
		}
		material.needsUpdate = true
		selectionStore.refresh()
		version.value++
	}

	const hasGrid = computed(() => {
		void version.value
		return mesh.value ? patchedMaterials.has(mesh.value.uuid) : false
	})

	return {
		version,
		model,
		mesh,
		selection,
		summary,
		status,
		lastAction,
		hasGrid,
		currentUv,
		commit,
		apply,
		pack,
		weldSelected,
		reset,
		selectAll,
		clearSelection,
		setMode,
		toggleGrid,
		touch
	}
}
