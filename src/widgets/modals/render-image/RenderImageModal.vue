<template>
	<MxDialog
		v-model="isOpen"
		title="Render Image"
		class="w-5xl bg-window-bg block-border flex flex-col h-2/3"
		:root="{ modal: false }"
		resize
		outside-interaction
		icon="ui/render-image"
	>
		<!-- Horizontal Layout: Preview + Settings -->
		<div class="flex gap-3 p-3 grow overflow-hidden" data-testid="modal-render-image">
			<!-- Left Side: Render Preview -->
			<div class="flex flex-col flex-1">
				<div
					ref="imageWrapperRef"
					class="relative flex grow justify-center items-center border border-ui-box-outline rounded
						overflow-hidden"
				>
					<img
						ref="previewRef"
						class="max-w-full max-h-full m-auto block object-contain checkerboard"
						@load="() => (isRendering = false)"
						@error="() => (isRendering = false)"
					/>
					<MxSpinner v-if="isRendering">Rendering...</MxSpinner>
					<div class="absolute top-2 left-2 text-xs bg-black/50 px-2 py-1 rounded text-white">
						Preview
					</div>
					<button
						class="btn absolute top-2 right-2 text-xs px-2 py-1 rounded text-white"
						:disabled="isRendering"
						@click="renderImage()"
					>
						Render Image
					</button>

					<MxButton
						icon="misc/full-screen"
						class="absolute bottom-2 right-2 text-xl p-1"
						@click="imageFullscreenToggle"
					/>
				</div>

				<!-- Render Metadata -->
				<div class="flex gap-4 text-sm text-ui-menu-bg-text mt-1">
					<div><b>Resolution:</b> {{ renderedImageData.resolution }}</div>
					<div><b>Format:</b> {{ renderedImageData.format }}</div>
					<div><b>Render Time:</b> {{ renderedImageData.renderTime }}s</div>
				</div>
			</div>

			<!-- Right Side: Settings -->
			<div class="flex flex-col max-w-xs w-full -mr-2.5">
				<ScrollContainer>
					<MxAccordionRoot
						collapsible
						:default-value="['image']"
						type="multiple"
						class="space-y-1 pr-2.5"
					>
						<MxAccordionItem label="Image" :item="{ value: 'image' }">
							<RenderImageSettings v-model="renderSettings" />
						</MxAccordionItem>
						<MxAccordionItem
							v-if="cameraStore.renderCameraList.length > 0"
							label="Render Camera"
							:item="{ value: 'camera' }"
						>
							<CameraSettings />
						</MxAccordionItem>
						<p v-else class="text-ui-panel-title">
							No cameras found in scene. <br />
							Viewport camera will be used
						</p>
					</MxAccordionRoot>
				</ScrollContainer>

				<!-- Action Buttons -->
				<div class="flex gap-2 text-ui-text-text text-sm justify-end mt-1 pr-2.5">
					<button class="btn btn--highlight" :disabled="!canSaveImage" @click="saveImage">
						Save Image
					</button>
					<button class="btn" :disabled="isRendering" @click="close('renderImage')">Cancel</button>
				</div>
			</div>
		</div>
	</MxDialog>
</template>

<script lang="ts" setup>
import { useSceneStore } from '@/app/model/scene'
import { useShadingStore } from '@/app/model/shading'
import { useTemplateRef, ref, computed, reactive } from 'vue'
import THREE from '@/shared/three'
import { useModals } from '@/shared/lib/modals'
import { downloadFile } from '@/shared/lib/files'
import type { RenderSettings } from './RenderImageSettings.vue'
import { useToast } from '@/shared/lib/toast'
import { getUserData } from '@/shared/three/utils'
import { useCameraStore } from '@/app/model/camera'
import { useComposerStore } from '@/app/model/composer'
import type { EffectComposer } from 'three/examples/jsm/Addons.js'

const isOpen = defineModel<boolean>({ default: false })

const sceneStore = useSceneStore()

const { close } = useModals()
const toast = useToast()

const shadingStore = useShadingStore()
const cameraStore = useCameraStore()

const renderSettings = ref<RenderSettings>({
	width: 1920,
	height: 1080,
	selectedFormat: 'webp',
	quality: 100,
	background: true,
	backgroundColor: '#000000'
})

const renderedImageData = reactive({
	resolution: '',
	format: '',
	renderTime: 0
})

const isRendering = ref(false)
const actualWidth = ref(1920)
const actualHeight = ref(1080)

const previewRef = useTemplateRef('previewRef')

const canSaveImage = computed(() => {
	return !isRendering.value && previewRef.value?.src
})

/**
 * Creates a render scene from the source scene, excluding helper objects.
 */
function createRenderScene(sourceScene: THREE.Scene): THREE.Scene {
	const renderScene = new THREE.Scene()

	renderScene.background = sourceScene.background?.clone() ?? null
	renderScene.environment = sourceScene.environment ?? null
	renderScene.fog = sourceScene.fog?.clone() ?? null

	// Clone non-helper objects
	sourceScene.children.forEach((child) => {
		if (!getUserData(child).isHelper) {
			const cloned = child.clone(true)
			renderScene.add(cloned)
		}
	})

	return renderScene
}

const displayCanvas = document.createElement('canvas')

/**
 * Renders the scene to the canvas.
 */
async function renderImage() {
	const originalMode = shadingStore.shadingMode
	isRendering.value = true

	const { width, height, background, quality, selectedFormat, backgroundColor } =
		renderSettings.value

	actualWidth.value = width
	actualHeight.value = height

	setTimeout(() => {
		let composer: EffectComposer | undefined = undefined
		let renderer: THREE.WebGLRenderer | undefined = undefined
		try {
			shadingStore.setMode('export')

			const renderScene = createRenderScene(sceneStore.scene as THREE.Scene)
			if (!background) {
				renderScene.background = null
			} else {
				renderScene.background = new THREE.Color(backgroundColor)
			}

			displayCanvas.width = width
			displayCanvas.height = height

			// Create render composer and render directly to display canvas
			const composerStore = useComposerStore()

			const imageComposer = composerStore.setupRenderImageComposer({
				scene: renderScene,
				camera: cameraStore.renderCamera ?? cameraStore.activeCamera,
				canvas: displayCanvas
			})

			if (!imageComposer) throw new Error('Renderer initiation error')

			renderer = imageComposer.renderer
			composer = imageComposer.composer

			renderer.setSize(width, height, false)
			composer.setSize(width, height)

			// Measure render time
			const startTime = performance.now()
			composer.render()
			const endTime = performance.now()

			renderedImageData.resolution = `${width}x${height}`
			renderedImageData.format = selectedFormat
			renderedImageData.renderTime = Number(((endTime - startTime) / 1000).toFixed(2))

			if (previewRef.value?.src) {
				URL.revokeObjectURL(previewRef.value.src)
			}

			displayCanvas.toBlob(
				(blob) => {
					if (!blob || !previewRef.value) return
					previewRef.value.src = URL.createObjectURL(blob)
				},
				`image/${selectedFormat}`,
				quality / 100
			)
		} catch (error) {
			console.error('Render failed:\n', error)
			const err = error as Error
			toast.add({
				type: 'error',
				title: 'Image render error',
				message: err.message
			})
			isRendering.value = false
		} finally {
			shadingStore.setMode(originalMode)
			composer?.dispose()
			renderer?.dispose()
		}
	}, 10)
}

/**
 * Saves the rendered image to a file.
 */
async function saveImage() {
	try {
		const { selectedFormat, quality, width, height } = renderSettings.value

		const blob = await new Promise<Blob | null>((resolve) => {
			displayCanvas.toBlob(
				(blob: Blob | null) => {
					resolve(blob)
				},
				`image/${selectedFormat}`,
				quality / 100
			)
		})

		if (!blob) return

		const resolution = `${width}x${height}`
		const filename = `render_${resolution}.${selectedFormat}`

		downloadFile(blob, filename, {
			mimeType: `image/${selectedFormat}`
		})
	} catch (e) {
		const error = e as Error
		toast.add({
			type: 'error',
			title: 'Error saving an image',
			message: error.message
		})
		if (import.meta.env.DEV) console.error('saveImage:\n', error)
	}
}

const imageWrapperRef = useTemplateRef('imageWrapperRef')

function imageFullscreenToggle() {
	if (document.fullscreenElement) {
		document.exitFullscreen()
	} else {
		imageWrapperRef.value?.requestFullscreen()
	}
}
</script>
