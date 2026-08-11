import THREE from '@/shared/three'
import { createTeardown, type Teardown } from '@/shared/lib/teardown'
import {
	disposePMREMGenerator,
	initPMREMGenerator
} from '@/shared/three/modules/extras/pmremGenerator'
import { imageDataFromHalfFloat } from '@/shared/three/utils'
import { attachRenderer, detachRenderer } from '@/shared/three/modules/loaders/renderer-context'
import { disposeStudioLightCache } from '@/shared/three/modules/loaders/studio-light'
import { useWorldStore } from './world'
import { useResizeObserver } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import type { ViewportGizmo } from 'three-viewport-gizmo'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SSAARenderPass } from 'three/examples/jsm/postprocessing/SSAARenderPass.js'
import { ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'

interface ComposerParameters {
	canvas: HTMLCanvasElement
	scene: THREE.Scene
	camera: Ref<THREE.PerspectiveCamera | THREE.OrthographicCamera>
	gizmo: ShallowRef<ViewportGizmo | undefined>
}

export const useComposerStore = defineStore('composer', () => {
	const rendererRef = shallowRef<THREE.WebGLRenderer>()
	const composerRef = shallowRef<EffectComposer>()
	const outlinePassRef = shallowRef<OutlinePass>()
	const needsResize = ref(true)

	const composerPasses = shallowRef<Pass[]>([])

	function setupRenderer({ canvas }: { canvas: HTMLCanvasElement }) {
		const renderer = new THREE.WebGLRenderer({
			canvas,
			alpha: true,
			precision: 'highp',
			powerPreference: 'high-performance'
		})

		const { clientWidth, clientHeight } = canvas

		renderer.setPixelRatio(window.devicePixelRatio)
		renderer.setSize(clientWidth, clientHeight, false)

		renderer.toneMapping = THREE.ACESFilmicToneMapping
		renderer.outputColorSpace = THREE.SRGBColorSpace
		renderer.toneMappingExposure = 1.0
		renderer.shadowMap.enabled = true
		renderer.shadowMap.type = THREE.PCFShadowMap
		renderer.autoClear = false

		return renderer
	}

	function setupComposer({
		camera,
		canvas,
		gizmo,
		scene,
		renderer,
		teardown
	}: ComposerParameters & { renderer: THREE.WebGLRenderer; teardown: Teardown }) {
		const composer = new EffectComposer(renderer)
		// `EffectComposer.dispose` only releases its own read/write buffers and
		// copy pass — the passes added below are the caller's to release.
		teardown.add(() => composer.dispose())
		composer.setPixelRatio(window.devicePixelRatio)

		const renderPass = new RenderPass(scene, camera.value)
		composer.addPass(renderPass)
		teardown.add(() => renderPass.dispose())

		const outlinePass = new OutlinePass(
			new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
			scene,
			camera.value
		)
		outlinePass.edgeStrength = 5
		outlinePass.edgeThickness = 1
		outlinePass.edgeGlow = 0
		outlinePass.visibleEdgeColor.set('#ffaa00')
		outlinePass.hiddenEdgeColor.set('#ffaa00')
		composer.addPass(outlinePass)
		teardown.add(() => outlinePass.dispose())
		outlinePassRef.value = outlinePass

		const outputPass = new OutputPass()
		composer.addPass(outputPass)
		teardown.add(() => outputPass.dispose())

		watch(camera, (newCamera) => {
			renderPass.camera = newCamera
			outlinePass.renderCamera = newCamera
		})

		useResizeObserver(canvas, () => {
			needsResize.value = true
		})

		function handleResize() {
			if (!needsResize.value) return
			const { clientWidth, clientHeight } = canvas

			renderer.setPixelRatio(window.devicePixelRatio)
			renderer.setSize(clientWidth, clientHeight, false)
			composer.setSize(clientWidth, clientHeight)

			if (camera.value instanceof THREE.PerspectiveCamera) {
				camera.value.aspect = clientWidth / clientHeight
			}

			camera.value.updateProjectionMatrix()
			gizmo.value?.update()

			needsResize.value = false
		}

		return { composer, outlinePass, handleResize }
	}

	/**
	 * Draws one still image of `scene` and hands back its pixels.
	 *
	 * The viewport's own renderer does the drawing, offscreen, into a target this
	 * function owns from allocation to disposal. Sharing that renderer is the
	 * point: GPU resources — the World's environment map above all — cannot cross
	 * GL contexts, and the second renderer this replaced made them silently sample
	 * black (ADR-0002). One renderer draws everything, so `world.environment` is
	 * usable directly.
	 *
	 * Everything GL-side lives here rather than at the call site, which wants a
	 * picture and not a framebuffer. The returned size is the size actually
	 * rendered: a request past `maxTextureSize` is scaled down with its aspect
	 * kept, because a target the driver cannot allocate reads back blank and a
	 * smaller picture beats no picture. Compare it against what you asked for to
	 * find out whether that happened.
	 *
	 * Throws rather than returning something empty — a blank image that looks
	 * deliberate is the failure mode worth avoiding here.
	 */
	function renderImage({
		camera,
		height,
		scene,
		width
	}: {
		camera: THREE.Camera
		height: number
		scene: THREE.Scene
		width: number
	}): { image: ImageData; width: number; height: number } {
		const renderer = rendererRef.value
		if (!renderer) throw new Error('The viewport renderer is not ready.')

		// Half float, matching what `EffectComposer` builds when left to size its
		// own buffers, and readable only where the extension backing it is. The
		// chain carries linear HDR: SSAA adds 16 jittered samples at ~1/16 weight
		// each and a point light drives radiance past 1, so an 8-bit buffer rounds
		// every small addition up to the nearest 1/255 and clips the rest before
		// `OutputPass` tone maps it — measured as a 26% overexposure (issue #29).
		if (!renderer.capabilities.textureTypeReadable(THREE.HalfFloatType)) {
			throw new Error('This GPU cannot read back high-precision renders.')
		}

		const maxSize = renderer.capabilities.maxTextureSize
		const scale = Math.min(1, maxSize / Math.max(width, height))
		const targetWidth = Math.max(1, Math.floor(width * scale))
		const targetHeight = Math.max(1, Math.floor(height * scale))

		const target = new THREE.WebGLRenderTarget(targetWidth, targetHeight, {
			type: THREE.HalfFloatType,
			format: THREE.RGBAFormat
		})

		// The passes restore what they touch — `EffectComposer.render` puts the
		// active target back, `SSAARenderPass` puts `autoClear` and the clear
		// colour back — and nothing here resizes the renderer. This snapshot is
		// belt and braces for the case they cannot cover: a throw partway through
		// leaves their own restores unrun, and the viewport must not inherit a
		// half-finished render's state.
		const savedPixelRatio = renderer.getPixelRatio()
		const savedSize = renderer.getSize(new THREE.Vector2())
		const savedTarget = renderer.getRenderTarget()
		const savedAutoClear = renderer.autoClear

		// `target` becomes the composer's `renderTarget1` and is disposed with it;
		// `renderTarget2` is the clone the result actually lands in, which is why
		// the read below goes through `readBuffer` rather than `target`.
		const composer = new EffectComposer(renderer, target)
		// Pins the buffers to the target's exact size: the viewport renderer
		// reports a device pixel ratio the composer would otherwise multiply the
		// passes by, leaving them larger than the target.
		composer.setPixelRatio(1)
		// The last pass writes into the composer's buffer, not the framebuffer:
		// this render never reaches the screen.
		composer.renderToScreen = false

		const ssaaPass = new SSAARenderPass(scene, camera)
		composer.addPass(ssaaPass)
		const outputPass = new OutputPass()
		composer.addPass(outputPass)

		try {
			// A target inside `maxTextureSize` can still fail to allocate on a GPU
			// that is out of memory, which surfaces as a GL error rather than a
			// throw. Drain stale errors first so the check below is about this
			// render alone.
			const gl = renderer.getContext()
			while (gl.getError() !== gl.NO_ERROR) {
				/* drain */
			}

			composer.render()

			const buffer = new Uint16Array(targetWidth * targetHeight * 4)
			renderer.readRenderTargetPixels(composer.readBuffer, 0, 0, targetWidth, targetHeight, buffer)

			if (gl.getError() !== gl.NO_ERROR) {
				throw new Error('The GPU failed while rendering the image.')
			}

			return {
				image: imageDataFromHalfFloat(buffer, targetWidth, targetHeight),
				width: targetWidth,
				height: targetHeight
			}
		} finally {
			ssaaPass.dispose()
			outputPass.dispose()
			// Releases `target` — its `renderTarget1` — along with the clone.
			composer.dispose()

			renderer.setPixelRatio(savedPixelRatio)
			renderer.setSize(savedSize.x, savedSize.y, false)
			renderer.setRenderTarget(savedTarget)
			renderer.autoClear = savedAutoClear
		}
	}

	/**
	 * Build the viewport's renderer and post-processing chain, and return them
	 * along with the release that undoes all of it.
	 *
	 * The watcher and resize observer set up along the way are left to the
	 * caller's effect scope; `dispose` covers what Vue cannot see — GPU
	 * resources and the two module-level references to the renderer.
	 */
	function init({ camera, canvas, gizmo, scene }: ComposerParameters) {
		const teardown = createTeardown()

		const renderer = setupRenderer({ canvas })
		teardown.add(() => {
			renderer.dispose()
			// `dispose` frees what Three.js allocated; the GL context itself only
			// goes away when the driver is told to drop it, and browsers cap how
			// many contexts a page may hold at once.
			renderer.forceContextLoss()
		})

		initPMREMGenerator(renderer)
		teardown.add(disposePMREMGenerator)

		// The cached studio lights are PMREM output, so they belong to this
		// renderer too — kept past its death they are handles into a GL context
		// that is gone. Clearing the cache makes the next viewport rebuild them.
		teardown.add(disposeStudioLightCache)

		// The World's environment map is PMREM output for the same reason, and it
		// cannot be built before this point: the store is constructed during
		// `shadingStore.init()`, which runs before any renderer exists.
		const world = useWorldStore()
		world.rebuildEnvironment()
		teardown.add(world.dispose)

		attachRenderer(renderer)
		teardown.add(detachRenderer)

		const { composer, handleResize, outlinePass } = setupComposer({
			canvas,
			camera,
			gizmo,
			scene,
			renderer,
			teardown
		})

		rendererRef.value = renderer
		composerRef.value = composer

		return {
			composer,
			handleResize,
			outlinePass,
			renderer,
			dispose() {
				teardown.run()
				// Cleared after the releases have run, not as one of them: a
				// release that read these would find them already gone.
				rendererRef.value = undefined
				composerRef.value = undefined
				outlinePassRef.value = undefined
			}
		}
	}

	function setOutlineObjects(objects: THREE.Object3D[]) {
		if (!outlinePassRef.value) return console.warn('setOutlineObjects: outlinepass is undefined')
		outlinePassRef.value.selectedObjects = objects
	}

	function removeFromOutline(uuid: string) {
		if (!outlinePassRef.value) return console.warn('removeFromOutline: outlinepass is undefined')
		const idx = outlinePassRef.value.selectedObjects.findIndex((obj) => obj.uuid === uuid)
		if (idx >= 0) {
			outlinePassRef.value.selectedObjects.splice(idx, 1)
		}
	}

	return {
		composerPasses,
		init,
		renderImage,
		rendererRef,
		outlinePassRef,
		setOutlineObjects,
		removeFromOutline,
		needsResize
	}
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useComposerStore, import.meta.hot))
}
