/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * A labelled UV grid, generated rather than shipped as an asset so the
 * prototype adds no files to `public/`. Cells are lettered across and numbered
 * up, which makes it obvious at a glance which part of the texture a face is
 * sampling — and obvious when an island has been rotated or flipped.
 */
import THREE from '@/shared/three'

export const UV_GRID_SIZE = 512

export function createUvGridCanvas(size = UV_GRID_SIZE, cells = 8) {
	const canvas = document.createElement('canvas')
	canvas.width = canvas.height = size
	const ctx = canvas.getContext('2d')
	if (!ctx) return canvas
	const cell = size / cells

	for (let y = 0; y < cells; y++) {
		for (let x = 0; x < cells; x++) {
			const odd = (x + y) % 2
			// canvas y grows downward, UV v grows upward
			const top = (cells - 1 - y) * cell
			ctx.fillStyle = `hsl(${(x / cells) * 300}, ${odd ? 55 : 45}%, ${odd ? 62 : 38}%)`
			ctx.fillRect(x * cell, top, cell, cell)
			ctx.fillStyle = odd ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.7)'
			ctx.font = `600 ${cell * 0.3}px Inter, sans-serif`
			ctx.textAlign = 'center'
			ctx.textBaseline = 'middle'
			ctx.fillText(`${String.fromCharCode(65 + x)}${y + 1}`, (x + 0.5) * cell, top + cell / 2)
		}
	}

	ctx.strokeStyle = 'rgba(0,0,0,.35)'
	ctx.lineWidth = 1
	for (let i = 0; i <= cells; i++) {
		ctx.beginPath()
		ctx.moveTo(i * cell, 0)
		ctx.lineTo(i * cell, size)
		ctx.moveTo(0, i * cell)
		ctx.lineTo(size, i * cell)
		ctx.stroke()
	}
	return canvas
}

export function createUvGridTexture() {
	const texture = new THREE.CanvasTexture(createUvGridCanvas())
	texture.colorSpace = THREE.SRGBColorSpace
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping
	texture.name = 'PrototypeUvGrid'
	return texture
}
