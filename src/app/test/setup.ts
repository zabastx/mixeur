import { afterEach, vi } from 'vitest'
import createGL from 'gl'
import { cleanup } from '@testing-library/vue'

afterEach(() => cleanup())

vi.mock('@/shared/ui/MxTooltip.vue', () => ({
	default: {
		template: '<slot name="default"></slot>',
		props: ['tooltipDisabled', 'tooltip', 'options']
	}
}))

vi.mock('/favicon-96x96.png', () => ({
	default: ''
}))

// Minimal 2D context stub. Some Three.js addons (e.g. the lottie helper re-exported
// from `three/examples/jsm/Addons.js`) probe a 2D canvas at import time; happy-dom
// returns null for it, which would crash module evaluation.
function createContext2DStub(): CanvasRenderingContext2D {
	const noop = () => undefined
	return {
		canvas: null,
		fillStyle: '',
		strokeStyle: '',
		globalAlpha: 1,
		fillRect: noop,
		clearRect: noop,
		strokeRect: noop,
		drawImage: noop,
		fillText: noop,
		strokeText: noop,
		beginPath: noop,
		closePath: noop,
		moveTo: noop,
		lineTo: noop,
		fill: noop,
		stroke: noop,
		save: noop,
		restore: noop,
		translate: noop,
		scale: noop,
		rotate: noop,
		setTransform: noop,
		measureText: () => ({ width: 0 }) as TextMetrics,
		getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
		putImageData: noop,
		createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })
	} as unknown as CanvasRenderingContext2D
}

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
	value(type: string, attrs?: object) {
		if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
			return createGL(800, 600, { preserveDrawingBuffer: true, ...(attrs as object) })
		}
		if (type === '2d') {
			return createContext2DStub()
		}
		return null
	}
})
