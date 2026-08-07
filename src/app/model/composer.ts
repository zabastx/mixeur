import THREE from '@/shared/three'
import { initPMREMGenerator } from '@/shared/three/modules/extras/pmremGenerator'
import { attachRenderer } from '@/shared/three/modules/loaders/renderer-context'
import { useResizeObserver } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import type { ViewportGizmo } from 'three-viewport-gizmo'
import {
	EffectComposer,
	OutlinePass,
	OutputPass,
	Pass,
	RenderPass,
	SSAARenderPass
} from 'three/examples/jsm/Addons.js'
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
		renderer
	}: ComposerParameters & { renderer: THREE.WebGLRenderer }) {
		const composer = new EffectComposer(renderer)
		composer.setPixelRatio(window.devicePixelRatio)

		const renderPass = new RenderPass(scene, camera.value)
		composer.addPass(renderPass)

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
		outlinePassRef.value = outlinePass

		const outputPass = new OutputPass()
		composer.addPass(outputPass)

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

	function init({ camera, canvas, gizmo, scene }: ComposerParameters) {
		const renderer = setupRenderer({ canvas })

		initPMREMGenerator(renderer)
		attachRenderer(renderer)

		const { composer, handleResize, outlinePass } = setupComposer({
			canvas,
			camera,
			gizmo,
			scene,
			renderer
		})

		rendererRef.value = renderer
		composerRef.value = composer

		return {
			composer,
			handleResize,
			outlinePass,
			renderer
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
