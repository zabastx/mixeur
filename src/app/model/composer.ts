import THREE from '@/shared/three'
import { createTeardown, type Teardown } from '@/shared/lib/teardown'
import {
	disposePMREMGenerator,
	initPMREMGenerator
} from '@/shared/three/modules/extras/pmremGenerator'
import { attachRenderer, detachRenderer } from '@/shared/three/modules/loaders/renderer-context'
import { disposeWorldMapCache } from '@/shared/three/modules/loaders/environment'
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

	function setupRenderImageComposer({
		camera,
		canvas,
		scene
	}: {
		canvas: HTMLCanvasElement
		camera: THREE.Camera
		scene: THREE.Scene
	}) {
		const renderer = setupRenderer({ canvas })
		const composer = new EffectComposer(renderer)
		composer.setPixelRatio(window.devicePixelRatio)

		const ssaaPass = new SSAARenderPass(scene, camera)
		composer.addPass(ssaaPass)

		const outputPass = new OutputPass()
		composer.addPass(outputPass)

		return { composer, renderer }
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

		// The cached world maps are PMREM output, so they belong to this renderer
		// too — kept past its death they are handles into a GL context that is
		// gone. Clearing the cache makes the next viewport rebuild them.
		teardown.add(disposeWorldMapCache)

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
		setupRenderImageComposer,
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
