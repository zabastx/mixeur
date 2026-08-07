<template>
	<div ref="hostRef" class="relative h-full w-full overflow-hidden">
		<canvas ref="canvasRef" class="block h-full w-full cursor-crosshair" data-testid="uv-canvas">
		</canvas>
		<div
			v-if="uvStore.status !== 'ready'"
			class="absolute inset-0 flex items-center justify-center p-4 text-center text-xs
				text-header-text"
		>
			{{ emptyMessage }}
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * The UV view: the layout drawn over the texture tile, with click, box-select
 * and drag.
 *
 * Drawing happens in CSS pixels with the backing store scaled by the device
 * ratio — drawing in backing pixels makes every hairline vanish once the canvas
 * is scaled down into a panel.
 */
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import {
	faceAt,
	idsInRect,
	MIN_REFERENCE,
	modalTransform,
	movingVerts,
	nearestEdge,
	nearestVert,
	pickedVerts,
	resolvePick,
	selectedFaces,
	transformOrigin,
	transformUvs,
	type TransformAxis,
	type TransformKind,
	type UvPoint,
	type UvRect
} from '@/shared/lib/uv-layout'
import { onKeyDown } from '@/shared/lib/keyboard'
import { keyCodeToTransformAxis, keyCodeToTransformMode } from '@/app/config/keymaps'
import { useUvStore } from '@/app/model/uv'

const props = withDefaults(defineProps<{ span?: number }>(), { span: 1.45 })

const uvStore = useUvStore()
const canvasRef = useTemplateRef('canvasRef')
const hostRef = useTemplateRef('hostRef')

const emptyMessage = computed(() => {
	switch (uvStore.status) {
		case 'no-selection':
			return 'Select a mesh to edit its UVs'
		case 'not-a-mesh':
			return 'The selected object is not a mesh'
		case 'no-uvs':
			return 'This geometry has no UV coordinates'
		default:
			return ''
	}
})

const view = ref({ u: 0.5, v: 0.5, span: props.span })
let width = 0
let height = 0
let dpr = 1

/**
 * Canvas colours come from the theme rather than literals, the same way the
 * viewport gizmo reads its axis colours. Resolved once — `getComputedStyle` per
 * frame would be felt during a drag.
 */
const colours = {
	background: '#333333',
	tileOutline: '#ffffff',
	wire: '#ffffffbf',
	seam: '#ff5a50',
	border: '#67c37b',
	vertex: '#dcdcdccc',
	selected: '#ffaf29',
	picked: '#ffffff',
	checkerA: '#333333',
	checkerB: '#262626'
}
const CHECKER_SIZE = 16

function readTheme() {
	const style = getComputedStyle(document.documentElement)
	const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
	colours.background = read('--color-uv-background', colours.background)
	colours.tileOutline = read('--color-uv-tile-outline', colours.tileOutline)
	colours.wire = read('--color-uv-wire', colours.wire)
	colours.seam = read('--color-uv-seam', colours.seam)
	colours.border = read('--color-uv-border', colours.border)
	colours.vertex = read('--color-uv-vertex', colours.vertex)
	colours.selected = read('--color-uv-selected', colours.selected)
	colours.picked = read('--color-uv-picked', colours.picked)
	colours.checkerA = read('--color-checkerboard-primary', colours.checkerA)
	colours.checkerB = read('--color-checkerboard-secondary', colours.checkerB)
}

/** The smaller side sets the scale, so the tile stays square in any panel. */
const scale = () => Math.min(width, height) / view.value.span

function toScreen(u: number, v: number): [number, number] {
	const s = scale()
	// v points up, screen y points down.
	return [(u - view.value.u) * s + width / 2, -(v - view.value.v) * s + height / 2]
}
function toUv(x: number, y: number): UvPoint {
	const s = scale()
	return [(x - width / 2) / s + view.value.u, -(y - height / 2) / s + view.value.v]
}
function eventUv(event: PointerEvent | WheelEvent): UvPoint {
	const canvas = canvasRef.value
	if (!canvas) return [0, 0]
	const rect = canvas.getBoundingClientRect()
	return toUv(event.clientX - rect.left, event.clientY - rect.top)
}
/** Picking tolerance in UV units, so it stays constant on screen as you zoom. */
const tolerance = () => (view.value.span / Math.min(width, height)) * 12

function fit() {
	const canvas = canvasRef.value
	const host = hostRef.value
	if (!canvas || !host) return
	dpr = Math.min(2, window.devicePixelRatio || 1)
	width = Math.max(40, host.clientWidth)
	height = Math.max(40, host.clientHeight)
	canvas.width = Math.round(width * dpr)
	canvas.height = Math.round(height * dpr)
	draw()
}

let box: (UvRect & { start: UvPoint; base: Set<number> }) | null = null
let drag: { from: UvPoint; base: Float32Array } | null = null
/** Middle-drag view pan: where it began, and the view centre at that moment. */
let pan: { x: number; y: number; u: number; v: number } | null = null

/**
 * A running modal transform.
 *
 * `base` is the UV buffer as it was when the modal started; every pointer move
 * re-applies the whole transform to it rather than nudging the live buffer, so
 * cancelling is exact and the numbers in the status line stay absolute.
 *
 * `from` is null until the pointer is first seen over the canvas, which is how
 * a modal started from the menu avoids jumping by the distance to the menu.
 */
type Modal = {
	kind: TransformKind
	axis: TransformAxis
	from: UvPoint | null
	origin: UvPoint
	base: Float32Array
	moved: number
} | null

let modal: Modal = null

/**
 * The session stays a plain local so that pointer moves do not churn
 * reactivity, but the status bar's key hints live outside this component and
 * need to know a modal is running, so the kind alone is mirrored into the store.
 */
function setModal(next: Modal) {
	modal = next
	uvStore.modalKind = next?.kind ?? null
}

/** The last pointer position over the canvas, for a menu-started modal. */
let pointer: UvPoint | null = null

function draw() {
	const canvas = canvasRef.value
	const ctx = canvas?.getContext('2d')
	if (!canvas || !ctx) return

	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	ctx.fillStyle = colours.background
	ctx.fillRect(0, 0, width, height)

	const layout = uvStore.layout
	const uv = uvStore.uvBuffer()
	if (!layout || !uv) return
	const selection = uvStore.selection

	// The 0–1 tile: whatever the material is actually mapped with, over an alpha
	// checkerboard. Only the one tile, as Blender draws it — repeating it would
	// say the layout tiles, which is a property of the texture's wrap mode
	// rather than of anything visible here.
	const [left, top] = toScreen(0, 1)
	const [right, bottom] = toScreen(1, 0)
	const tileWidth = right - left
	const tileHeight = bottom - top

	// The checkerboard is there to show alpha through, so it only appears under
	// an image. With no map the tile is just background, as Blender's UV editor
	// is with no image loaded.
	if (uvStore.mapImage) {
		ctx.save()
		ctx.beginPath()
		ctx.rect(left, top, tileWidth, tileHeight)
		ctx.clip()
		ctx.fillStyle = colours.checkerA
		ctx.fillRect(left, top, tileWidth, tileHeight)
		ctx.fillStyle = colours.checkerB
		// Screen-space squares, so the checker reads as "nothing here" at any
		// zoom instead of looking like part of the texture.
		const originX = left - (((left % (CHECKER_SIZE * 2)) + CHECKER_SIZE * 2) % (CHECKER_SIZE * 2))
		const originY = top - (((top % (CHECKER_SIZE * 2)) + CHECKER_SIZE * 2) % (CHECKER_SIZE * 2))
		for (let y = originY; y < top + tileHeight; y += CHECKER_SIZE) {
			for (let x = originX; x < left + tileWidth; x += CHECKER_SIZE) {
				const odd =
					(Math.round((x - originX) / CHECKER_SIZE) + Math.round((y - originY) / CHECKER_SIZE)) % 2
				if (odd) ctx.fillRect(x, y, CHECKER_SIZE, CHECKER_SIZE)
			}
		}
		ctx.imageSmoothingEnabled = tileWidth < 512
		ctx.drawImage(uvStore.mapImage, left, top, tileWidth, tileHeight)
		ctx.restore()
	}

	ctx.strokeStyle = colours.tileOutline
	ctx.lineWidth = 1.5
	ctx.strokeRect(left, top, tileWidth, tileHeight)

	const picked = pickedVerts(layout, selection)
	const moving = movingVerts(layout, uv, selection)
	const faces = selectedFaces(layout, selection)

	for (const face of faces) {
		ctx.beginPath()
		for (let k = 0; k < 3; k++) {
			const vert = layout.faces[face * 3 + k]
			const [x, y] = toScreen(uv[vert * 2], uv[vert * 2 + 1])
			if (k) ctx.lineTo(x, y)
			else ctx.moveTo(x, y)
		}
		ctx.closePath()
		ctx.globalAlpha = 0.28
		ctx.fillStyle = colours.selected
		ctx.fill()
		ctx.globalAlpha = 1
	}

	// Every line gets a dark halo first: a hairline is invisible over a texture
	// this loud, and the texture has to stay readable to judge placement.
	ctx.lineJoin = 'round'
	ctx.lineCap = 'round'
	const stroke = (ax: number, ay: number, bx: number, by: number, colour: string, w: number) => {
		ctx.beginPath()
		ctx.moveTo(ax, ay)
		ctx.lineTo(bx, by)
		ctx.strokeStyle = 'rgba(0,0,0,.55)'
		ctx.lineWidth = w + 1.6
		ctx.stroke()
		ctx.strokeStyle = colour
		ctx.lineWidth = w
		ctx.stroke()
	}
	for (const edge of layout.edges) {
		const [ax, ay] = toScreen(uv[edge.a * 2], uv[edge.a * 2 + 1])
		const [bx, by] = toScreen(uv[edge.b * 2], uv[edge.b * 2 + 1])
		if (edge.seam) stroke(ax, ay, bx, by, colours.seam, 2.5)
		else if (edge.border) stroke(ax, ay, bx, by, colours.border, 2.5)
		else stroke(ax, ay, bx, by, colours.wire, 1)
	}
	if (selection.mode === 'edge') {
		for (const id of selection.ids) {
			const edge = layout.edges[id]
			if (!edge) continue
			const [ax, ay] = toScreen(uv[edge.a * 2], uv[edge.a * 2 + 1])
			const [bx, by] = toScreen(uv[edge.b * 2], uv[edge.b * 2 + 1])
			stroke(ax, ay, bx, by, colours.selected, 4)
		}
	}

	// On dense meshes only the interesting points are drawn — a few thousand
	// squares is noise, not information.
	const dense = layout.vertCount > 900
	for (let vert = 0; vert < layout.vertCount; vert++) {
		if (!layout.facesOfVert[vert].length) continue
		const isMoving = moving.has(vert)
		const isPicked = picked.has(vert)
		if (dense && !isMoving && !isPicked) continue
		const [x, y] = toScreen(uv[vert * 2], uv[vert * 2 + 1])
		const r = isMoving ? 3.5 : 2.5
		ctx.fillStyle = isPicked ? colours.picked : isMoving ? colours.selected : colours.vertex
		ctx.strokeStyle = 'rgba(0,0,0,.7)'
		ctx.lineWidth = 1
		ctx.strokeRect(x - r - 0.5, y - r - 0.5, r * 2 + 1, r * 2 + 1)
		ctx.fillRect(x - r, y - r, r * 2, r * 2)
	}

	if (selection.pivot === 'cursor') {
		const [cx, cy] = toScreen(selection.cursor[0], selection.cursor[1])
		ctx.strokeStyle = colours.tileOutline
		ctx.lineWidth = 1
		ctx.beginPath()
		ctx.arc(cx, cy, 8, 0, Math.PI * 2)
		ctx.moveTo(cx - 13, cy)
		ctx.lineTo(cx + 13, cy)
		ctx.moveTo(cx, cy - 13)
		ctx.lineTo(cx, cy + 13)
		ctx.stroke()
	}

	if (box) {
		const [ax, ay] = toScreen(box.u0, box.v1)
		const [bx, by] = toScreen(box.u1, box.v0)
		ctx.strokeStyle = colours.selected
		ctx.setLineDash([6, 4])
		ctx.lineWidth = 1.5
		ctx.strokeRect(ax, ay, bx - ax, by - ay)
		ctx.setLineDash([])
	}
}

function pickAt(point: UvPoint) {
	const layout = uvStore.layout
	const uv = uvStore.uvBuffer()
	if (!layout || !uv) return -1
	switch (uvStore.selection.mode) {
		case 'vertex':
			return nearestVert(layout, uv, point, tolerance())
		case 'edge':
			return nearestEdge(layout, uv, point, tolerance())
		default: {
			const face = faceAt(layout, uv, point)
			if (face < 0) return -1
			return uvStore.selection.mode === 'face' ? face : layout.islandOfFace[face]
		}
	}
}

// What the keys do is the status bar's job now, so these only name the modal.
const MODAL_START: Record<TransformKind, string> = {
	move: 'Move',
	rotate: 'Rotate',
	scale: 'Scale'
}
const MODAL_DONE: Record<TransformKind, string> = {
	move: 'Moved',
	rotate: 'Rotated',
	scale: 'Scaled'
}

/**
 * Start a modal move, rotate or scale — Blender's G, R and S.
 *
 * The pointer is the handle, which is the whole reason this is modal rather
 * than a gizmo: nothing is drawn over the texture you are trying to judge.
 * Pressing another of the three mid-modal switches to it rather than
 * compounding, which is how you recover from reaching for the wrong key.
 */
function beginTransform(kind: TransformKind) {
	const layout = uvStore.layout
	if (uvStore.status !== 'ready' || !layout) return
	cancelModal()
	const uv = uvStore.uvBuffer()
	if (!uv) return
	if (!movingVerts(layout, uv, uvStore.selection).size) return uvStore.touch('Nothing selected')

	drag = null
	box = null
	setModal({
		kind,
		axis: null,
		from: pointer,
		origin: transformOrigin(layout, uv, uvStore.selection),
		base: Float32Array.from(uv),
		moved: 0
	})
	uvStore.touch(MODAL_START[kind])
}

function updateModal(point: UvPoint) {
	const layout = uvStore.layout
	if (!modal || !layout) return
	// The first move only fixes the reference: a modal started from the menu has
	// no pointer history, and measuring from the menu would fling the selection.
	if (!modal.from) {
		modal.from = point
		return
	}
	// Rotate and scale measure against the origin, so a reference sitting on top
	// of it has no angle and no radius — and never gains one, because it is the
	// reference that is degenerate, not the travel. Keep re-seeding until the
	// pointer has left, which is the usual case anyway.
	if (
		modal.kind !== 'move' &&
		Math.hypot(modal.from[0] - modal.origin[0], modal.from[1] - modal.origin[1]) < MIN_REFERENCE
	) {
		modal.from = point
		return
	}
	const { transform, label } = modalTransform(
		modal.kind,
		modal.from,
		point,
		modal.origin,
		modal.axis
	)
	const result = transformUvs(layout, modal.base, uvStore.selection, transform)
	modal.moved = result.moved
	uvStore.commit(result.uv, label)
}

function confirmModal() {
	if (!modal) return
	const { kind, moved } = modal
	setModal(null)
	uvStore.touch(`${MODAL_DONE[kind]} ${moved} UV vertices`)
}

function cancelModal() {
	if (!modal) return
	const { base } = modal
	setModal(null)
	uvStore.commit(base, 'Cancelled')
}

function onKey(event: KeyboardEvent) {
	// Hovering is what makes this the UV editor's keyboard rather than the
	// viewport's — except mid-modal, where a menu-started transform has to stay
	// cancellable with the pointer wherever the menu left it.
	if ((!uvStore.pointerOnCanvas && !modal) || event.ctrlKey || event.metaKey || event.altKey) return

	const mode = keyCodeToTransformMode[event.code]
	if (mode) {
		event.preventDefault()
		beginTransform(mode === 'translate' ? 'move' : mode)
		return
	}
	if (!modal) return

	// The viewport's axis keys. UV space has no third axis, so Z is left alone.
	const axis = keyCodeToTransformAxis[event.code]
	if (axis === 'x' || axis === 'y' || axis === 'clear') {
		event.preventDefault()
		const next: TransformAxis = axis === 'x' ? 'u' : axis === 'y' ? 'v' : null
		modal.axis = modal.axis === next ? null : next
		if (pointer) updateModal(pointer)
		return
	}
	if (event.code === 'Escape') {
		event.preventDefault()
		cancelModal()
	} else if (event.code === 'Enter' || event.code === 'NumpadEnter') {
		event.preventDefault()
		confirmModal()
	}
}

function onPointerDown(event: PointerEvent) {
	const host = event.currentTarget as HTMLElement

	// Middle-drag pans, as everywhere else in the app. Before the modal check so
	// the view stays movable while a transform is running.
	if (event.button === 1) {
		event.preventDefault()
		host.setPointerCapture(event.pointerId)
		pan = { x: event.clientX, y: event.clientY, u: view.value.u, v: view.value.v }
		return
	}

	if (modal) {
		event.preventDefault()
		if (event.button === 0) confirmModal()
		else cancelModal()
		return
	}

	if (event.button !== 0 || uvStore.status !== 'ready') return
	const uv = uvStore.uvBuffer()
	if (!uv) return
	const point = eventUv(event)
	const selection = uvStore.selection
	host.setPointerCapture(event.pointerId)

	if (event.altKey) {
		selection.cursor = point
		selection.pivot = 'cursor'
		uvStore.touch('Placed the 2D cursor')
		return
	}

	const hit = pickAt(point)
	const { ids, startsDrag } = resolvePick(selection.ids, hit, event.shiftKey)
	selection.ids = ids

	if (startsDrag) {
		drag = { from: point, base: Float32Array.from(uv) }
	} else if (hit < 0) {
		// `base` is what the selection was before the box opened, so every
		// pointer move can recompute from it. Adding to the live selection
		// instead would make the box a one-way ratchet — dragging back over an
		// overshoot would leave everything it had already swept up selected.
		box = {
			start: point,
			base: new Set(ids),
			u0: point[0],
			u1: point[0],
			v0: point[1],
			v1: point[1]
		}
	}
	uvStore.touch(`Selected ${ids.size} ${selection.mode}(s)`)
}

function onPointerMove(event: PointerEvent) {
	if (pan) {
		const s = scale()
		view.value.u = pan.u - (event.clientX - pan.x) / s
		view.value.v = pan.v + (event.clientY - pan.y) / s
		draw()
		return
	}

	const point = eventUv(event)
	pointer = point
	const layout = uvStore.layout
	if (!layout) return

	if (modal) {
		updateModal(point)
		return
	}

	if (drag) {
		const result = transformUvs(layout, drag.base, uvStore.selection, {
			translate: [point[0] - drag.from[0], point[1] - drag.from[1]]
		})
		uvStore.commit(result.uv, `Moved ${result.moved} UV vertices`)
		return
	}

	if (box) {
		const uv = uvStore.uvBuffer()
		if (!uv) return
		box.u0 = Math.min(box.start[0], point[0])
		box.u1 = Math.max(box.start[0], point[0])
		box.v0 = Math.min(box.start[1], point[1])
		box.v1 = Math.max(box.start[1], point[1])
		const swept = new Set(box.base)
		for (const id of idsInRect(layout, uv, uvStore.selection, box)) swept.add(id)
		uvStore.selection.ids = swept
		uvStore.touch('')
	}
}

function onPointerUp() {
	pan = null
	if (box) {
		box = null
		uvStore.touch(`Selected ${uvStore.selection.ids.size} ${uvStore.selection.mode}(s)`)
	}
	drag = null
}

/** Only while a modal is running, where the right button means cancel. */
function onContextMenu(event: MouseEvent) {
	if (modal) event.preventDefault()
}

function onWheel(event: WheelEvent) {
	event.preventDefault()
	// Zoom toward the cursor: keep whatever is under it under it.
	const before = eventUv(event)
	view.value.span = Math.max(
		0.15,
		Math.min(8, view.value.span * (1 + Math.sign(event.deltaY) * 0.12))
	)
	const after = eventUv(event)
	view.value.u += before[0] - after[0]
	view.value.v += before[1] - after[1]
	draw()
}

const onEnter = () => (uvStore.pointerOnCanvas = true)
const onLeave = () => (uvStore.pointerOnCanvas = false)

onMounted(() => {
	readTheme()
	fit()
	const canvas = canvasRef.value
	if (!canvas) return
	canvas.addEventListener('pointerdown', onPointerDown)
	canvas.addEventListener('pointermove', onPointerMove)
	canvas.addEventListener('pointerup', onPointerUp)
	canvas.addEventListener('pointerenter', onEnter)
	canvas.addEventListener('pointerleave', onLeave)
	canvas.addEventListener('contextmenu', onContextMenu)
	canvas.addEventListener('wheel', onWheel, { passive: false })
})

onBeforeUnmount(() => {
	cancelModal()
	// `pointerleave` does not fire when the element goes away underneath it.
	uvStore.pointerOnCanvas = false
	const canvas = canvasRef.value
	if (!canvas) return
	canvas.removeEventListener('pointerdown', onPointerDown)
	canvas.removeEventListener('pointermove', onPointerMove)
	canvas.removeEventListener('pointerup', onPointerUp)
	canvas.removeEventListener('pointerenter', onEnter)
	canvas.removeEventListener('pointerleave', onLeave)
	canvas.removeEventListener('contextmenu', onContextMenu)
	canvas.removeEventListener('wheel', onWheel)
})

// Released with the component's effect scope.
onKeyDown('editor', onKey)

// So the UV menu can start the same modal the keys do.
defineExpose({ beginTransform })

useResizeObserver(hostRef, fit)
watch(() => uvStore.revision, draw)
// The image arrives asynchronously when a texture is still loading.
watch(() => uvStore.mapImage, draw)
watch(
	() => uvStore.mesh,
	() => {
		// Dropped rather than cancelled: `base` belongs to the mesh that just went
		// away, and writing it back would land it on the new one's UVs.
		setModal(null)
		drag = null
		box = null
		pan = null
		view.value = { u: 0.5, v: 0.5, span: props.span }
		draw()
	}
)
</script>
