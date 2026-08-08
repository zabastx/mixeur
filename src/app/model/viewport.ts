import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'
import { effectScope, ref } from 'vue'
import THREE from '@/shared/three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { useStats } from '@/shared/three/modules/extras/stats'
import { createTeardown } from '@/shared/lib/teardown'
import { useShadingStore } from './shading'
import { useComposerStore } from './composer'
import { useCameraStore } from './camera'
import { useControlsStore } from './controls'
import { useInputStore } from './input'
import { useRaycastStore } from './raycast'
import { useSceneStore } from './scene'

/** Three.js addons are global one-time setup, not per-viewport state. */
let addonsInitiated = false

/**
 * A mounted viewport. The only thing a caller can do with one is release it,
 * which is the point: everything `mount` acquired is reachable from here.
 */
export interface Viewport {
	/** Releases everything `mount` acquired. Safe to call more than once. */
	dispose(): void
}

export const useViewportStore = defineStore('viewport', () => {
	const isMounted = ref(false)

	const { setFPSCounter, monitor, updateMonitor, stats } = useStats()

	/**
	 * At most one viewport exists at a time. Held so a second `mount` can
	 * release the first instead of stacking a second renderer and render loop
	 * on top of it — which is what a hot reload does.
	 */
	let current: Viewport | null = null

	/**
	 * Bring up the viewport on `canvas`: the renderer and post-processing
	 * chain, the orbit/transform/gizmo controls, picking, input, and the render
	 * loop that drives them.
	 *
	 * Everything acquired here is released by the returned `dispose`. The two
	 * kinds of thing being released are kept apart on purpose: reactive effects
	 * (watchers, event listeners, the resize observer) go into an effect scope
	 * that `dispose` stops, and everything Vue cannot see (GPU resources, the
	 * animation loop, objects added to scenes that outlive the viewport) is
	 * recorded in the teardown ledger next to the line that acquired it.
	 */
	function mount(canvas: HTMLCanvasElement): Viewport {
		current?.dispose()

		const sceneStore = useSceneStore()
		const shadingStore = useShadingStore()
		const controlsStore = useControlsStore()
		const composerStore = useComposerStore()
		const raycastStore = useRaycastStore()
		const inputStore = useInputStore()
		const { gizmo, controls } = storeToRefs(controlsStore)
		const { activeCamera } = storeToRefs(useCameraStore())

		const teardown = createTeardown()
		// Detached: these effects belong to the viewport, not to whichever
		// component happened to call `mount`.
		const scope = effectScope(true)

		if (!addonsInitiated) {
			RectAreaLightUniformsLib.init()
			addonsInitiated = true
		}

		shadingStore.init()

		if (import.meta.env.DEV) {
			setFPSCounter(canvas.parentElement)
			teardown.add(() => stats.dom.remove())
		}

		// Seeded before the composer so the first frame is not rendered at the
		// aspect the camera was left at by a previous viewport.
		if (activeCamera.value instanceof THREE.PerspectiveCamera) {
			activeCamera.value.aspect = canvas.clientWidth / canvas.clientHeight
		}

		scope.run(() => {
			const { composer, handleResize, renderer, dispose } = composerStore.init({
				camera: activeCamera,
				canvas,
				gizmo,
				scene: sceneStore.scene as THREE.Scene
			})
			teardown.add(dispose)

			// Controls read the renderer, and picking and input read the controls,
			// so this order is a real dependency rather than a convention. The
			// keyboard handlers these register are ordered by phase instead of by
			// registration — see `@/shared/lib/keyboard`.
			teardown.add(controlsStore.initControls(sceneStore.helperScene as THREE.Scene).dispose)
			raycastStore.init(canvas)
			inputStore.init(canvas)

			const targetFPS = 30
			const frameDelay = 1000 / targetFPS
			let lastFrameTime = 0

			const timer = new THREE.Timer()

			function render(currentTime: number) {
				const deltaTime = currentTime - lastFrameTime
				if (deltaTime < frameDelay) return
				lastFrameTime = currentTime - (deltaTime % frameDelay)
				timer.update()
				const delta = timer.getDelta()

				handleResize()

				sceneStore.grid.update(activeCamera.value)
				controls.value?.update(delta)
				sceneStore.lightHelperObjects.forEach((item) => {
					if ('update' in item) item.update()
				})
				composer.render(delta)
				gizmo.value?.render()
				// The helper scene is drawn over the composed image so the transform
				// gizmo stays visible through whatever it is sitting in front of.
				renderer.clearDepth()
				renderer.render(sceneStore.helperScene, activeCamera.value)

				updateMonitor(renderer)
			}

			renderer.setAnimationLoop(render)
			teardown.add(() => renderer.setAnimationLoop(null))
		})

		const viewport: Viewport = {
			dispose() {
				// Only the viewport still on screen owns `isMounted`; a stale handle
				// disposed after a newer one mounted must not report it gone.
				if (current === viewport) {
					current = null
					isMounted.value = false
				}
				// Stopped first, so no watcher or listener observes a viewport that
				// is halfway through being released.
				scope.stop()
				teardown.run()
			}
		}

		current = viewport
		isMounted.value = true

		return viewport
	}

	return {
		mount,
		monitor,
		isMounted
	}
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useViewportStore, import.meta.hot))
}
