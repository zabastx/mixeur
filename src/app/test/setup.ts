import { afterEach, vi } from 'vitest'
import createGL from 'gl'
import { cleanup } from '@testing-library/vue'
import '@testing-library/jest-dom/vitest'

afterEach(() => cleanup())

// Renders the tooltip's real body inline next to its trigger, so a test finds a
// tooltip by its text without hovering through reka-ui's portal, which happy-dom
// cannot reach.
vi.mock('@/shared/ui/MxTooltip.vue', async () => ({
	default: {
		components: { MxTooltipBody: (await import('@/shared/ui/MxTooltipBody.vue')).default },
		template: `
			<slot name="default"></slot>
			<div v-if="!tooltipDisabled" role="tooltip">
				<slot name="content"><MxTooltipBody :tooltip="tooltip" /></slot>
			</div>
		`,
		props: ['tooltipDisabled', 'tooltip', 'options']
	}
}))

vi.mock('/favicon-96x96.png', () => ({
	default: ''
}))

// Minimal 2D context stub. Some Three.js addons probe a 2D canvas at import time;
// happy-dom returns null for it, which would crash module evaluation.
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

// `gl` implements WebGL 1.0 only, so this is enough to keep Three.js modules
// that probe for a context at import time from crashing, but NOT enough to
// build a `WebGLRenderer`: Three.js requires WebGL 2 and calls `texImage3D`
// while initialising, which WebGL 1 has no equivalent of. Anything needing a
// live renderer — the composer's passes, the controls, the render loop — has to
// be covered by the Playwright suite instead of here. The composer and controls
// stores build without one; only the composer's `init` and `renderImage` and
// the controls' `initControls` need it.
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
