<template>
	<div ref="hostRef" class="relative h-full w-full overflow-hidden">
		<canvas
			ref="canvasRef"
			class="block h-full w-full"
			data-testid="uv-canvas"
			:class="interactive ? 'cursor-crosshair' : 'cursor-default'"
		></canvas>
		<div
			v-if="editor.status.value !== 'ready'"
			class="absolute inset-0 flex items-center justify-center p-4 text-center text-xs
				text-header-text"
		>
			{{ emptyMessage }}
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The UV view itself. Shared by all three layout variants on purpose: the
 * question they disagree about is where this thing lives and what surrounds
 * it, not how a wireframe over a texture should be drawn.
 *
 * Drawing happens in CSS pixels with the backing store scaled by the device
 * ratio, so hairlines survive at any panel width.
 */
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import * as uvEdit from './uv-edit'
import { useUvEditor } from './use-uv-editor'
import { createUvGridCanvas } from './uv-grid-texture'

const props = withDefaults(
	defineProps<{
		/** false renders a read-only preview — used by the narrow dock variant */
		interactive?: boolean
		/** how much UV space fits across the view; 2.2 shows the tile plus margin */
		span?: number
		/** draw the tile's wrap repeats faintly around it */
		showRepeats?: boolean
	}>(),
	{ interactive: true, span: 2.2, showRepeats: true }
)

const editor = useUvEditor()
const canvasRef = useTemplateRef('canvasRef')
const hostRef = useTemplateRef('hostRef')

const emptyMessage = computed(() => {
	switch (editor.status.value) {
		case 'no-selection':
			return 'Select a mesh to edit its UVs'
		case 'not-a-mesh':
			return 'The selected object is not a mesh'
		case 'no-uvs':
			return 'This geometry has no UV attribute'
		default:
			return ''
	}
})

const texture = createUvGridCanvas()
const view = ref({ u: 0.5, v: 0.5, span: props.span })
let width = 0
let height = 0
let dpr = 1

/** The smaller side sets the scale so the tile stays square in any panel. */
const scale = () => Math.min(width, height) / view.value.span

function toScreen(u: number, v: number): [number, number] {
	const s = scale()
	return [(u - view.value.u) * s + width / 2, -(v - view.value.v) * s + height / 2]
}
function toUv(x: number, y: number): uvEdit.Point {
	const s = scale()
	return [(x - width / 2) / s + view.value.u, -(y - height / 2) / s + view.value.v]
}
function eventUv(e: PointerEvent | WheelEvent): uvEdit.Point {
	const canvas = canvasRef.value
	if (!canvas) return [0, 0]
	const r = canvas.getBoundingClientRect()
	return toUv(e.clientX - r.left, e.clientY - r.top)
}
const tol = () => (view.value.span / Math.min(width, height)) * 12

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

let box: (uvEdit.Rect & { start: uvEdit.Point }) | null = null
let dragging: { from: uvEdit.Point; base: Float32Array } | null = null

function draw() {
	const canvas = canvasRef.value
	const ctx = canvas?.getContext('2d')
	if (!canvas || !ctx) return
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	ctx.fillStyle = '#232323'
	ctx.fillRect(0, 0, width, height)

	const model = editor.model.value
	const uv = editor.currentUv()
	if (!model || !uv) return
	const sel = editor.selection.value

	// The tile, plus faint repeats so leaving 0–1 reads as "the texture wraps"
	// rather than "the texture ran out".
	const [x0, y0] = toScreen(0, 1)
	const [x1, y1] = toScreen(1, 0)
	ctx.imageSmoothingEnabled = false
	const reach = props.showRepeats ? 1 : 0
	for (let ru = -reach; ru <= reach; ru++) {
		for (let rv = -reach; rv <= reach; rv++) {
			ctx.globalAlpha = ru === 0 && rv === 0 ? 0.6 : 0.08
			ctx.drawImage(texture, x0 + ru * (x1 - x0), y0 - rv * (y1 - y0), x1 - x0, y1 - y0)
		}
	}
	ctx.globalAlpha = 1
	ctx.strokeStyle = '#ffffff'
	ctx.lineWidth = 1.5
	ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)

	const picked = uvEdit.pickedVerts(model, sel)
	const moving = uvEdit.movingVerts(model, uv, sel)
	const selFaces = selectedFaces(model, sel, picked)

	for (let f = 0; f < model.faceCount; f++) {
		const visible = uvEdit.isFaceVisible(sel, f)
		if (visible && !selFaces.has(f)) continue
		ctx.beginPath()
		for (let k = 0; k < 3; k++) {
			const v = model.faces[f * 3 + k]
			const [x, y] = toScreen(uv[v * 2], uv[v * 2 + 1])
			if (k) ctx.lineTo(x, y)
			else ctx.moveTo(x, y)
		}
		ctx.closePath()
		ctx.fillStyle = visible ? 'rgba(255,175,41,.28)' : 'rgba(20,20,20,.78)'
		ctx.fill()
	}

	// Every line gets a dark halo first: a hairline is invisible on a texture
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
	for (const e of model.edges) {
		const visible = e.faces.some((f) => uvEdit.isFaceVisible(sel, f))
		const [ax, ay] = toScreen(uv[e.a * 2], uv[e.a * 2 + 1])
		const [bx, by] = toScreen(uv[e.b * 2], uv[e.b * 2 + 1])
		if (!visible) stroke(ax, ay, bx, by, 'rgba(140,140,140,.4)', 1)
		else if (e.seam) stroke(ax, ay, bx, by, '#ff5a50', 2.5)
		else if (e.border) stroke(ax, ay, bx, by, '#67c37b', 2.5)
		else stroke(ax, ay, bx, by, 'rgba(255,255,255,.75)', 1)
	}
	if (sel.mode === 'edge') {
		for (const i of sel.ids) {
			const e = model.edges[i]
			if (!e) continue
			const [ax, ay] = toScreen(uv[e.a * 2], uv[e.a * 2 + 1])
			const [bx, by] = toScreen(uv[e.b * 2], uv[e.b * 2 + 1])
			stroke(ax, ay, bx, by, '#ffaf29', 4)
		}
	}

	// Vertices. The number that matters is how many are highlighted, which is
	// `movingVerts` — not what was clicked.
	const dense = model.vertCount > 900
	for (let v = 0; v < model.vertCount; v++) {
		if (!model.facesOfVert[v].length) continue
		const isMoving = moving.has(v)
		const isPicked = picked.has(v)
		if (dense && !isMoving && !isPicked) continue
		const visible = model.facesOfVert[v].some((f) => uvEdit.isFaceVisible(sel, f))
		const [x, y] = toScreen(uv[v * 2], uv[v * 2 + 1])
		const r = isMoving ? 3.5 : 2.5
		ctx.fillStyle = !visible
			? 'rgba(130,130,130,.4)'
			: isPicked
				? '#ffffff'
				: isMoving
					? '#ffaf29'
					: 'rgba(220,220,220,.8)'
		ctx.strokeStyle = 'rgba(0,0,0,.7)'
		ctx.lineWidth = 1
		ctx.strokeRect(x - r - 0.5, y - r - 0.5, r * 2 + 1, r * 2 + 1)
		ctx.fillRect(x - r, y - r, r * 2, r * 2)
	}

	if (sel.pivot === 'cursor') {
		const [cx, cy] = toScreen(sel.cursor[0], sel.cursor[1])
		ctx.strokeStyle = '#ffffff'
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
		ctx.strokeStyle = '#ffaf29'
		ctx.setLineDash([6, 4])
		ctx.lineWidth = 1.5
		ctx.strokeRect(ax, ay, bx - ax, by - ay)
		ctx.setLineDash([])
	}
}

function selectedFaces(model: uvEdit.UvModel, sel: uvEdit.UvSelection, picked: Set<number>) {
	const out = new Set<number>()
	if (sel.mode === 'face') {
		for (const f of sel.ids) out.add(f)
	} else if (sel.mode === 'island') {
		for (const i of sel.ids) for (const f of model.facesOfIsland[i] ?? []) out.add(f)
	} else {
		for (let f = 0; f < model.faceCount; f++) {
			let n = 0
			for (let k = 0; k < 3; k++) if (picked.has(model.faces[f * 3 + k])) n++
			if (n === 3) out.add(f)
		}
	}
	return out
}

// --- interaction ----------------------------------------------------------

function visibleFace(f: number) {
	return uvEdit.isFaceVisible(editor.selection.value, f)
}

function pickAt(p: uvEdit.Point) {
	const model = editor.model.value
	const uv = editor.currentUv()
	if (!model || !uv) return -1
	const sel = editor.selection.value
	if (sel.mode === 'vertex') {
		const v = uvEdit.nearestVertex(model, uv, p, tol())
		return v >= 0 && model.facesOfVert[v].some(visibleFace) ? v : -1
	}
	if (sel.mode === 'edge') {
		const i = uvEdit.nearestEdge(model, uv, p, tol())
		return i >= 0 && model.edges[i].faces.some(visibleFace) ? i : -1
	}
	const f = uvEdit.faceAt(model, uv, p)
	if (f < 0 || !visibleFace(f)) return -1
	return sel.mode === 'face' ? f : model.islandOfFace[f]
}

function applyBox() {
	const model = editor.model.value
	const uv = editor.currentUv()
	if (!model || !uv || !box) return
	const sel = editor.selection.value
	const inside = new Set(uvEdit.vertsInRect(model, uv, box))
	if (sel.mode === 'vertex') {
		for (const v of inside) if (model.facesOfVert[v].some(visibleFace)) sel.ids.add(v)
	} else if (sel.mode === 'edge') {
		model.edges.forEach((e, i) => {
			if (inside.has(e.a) && inside.has(e.b) && e.faces.some(visibleFace)) sel.ids.add(i)
		})
	} else {
		for (let f = 0; f < model.faceCount; f++) {
			if (!visibleFace(f)) continue
			let n = 0
			for (let k = 0; k < 3; k++) if (inside.has(model.faces[f * 3 + k])) n++
			if (n === 3) sel.ids.add(sel.mode === 'face' ? f : model.islandOfFace[f])
		}
	}
}

function onPointerDown(e: PointerEvent) {
	if (!props.interactive || editor.status.value !== 'ready') return
	const uv = editor.currentUv()
	if (!uv) return
	const p = eventUv(e)
	const sel = editor.selection.value
	;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

	if (e.altKey) {
		sel.cursor = p
		sel.pivot = 'cursor'
		editor.touch('Placed the 2D cursor')
		return
	}

	const hit = pickAt(p)
	if (hit >= 0 && sel.ids.has(hit) && !e.shiftKey) {
		dragging = { from: p, base: Float32Array.from(uv) }
		return
	}
	if (hit >= 0) {
		if (!e.shiftKey) sel.ids.clear()
		if (sel.ids.has(hit)) sel.ids.delete(hit)
		else sel.ids.add(hit)
		dragging = { from: p, base: Float32Array.from(uv) }
		editor.touch(`Picked ${sel.mode} ${hit}`)
		return
	}
	if (!e.shiftKey) sel.ids.clear()
	box = { start: p, u0: p[0], u1: p[0], v0: p[1], v1: p[1] }
	editor.touch('Box select')
}

function onPointerMove(e: PointerEvent) {
	const model = editor.model.value
	if (!model) return
	if (dragging) {
		const p = eventUv(e)
		const r = uvEdit.transform(model, dragging.base, editor.selection.value, {
			translate: [p[0] - dragging.from[0], p[1] - dragging.from[1]]
		})
		editor.commit(r.uv, `Dragged ${r.moved} UV vertices`)
		return
	}
	if (box) {
		const p = eventUv(e)
		box.u0 = Math.min(box.start[0], p[0])
		box.u1 = Math.max(box.start[0], p[0])
		box.v0 = Math.min(box.start[1], p[1])
		box.v1 = Math.max(box.start[1], p[1])
		applyBox()
		editor.touch('Box select')
	}
}

function onPointerUp() {
	if (box) {
		applyBox()
		box = null
		editor.touch(`Selected ${editor.selection.value.ids.size} ${editor.selection.value.mode}(s)`)
	}
	dragging = null
}

function onWheel(e: WheelEvent) {
	if (!props.interactive) return
	e.preventDefault()
	const before = eventUv(e)
	view.value.span = Math.max(0.15, Math.min(8, view.value.span * (1 + Math.sign(e.deltaY) * 0.12)))
	const after = eventUv(e)
	view.value.u += before[0] - after[0]
	view.value.v += before[1] - after[1]
	draw()
}

onMounted(() => {
	fit()
	const canvas = canvasRef.value
	if (!canvas) return
	canvas.addEventListener('pointerdown', onPointerDown)
	canvas.addEventListener('pointermove', onPointerMove)
	canvas.addEventListener('pointerup', onPointerUp)
	canvas.addEventListener('wheel', onWheel, { passive: false })
})

onBeforeUnmount(() => {
	const canvas = canvasRef.value
	if (!canvas) return
	canvas.removeEventListener('pointerdown', onPointerDown)
	canvas.removeEventListener('pointermove', onPointerMove)
	canvas.removeEventListener('pointerup', onPointerUp)
	canvas.removeEventListener('wheel', onWheel)
})

useResizeObserver(hostRef, fit)
watch([editor.version, editor.model], draw)
watch(
	() => props.span,
	(s) => {
		view.value.span = s
		draw()
	}
)

defineExpose({
	frame: () => {
		view.value = { u: 0.5, v: 0.5, span: props.span }
		draw()
	}
})
</script>
