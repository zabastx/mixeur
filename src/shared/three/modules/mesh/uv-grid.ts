import THREE from '@/shared/three'

const SIZE = 512
const CELLS = 8

/**
 * A generated UV grid, the equivalent of Blender's built-in UV Grid image.
 *
 * Cells are lettered across and numbered up, so which part of the texture a
 * face samples is readable at a glance — and a rotated or flipped island is
 * obvious rather than a matter of squinting at a checkerboard. Generated rather
 * than shipped so it costs no asset.
 */
export function createUvGridTexture() {
	const texture = new THREE.CanvasTexture(drawUvGrid())
	texture.colorSpace = THREE.SRGBColorSpace
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping
	texture.name = 'UV Grid'
	return texture
}

export function drawUvGrid(size = SIZE, cells = CELLS) {
	const canvas = document.createElement('canvas')
	canvas.width = canvas.height = size
	const ctx = canvas.getContext('2d')
	if (!ctx) return canvas
	const cell = size / cells

	for (let y = 0; y < cells; y++) {
		for (let x = 0; x < cells; x++) {
			const odd = (x + y) % 2
			// Canvas y grows downward, UV v grows upward.
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
